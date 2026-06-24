import Database from "better-sqlite3";
import crypto from "crypto";
import { INGREDIENTS, RECIPES } from "./seed-data.js";

const db = new Database(process.env.DB_PATH || "menu.db");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS families (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  owner_id INTEGER,
  invite_code TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  family_id INTEGER REFERENCES families(id),
  role TEXT DEFAULT 'user',
  banned INTEGER DEFAULT 0,
  last_ip TEXT,
  last_seen TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_ips (
  user_id INTEGER NOT NULL REFERENCES users(id),
  ip TEXT NOT NULL,
  seen_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, ip)
);

CREATE TABLE IF NOT EXISTS banned_ips (
  ip TEXT NOT NULL,
  user_id INTEGER,
  banned_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (ip, user_id)
);

CREATE TABLE IF NOT EXISTS ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER REFERENCES families(id),
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  grp TEXT NOT NULL,
  kcal REAL DEFAULT 0,
  per TEXT DEFAULT '100',
  is_base INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER REFERENCES families(id),
  author_id INTEGER REFERENCES users(id),
  name TEXT NOT NULL,
  meal TEXT NOT NULL,
  time INTEGER DEFAULT 0,
  servings INTEGER DEFAULT 1,
  steps TEXT DEFAULT '[]',
  image TEXT,
  image_pos TEXT,
  visibility TEXT DEFAULT 'family',
  is_base INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  amount REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS recipe_reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  value INTEGER NOT NULL,
  UNIQUE(recipe_id, user_id)
);

CREATE TABLE IF NOT EXISTS shopping_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id),
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  amount REAL NOT NULL,
  checked INTEGER DEFAULT 0,
  added_by INTEGER REFERENCES users(id),
  UNIQUE(family_id, ingredient_id)
);

-- Журнал действий: регистрации, входы, баны, смены ролей, операции с рецептами и т.д.
-- Имена актора/цели денормализованы, чтобы запись оставалась читаемой даже после
-- удаления или переименования пользователя.
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  actor_id INTEGER,
  actor_name TEXT,
  target_id INTEGER,
  target_name TEXT,
  meta TEXT,
  ip TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
`);

// ── Миграции для ранее созданных БД ──
const has = (table, col) => db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);
if (!has("recipes", "image")) db.exec("ALTER TABLE recipes ADD COLUMN image TEXT");
if (!has("recipes", "image_pos")) db.exec("ALTER TABLE recipes ADD COLUMN image_pos TEXT");
if (!has("recipes", "visibility")) db.exec("ALTER TABLE recipes ADD COLUMN visibility TEXT DEFAULT 'family'");
if (!has("recipes", "servings")) db.exec("ALTER TABLE recipes ADD COLUMN servings INTEGER DEFAULT 1");
if (!has("users", "role")) db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
if (!has("users", "banned")) db.exec("ALTER TABLE users ADD COLUMN banned INTEGER DEFAULT 0");
if (!has("users", "last_ip")) db.exec("ALTER TABLE users ADD COLUMN last_ip TEXT");
if (!has("users", "last_seen")) db.exec("ALTER TABLE users ADD COLUMN last_seen TEXT");

// banned_ips: переход со старого ключа (ip) на составной (ip, user_id) — чтобы разбан
// удалял только записи конкретного пользователя и не оставлял общий IP заблокированным.
{
  const pk = db.prepare("PRAGMA table_info(banned_ips)").all().filter((c) => c.pk).map((c) => c.name);
  if (!(pk.includes("ip") && pk.includes("user_id"))) {
    db.exec(`
      ALTER TABLE banned_ips RENAME TO banned_ips_old;
      CREATE TABLE banned_ips (
        ip TEXT NOT NULL,
        user_id INTEGER,
        banned_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (ip, user_id)
      );
      INSERT OR IGNORE INTO banned_ips (ip, user_id, banned_at) SELECT ip, user_id, banned_at FROM banned_ips_old;
      DROP TABLE banned_ips_old;
    `);
  }
}

// Перенос обложек базовых рецептов с внешнего хоста (commons.wikimedia.org) на
// локальные файлы (`/seed-images/...`). Внешний хост в ряде сетей душится/висит, из-за
// чего страдала загрузка всего сайта. Трогаем только записи, всё ещё ссылающиеся на
// Wikimedia, — пользовательские загрузки и правки админов остаются нетронутыми.
{
  const upd = db.prepare(
    "UPDATE recipes SET image = ? WHERE is_base = 1 AND name = ? AND image LIKE 'https://commons.wikimedia.org/%'"
  );
  let moved = 0;
  db.transaction(() => {
    for (const r of RECIPES) {
      if (!r.image) continue;
      moved += upd.run(r.image, r.name).changes;
    }
  })();
  if (moved) console.log(`Обложки базовых рецептов переведены на локальные файлы: ${moved}.`);
}

// ── Идемпотентный досев базового каталога ──
// Запускается при каждом старте: добавляет недостающие базовые продукты и рецепты
// (по имени), не трогая существующие записи и пользовательские данные. Так каталог
// пополняется и на уже работающих инсталляциях, а не только на чистой БД.
{
  const insIng = db.prepare(
    "INSERT INTO ingredients (family_id, name, unit, grp, kcal, per, is_base) VALUES (NULL, ?, ?, ?, ?, ?, 1)"
  );
  const findIng = db.prepare("SELECT id FROM ingredients WHERE is_base = 1 AND name = ?");
  const keyToId = {};
  let newIng = 0;
  db.transaction(() => {
    for (const [key, name, unit, grp, kcal, per] of INGREDIENTS) {
      const existing = findIng.get(name);
      if (existing) keyToId[key] = existing.id;
      else { keyToId[key] = insIng.run(name, unit, grp, kcal, per).lastInsertRowid; newIng++; }
    }
  })();

  const findRec = db.prepare("SELECT 1 FROM recipes WHERE is_base = 1 AND name = ?");
  const insRec = db.prepare(
    "INSERT INTO recipes (family_id, author_id, name, meal, time, steps, image, visibility, is_base) VALUES (NULL, NULL, ?, ?, ?, ?, ?, 'public', 1)"
  );
  const insRI = db.prepare("INSERT INTO recipe_ingredients (recipe_id, ingredient_id, amount) VALUES (?, ?, ?)");
  let newRec = 0;
  db.transaction(() => {
    for (const r of RECIPES) {
      if (findRec.get(r.name)) continue; // рецепт уже в каталоге — пропускаем
      const rid = insRec.run(r.name, r.meal, r.time, JSON.stringify(r.steps), r.image || null).lastInsertRowid;
      for (const [key, amount] of r.ings) if (keyToId[key]) insRI.run(rid, keyToId[key], amount);
      newRec++;
    }
  })();
  if (newIng || newRec) console.log(`Досев каталога: +${newIng} продуктов, +${newRec} рецептов (в seed-data ${INGREDIENTS.length}/${RECIPES.length}).`);
}

// Базовые рецепты всегда публичные
db.exec("UPDATE recipes SET visibility = 'public' WHERE is_base = 1");

export const inviteCode = () => crypto.randomBytes(4).toString("hex").toUpperCase();
export default db;
