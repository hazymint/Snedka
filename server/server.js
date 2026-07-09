import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import db, { inviteCode } from "./db.js";
import { GROUP_ORDER } from "./seed-data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
// По умолчанию (разработка) CORS открыт; в проде задайте CORS_ORIGIN — список разрешённых
// источников через запятую, например "https://snedka.app,https://www.snedka.app".
const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors(corsOrigin ? { origin: corsOrigin.split(",").map((s) => s.trim()).filter(Boolean) } : {}));
app.use(express.json());
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "7d" }));

// Файл держим в памяти — sharp перекодирует его перед записью на диск.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 }, // допускаем «тяжёлый» оригинал — после сжатия он станет лёгким
  fileFilter: (req, file, cb) => {
    // SVG не растеризуем: вектор с того же origin = риск хранимого XSS.
    if (file.mimetype === "image/svg+xml") return cb(new Error("SVG не поддерживается"));
    /^image\//.test(file.mimetype) ? cb(null, true) : cb(new Error("Можно загружать только изображения"));
  },
});

// Целевые размеры по назначению картинки.
const IMG_PRESETS = {
  cover: { width: 1280, quality: 80 },
  step: { width: 800, quality: 78 },
};
const THUMB = { width: 400, quality: 70 };

// Перекодирует буфер в WebP (+ EXIF-поворот, ресайз без апскейла) и кладёт основной файл и миниатюру.
async function processUpload(buffer, variant) {
  const preset = IMG_PRESETS[variant] || IMG_PRESETS.cover;
  const base = crypto.randomBytes(12).toString("hex");
  const pipeline = sharp(buffer, { failOn: "none" }).rotate(); // .rotate() применяет EXIF-ориентацию

  await pipeline
    .clone()
    .resize({ width: preset.width, withoutEnlargement: true })
    .webp({ quality: preset.quality })
    .toFile(path.join(UPLOAD_DIR, `${base}.webp`));

  await pipeline
    .clone()
    .resize({ width: THUMB.width, withoutEnlargement: true })
    .webp({ quality: THUMB.quality })
    .toFile(path.join(UPLOAD_DIR, `${base}_thumb.webp`));

  return { url: `/uploads/${base}.webp`, thumb: `/uploads/${base}_thumb.webp` };
}

// ── Сборка мусора в uploads ──
const isLocalUpload = (url) => typeof url === "string" && url.startsWith("/uploads/");

// Все картинки, на которые ссылается рецепт (обложка + фото шагов).
function recipeImageUrls(recipe) {
  const urls = [];
  if (recipe.image) urls.push(recipe.image);
  try {
    for (const s of JSON.parse(recipe.steps || "[]")) {
      const img = typeof s === "string" ? null : s?.image;
      if (img) urls.push(img);
    }
  } catch {}
  return urls;
}

// Ссылается ли на этот URL хоть один рецепт (учитывая уже применённое изменение БД).
function isImageReferenced(url) {
  if (db.prepare("SELECT 1 FROM recipes WHERE image = ? LIMIT 1").get(url)) return true;
  if (db.prepare("SELECT 1 FROM recipes WHERE steps LIKE ? LIMIT 1").get(`%${url}%`)) return true;
  return false;
}

// Удаляет с диска файлы (и их миниатюры) из списка, если на них больше никто не ссылается.
// Вызывать ПОСЛЕ записи нового состояния в БД.
function removeOrphanUploads(urls) {
  for (const url of urls) {
    if (!isLocalUpload(url) || isImageReferenced(url)) continue;
    const main = path.join(UPLOAD_DIR, path.basename(url)); // basename отсекает любой обход пути
    fs.rm(main, { force: true }, () => {});
    if (url.endsWith(".webp")) {
      const thumb = path.join(UPLOAD_DIR, path.basename(url.replace(/\.webp$/, "_thumb.webp")));
      fs.rm(thumb, { force: true }, () => {});
    }
  }
}

const SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === "production") {
    console.error("JWT_SECRET обязателен в production — запуск прерван.");
    process.exit(1);
  }
  console.warn("⚠ JWT_SECRET не задан — используется небезопасный ключ (только для разработки).");
  return "dev-insecure-secret";
})();
const sign = (user) => jwt.sign({ uid: user.id }, SECRET, { expiresIn: "30d" });

function touchLastSeen(userId) {
  db.prepare("UPDATE users SET last_seen = datetime('now') WHERE id = ?").run(userId);
}

// ── Защита от подбора пароля и спама регистраций ──
// Простой троттлинг в памяти процесса: после max попыток в течение windowMs — блок на windowMs.
function makeLimiter(max, windowMs) {
  const store = new Map();
  return {
    isLocked(key) {
      const e = store.get(key);
      return !!(e && e.blockedUntil > Date.now());
    },
    hit(key) {
      const now = Date.now();
      const e = store.get(key) || { count: 0, first: now, blockedUntil: 0 };
      if (now - e.first > windowMs) { e.count = 0; e.first = now; e.blockedUntil = 0; }
      e.count += 1;
      if (e.count >= max) e.blockedUntil = now + windowMs;
      store.set(key, e);
    },
    clear(key) { store.delete(key); },
    sweep() {
      const now = Date.now();
      for (const [k, e] of store) if (e.blockedUntil < now && now - e.first > windowMs) store.delete(k);
    },
  };
}

const loginFailByUser = makeLimiter(5, 15 * 60 * 1000); // 5 неудач подряд на ник — блок на 15 мин
const loginFailByIp = makeLimiter(20, 15 * 60 * 1000); // 20 неудач с одного IP (за ним может быть вся семья)
const registerByIp = makeLimiter(10, 60 * 60 * 1000); // не больше 10 регистраций в час с одного IP

setInterval(() => {
  loginFailByUser.sweep();
  loginFailByIp.sweep();
  registerByIp.sweep();
}, 10 * 60 * 1000).unref();

// Запись в журнал действий. Имена сохраняем «снимком», чтобы запись пережила
// переименование/удаление пользователя. meta — произвольный объект (сериализуем в JSON).
const logStmt = db.prepare(
  "INSERT INTO audit_log (action, actor_id, actor_name, target_id, target_name, meta, ip) VALUES (?, ?, ?, ?, ?, ?, ?)"
);
function logEvent(action, { actor = null, target = null, meta = null, ip = null } = {}) {
  try {
    logStmt.run(
      action,
      actor?.id ?? null,
      actor?.username ?? null,
      target?.id ?? null,
      target?.name ?? target?.username ?? null,
      meta && Object.keys(meta).length ? JSON.stringify(meta) : null,
      ip ?? null
    );
  } catch {
    // журнал не должен ломать основной запрос
  }
}

// ── middleware ──
function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Требуется вход" });
  try {
    const { uid } = jwt.verify(token, SECRET);
    const user = db.prepare("SELECT id, username, family_id, role, banned FROM users WHERE id = ?").get(uid);
    if (!user) return res.status(401).json({ error: "Пользователь не найден" });
    if (user.banned) return res.status(403).json({ error: "Аккаунт заблокирован" });
    touchLastSeen(user.id);
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Недействительный токен" });
  }
}

const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: "Недостаточно прав" });

// admin может действовать на всех, кроме себя; moderator — только на обычных пользователей
function canModerate(actor, target) {
  if (actor.id === target.id) return false;
  if (actor.role === "admin") return true;
  if (actor.role === "moderator") return target.role === "user";
  return false;
}

function canManageRecipe(user, r) {
  const isStaff = user.role === "admin" || user.role === "moderator";
  // Базовый каталог (предустановленные рецепты) могут править админ и модератор.
  if (r.is_base) return isStaff;
  if (r.family_id === user.family_id) return true; // своя семья
  // Модерация распространяется только на публичный контент: приватные рецепты чужих
  // семей недоступны staff (их не видно в ленте, и менять/удалять их по id нельзя).
  return isStaff && r.visibility === "public";
}

// Кто может править/удалять продукт (ингредиент каталога).
// Админ и модератор управляют всем каталогом (базовыми и семейными продуктами);
// обычный пользователь — только собственными продуктами своей семьи.
function canManageIngredient(user, ing) {
  const isStaff = user.role === "admin" || user.role === "moderator";
  if (isStaff) return true;
  return !ing.is_base && ing.family_id === user.family_id;
}

// ── helpers ──
function mePayload(user) {
  const family = db.prepare("SELECT id, name, owner_id, invite_code FROM families WHERE id = ?").get(user.family_id);
  const members = db.prepare("SELECT id, username, role FROM users WHERE family_id = ? ORDER BY id").all(user.family_id);
  return {
    user: { id: user.id, username: user.username, role: user.role },
    family: { ...family, isOwner: family.owner_id === user.id },
    members,
  };
}

function createFamily(name, ownerId) {
  let code;
  for (let i = 0; i < 5; i++) {
    code = inviteCode();
    if (!db.prepare("SELECT 1 FROM families WHERE invite_code = ?").get(code)) break;
  }
  return db.prepare("INSERT INTO families (name, owner_id, invite_code) VALUES (?, ?, ?)").run(name, ownerId, code).lastInsertRowid;
}

function loadRecipes(user) {
  const fam = user.family_id;
  const rows = db.prepare(
    `SELECT r.*, u.username AS author
     FROM recipes r LEFT JOIN users u ON u.id = r.author_id
     WHERE r.is_base = 1 OR r.visibility = 'public' OR r.family_id = ?
     ORDER BY (r.family_id = ?) DESC, r.id DESC`
  ).all(fam, fam);

  const counts = {};
  for (const c of db.prepare("SELECT recipe_id, SUM(value = 1) likes, SUM(value = -1) dislikes FROM recipe_reactions GROUP BY recipe_id").all())
    counts[c.recipe_id] = { likes: c.likes || 0, dislikes: c.dislikes || 0 };
  const mine = {};
  for (const m of db.prepare("SELECT recipe_id, value FROM recipe_reactions WHERE user_id = ?").all(user.id))
    mine[m.recipe_id] = m.value;

  const ingStmt = db.prepare(
    `SELECT ri.ingredient_id, ri.amount, i.name, i.unit, i.grp, i.kcal, i.per
     FROM recipe_ingredients ri JOIN ingredients i ON i.id = ri.ingredient_id WHERE ri.recipe_id = ?`
  );
  const normStep = (s) => (typeof s === "string" ? { text: s, image: null } : { text: s.text || "", image: s.image || null });

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    meal: r.meal,
    time: r.time,
    servings: r.servings || 1,
    image: r.image || null,
    imagePos: r.image_pos || null,
    visibility: r.is_base ? "public" : r.visibility,
    isBase: !!r.is_base,
    mine: !r.is_base && r.family_id === fam,
    custom: !r.is_base,
    canManage: canManageRecipe(user, r),
    author: r.author,
    likes: counts[r.id]?.likes || 0,
    dislikes: counts[r.id]?.dislikes || 0,
    myReaction: mine[r.id] || 0,
    steps: JSON.parse(r.steps || "[]").map(normStep),
    ings: ingStmt.all(r.id),
  }));
}

// ──────────────────────────  AUTH  ──────────────────────────
// Ник: 3–24 символа, буквы (латиница/кириллица), цифры, "_ . -". Никаких @, пробелов,
// html-спецсимволов и т.п. — это же исключает и любые инъекции через это поле.
const USERNAME_RE = /^[a-zA-Zа-яА-ЯёЁ0-9_.-]{3,24}$/;
const MAX_PASSWORD_LEN = 72; // bcrypt молча обрезает пароль длиннее 72 байт

app.post("/api/auth/register", (req, res) => {
  if (registerByIp.isLocked(req.ip))
    return res.status(429).json({ error: "Слишком много регистраций с этого адреса. Попробуйте позже." });
  registerByIp.hit(req.ip);

  const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
  const { password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Укажите ник и пароль" });
  if (!USERNAME_RE.test(username))
    return res.status(400).json({ error: "Ник: 3–24 символа, только буквы, цифры, «_», «.», «-»" });
  if (password.length < 6) return res.status(400).json({ error: "Пароль минимум 6 символов" });
  if (password.length > MAX_PASSWORD_LEN) return res.status(400).json({ error: `Пароль максимум ${MAX_PASSWORD_LEN} символов` });
  if (db.prepare("SELECT 1 FROM users WHERE username = ?").get(username))
    return res.status(409).json({ error: "Такой ник уже занят" });

  const firstUser = db.prepare("SELECT COUNT(*) c FROM users").get().c === 0;
  const hash = bcrypt.hashSync(password, 10);
  let user;
  try {
    user = db.transaction(() => {
      const userId = db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)")
        .run(username, hash, firstUser ? "admin" : "user").lastInsertRowid;
      const familyId = createFamily(`Семья ${username}`, userId);
      db.prepare("UPDATE users SET family_id = ? WHERE id = ?").run(familyId, userId);
      return db.prepare("SELECT id, username, family_id, role FROM users WHERE id = ?").get(userId);
    })();
  } catch (e) {
    // Гонка: два запроса с одинаковым ником прошли проверку выше одновременно.
    if (e.code?.startsWith("SQLITE_CONSTRAINT")) return res.status(409).json({ error: "Такой ник уже занят" });
    throw e;
  }

  touchLastSeen(user.id);
  logEvent("register", { actor: user, ip: req.ip });
  res.json({ token: sign(user), ...mePayload(user) });
});

app.post("/api/auth/login", (req, res) => {
  const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
  const { password } = req.body || {};
  const userKey = username.toLowerCase();

  if (loginFailByIp.isLocked(req.ip) || (userKey && loginFailByUser.isLocked(userKey)))
    return res.status(429).json({ error: "Слишком много неудачных попыток входа. Попробуйте позже." });

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!user || !bcrypt.compareSync(password || "", user.password_hash)) {
    loginFailByIp.hit(req.ip);
    if (userKey) loginFailByUser.hit(userKey);
    logEvent("login_fail", { meta: { username: userKey.slice(0, 120) }, ip: req.ip });
    return res.status(401).json({ error: "Неверный ник или пароль" });
  }
  if (user.banned) {
    logEvent("login_blocked", { actor: user, ip: req.ip });
    return res.status(403).json({ error: "Аккаунт заблокирован" });
  }
  loginFailByIp.clear(req.ip);
  loginFailByUser.clear(userKey);
  touchLastSeen(user.id);
  logEvent("login", { actor: user, ip: req.ip });
  res.json({ token: sign(user), ...mePayload(user) });
});

app.get("/api/me", auth, (req, res) => res.json(mePayload(req.user)));

// ──────────────────────────  UPLOADS  ──────────────────────────
app.post("/api/uploads", auth, (req, res) => {
  upload.single("image")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "Файл не получен" });
    try {
      const out = await processUpload(req.file.buffer, req.body?.variant);
      res.json(out); // { url, thumb }
    } catch {
      res.status(400).json({ error: "Не удалось обработать изображение" });
    }
  });
});

// ──────────────────────────  FAMILY  ──────────────────────────
app.post("/api/family/join", auth, (req, res) => {
  const code = (req.body?.code || "").trim().toUpperCase();
  const family = db.prepare("SELECT id FROM families WHERE invite_code = ?").get(code);
  if (!family) return res.status(404).json({ error: "Семья с таким кодом не найдена" });
  db.prepare("UPDATE users SET family_id = ? WHERE id = ?").run(family.id, req.user.id);
  const user = db.prepare("SELECT id, username, family_id, role FROM users WHERE id = ?").get(req.user.id);
  const fam = db.prepare("SELECT name FROM families WHERE id = ?").get(family.id);
  logEvent("family_join", { actor: req.user, target: { id: family.id, name: fam?.name }, ip: req.ip });
  res.json(mePayload(user));
});

app.post("/api/family/new", auth, (req, res) => {
  const name = (req.body?.name || `Семья ${req.user.username}`).trim();
  const familyId = createFamily(name, req.user.id);
  db.prepare("UPDATE users SET family_id = ? WHERE id = ?").run(familyId, req.user.id);
  const user = db.prepare("SELECT id, username, family_id, role FROM users WHERE id = ?").get(req.user.id);
  logEvent("family_create", { actor: req.user, target: { id: familyId, name }, ip: req.ip });
  res.json(mePayload(user));
});

app.patch("/api/family", auth, (req, res) => {
  const family = db.prepare("SELECT * FROM families WHERE id = ?").get(req.user.family_id);
  if (family.owner_id !== req.user.id) return res.status(403).json({ error: "Только владелец может переименовать семью" });
  const name = (req.body?.name || "").trim();
  if (name) db.prepare("UPDATE families SET name = ? WHERE id = ?").run(name, family.id);
  const user = db.prepare("SELECT id, username, family_id, role FROM users WHERE id = ?").get(req.user.id);
  res.json(mePayload(user));
});

// ──────────────────────────  INGREDIENTS  ──────────────────────────
app.get("/api/ingredients", auth, (req, res) => {
  const rows = db.prepare(
    "SELECT id, name, unit, grp AS \"group\", kcal, per, (family_id IS NOT NULL) AS custom FROM ingredients WHERE family_id IS NULL OR family_id = ? ORDER BY name"
  ).all(req.user.family_id);
  res.json({ ingredients: rows, groups: GROUP_ORDER });
});

app.post("/api/ingredients", auth, (req, res) => {
  const { name, unit, group, kcal, per, visibility } = req.body || {};
  if (!name || !unit || !group) return res.status(400).json({ error: "Укажите название, единицу и отдел" });
  const isStaff = req.user.role === "admin" || req.user.role === "moderator";
  // Публичный продукт виден всем семьям — его создают только админ и модератор.
  // Обычный пользователь добавляет продукты только в каталог своей семьи.
  const isPublic = visibility === "public";
  if (isPublic && !isStaff) return res.status(403).json({ error: "Создавать продукты для публичных рецептов могут только администраторы и модераторы" });
  const familyId = isPublic ? null : req.user.family_id;
  const id = db.prepare(
    "INSERT INTO ingredients (family_id, name, unit, grp, kcal, per, is_base) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(familyId, name.trim(), unit, group, Number(kcal) || 0, per === "pc" ? "pc" : "100", isPublic ? 1 : 0).lastInsertRowid;
  logEvent("product_create", { actor: req.user, target: { id, name: name.trim() }, meta: isPublic ? { public: true } : null, ip: req.ip });
  res.json(db.prepare("SELECT id, name, unit, grp AS \"group\", kcal, per, (family_id IS NOT NULL) AS custom FROM ingredients WHERE id = ?").get(id));
});

const cleanPer = (p) => (p === "pc" ? "pc" : "100");
const ingredientView = (id) =>
  db.prepare("SELECT id, name, unit, grp AS \"group\", kcal, per, (family_id IS NOT NULL) AS custom FROM ingredients WHERE id = ?").get(id);

app.put("/api/ingredients/:id", auth, (req, res) => {
  const id = Number(req.params.id);
  const ing = db.prepare("SELECT * FROM ingredients WHERE id = ?").get(id);
  if (!ing || !canManageIngredient(req.user, ing)) return res.status(403).json({ error: "Нет прав на изменение продукта" });
  const { name, unit, group, kcal, per } = req.body || {};
  if (!name || !unit || !group) return res.status(400).json({ error: "Укажите название, единицу и отдел" });
  db.prepare("UPDATE ingredients SET name = ?, unit = ?, grp = ?, kcal = ?, per = ? WHERE id = ?")
    .run(name.trim(), unit, group, Number(kcal) || 0, cleanPer(per), id);
  // Правка базового или чужого продукта — это модерация, отмечаем в журнале.
  const moderated = !!ing.is_base || ing.family_id !== req.user.family_id;
  logEvent("product_update", { actor: req.user, target: { id, name: name.trim() }, meta: moderated ? { moderated: true } : null, ip: req.ip });
  res.json(ingredientView(id));
});

app.delete("/api/ingredients/:id", auth, (req, res) => {
  const id = Number(req.params.id);
  const ing = db.prepare("SELECT * FROM ingredients WHERE id = ?").get(id);
  if (!ing || !canManageIngredient(req.user, ing)) return res.status(403).json({ error: "Нет прав на удаление продукта" });
  // Продукт, на который ссылаются рецепты, не удаляем — иначе разъедутся составы рецептов.
  const usedIn = db.prepare("SELECT COUNT(*) c FROM recipe_ingredients WHERE ingredient_id = ?").get(id).c;
  if (usedIn) return res.status(409).json({ error: `Продукт используется в рецептах (${usedIn}) — сначала уберите его оттуда` });
  // Из списков покупок убираем — там это просто незавершённая позиция.
  db.prepare("DELETE FROM shopping_items WHERE ingredient_id = ?").run(id);
  db.prepare("DELETE FROM ingredients WHERE id = ?").run(id);
  const moderated = !!ing.is_base || ing.family_id !== req.user.family_id;
  logEvent("product_delete", { actor: req.user, target: { id, name: ing.name }, meta: moderated ? { moderated: true } : null, ip: req.ip });
  res.json({ ok: true });
});

// ──────────────────────────  RECIPES  ──────────────────────────
app.get("/api/recipes", auth, (req, res) => res.json(loadRecipes(req.user)));

function saveRecipeIngredients(recipeId, ings) {
  const insRI = db.prepare("INSERT INTO recipe_ingredients (recipe_id, ingredient_id, amount) VALUES (?, ?, ?)");
  for (const it of ings || []) if (it.ingredient_id && Number(it.amount) > 0) insRI.run(recipeId, it.ingredient_id, Number(it.amount));
}
const cleanVisibility = (v) => (v === "public" ? "public" : "family");
const cleanServings = (s) => Math.min(99, Math.max(1, Math.round(Number(s) || 1)));
// Точка кадрирования обложки в формате "X% Y%" (для CSS object-position). Чужой ввод не пускаем.
function cleanImagePos(v) {
  const m = typeof v === "string" && v.match(/^(\d{1,3}(?:\.\d+)?)%\s+(\d{1,3}(?:\.\d+)?)%$/);
  if (!m) return null;
  const clamp = (n) => Math.min(100, Math.max(0, parseFloat(n)));
  return `${clamp(m[1])}% ${clamp(m[2])}%`;
}

app.post("/api/recipes", auth, (req, res) => {
  const { name, meal, time, servings, steps, ings, image, imagePos, visibility } = req.body || {};
  if (!name || !ings?.length) return res.status(400).json({ error: "Нужны название и продукты" });
  const id = db.transaction(() => {
    const rid = db.prepare(
      "INSERT INTO recipes (family_id, author_id, name, meal, time, servings, steps, image, image_pos, visibility, is_base) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)"
    ).run(req.user.family_id, req.user.id, name.trim(), meal || "Другое", Number(time) || 0, cleanServings(servings), JSON.stringify(steps || []), image || null, cleanImagePos(imagePos), cleanVisibility(visibility)).lastInsertRowid;
    saveRecipeIngredients(rid, ings);
    return rid;
  })();
  logEvent("recipe_create", { actor: req.user, target: { id, name: name.trim() }, ip: req.ip });
  res.json(loadRecipes(req.user).find((r) => r.id === id));
});

app.put("/api/recipes/:id", auth, (req, res) => {
  const id = Number(req.params.id);
  const recipe = db.prepare("SELECT * FROM recipes WHERE id = ?").get(id);
  if (!recipe || !canManageRecipe(req.user, recipe)) return res.status(403).json({ error: "Нет прав на изменение рецепта" });
  const { name, meal, time, servings, steps, ings, image, imagePos, visibility } = req.body || {};
  if (!name || !ings?.length) return res.status(400).json({ error: "Нужны название и продукты" });
  const oldImages = recipeImageUrls(recipe); // что было до изменения
  db.transaction(() => {
    db.prepare("UPDATE recipes SET name = ?, meal = ?, time = ?, servings = ?, steps = ?, image = ?, image_pos = ?, visibility = ? WHERE id = ?")
      .run(name.trim(), meal || "Другое", Number(time) || 0, cleanServings(servings), JSON.stringify(steps || []), image || null, cleanImagePos(imagePos), cleanVisibility(visibility), id);
    db.prepare("DELETE FROM recipe_ingredients WHERE recipe_id = ?").run(id);
    saveRecipeIngredients(id, ings);
  })();
  // Удаляем картинки, которых больше нет в рецепте (и на которые никто не ссылается).
  const newImages = new Set(recipeImageUrls({ image, steps: JSON.stringify(steps || []) }));
  removeOrphanUploads(oldImages.filter((u) => !newImages.has(u)));
  // Помечаем правку чужого/базового рецепта как модерацию — это видно в журнале.
  const moderated = recipe.is_base || recipe.family_id !== req.user.family_id;
  logEvent("recipe_update", { actor: req.user, target: { id, name: name.trim() }, meta: moderated ? { moderated: true } : null, ip: req.ip });
  res.json(loadRecipes(req.user).find((r) => r.id === id));
});

app.delete("/api/recipes/:id", auth, (req, res) => {
  const id = Number(req.params.id);
  const recipe = db.prepare("SELECT * FROM recipes WHERE id = ?").get(id);
  if (!recipe || !canManageRecipe(req.user, recipe)) return res.status(403).json({ error: "Нет прав на удаление рецепта" });
  const images = recipeImageUrls(recipe);
  db.prepare("DELETE FROM recipes WHERE id = ?").run(id);
  removeOrphanUploads(images);
  const moderated = recipe.is_base || recipe.family_id !== req.user.family_id;
  logEvent("recipe_delete", { actor: req.user, target: { id, name: recipe.name }, meta: moderated ? { moderated: true } : null, ip: req.ip });
  res.json({ ok: true });
});

// ── реакции ──
app.post("/api/recipes/:id/react", auth, (req, res) => {
  const id = Number(req.params.id);
  const r = db.prepare("SELECT * FROM recipes WHERE id = ?").get(id);
  if (!r) return res.status(404).json({ error: "Рецепт не найден" });
  const visible = r.is_base || r.visibility === "public" || r.family_id === req.user.family_id;
  if (!visible) return res.status(403).json({ error: "Рецепт недоступен" });

  const value = Number(req.body?.value);
  if (value === 0) {
    db.prepare("DELETE FROM recipe_reactions WHERE recipe_id = ? AND user_id = ?").run(id, req.user.id);
  } else if (value === 1 || value === -1) {
    db.prepare(`INSERT INTO recipe_reactions (recipe_id, user_id, value) VALUES (?, ?, ?)
      ON CONFLICT(recipe_id, user_id) DO UPDATE SET value = excluded.value`).run(id, req.user.id, value);
  } else return res.status(400).json({ error: "Неверное значение" });

  const c = db.prepare("SELECT SUM(value = 1) likes, SUM(value = -1) dislikes FROM recipe_reactions WHERE recipe_id = ?").get(id);
  res.json({ id, likes: c.likes || 0, dislikes: c.dislikes || 0, myReaction: value });
});

// ──────────────────────────  ADMIN  ──────────────────────────
app.get("/api/admin/users", auth, requireRole("admin", "moderator"), (req, res) => {
  const users = db.prepare(
    `SELECT u.id, u.username, u.role, u.banned, u.last_seen, u.created_at,
            f.name AS family,
            (SELECT COUNT(*) FROM recipes r WHERE r.author_id = u.id) AS recipe_count
     FROM users u LEFT JOIN families f ON f.id = u.family_id ORDER BY u.id`
  ).all();
  res.json({ users, me: { id: req.user.id, role: req.user.role } });
});

// ── Каталог продуктов для управления: базовые и семейные, со счётчиком использования ──
app.get("/api/admin/products", auth, requireRole("admin", "moderator"), (req, res) => {
  const products = db.prepare(
    `SELECT i.id, i.name, i.unit, i.grp AS "group", i.kcal, i.per, i.is_base, i.family_id,
            f.name AS family,
            (SELECT COUNT(*) FROM recipe_ingredients ri WHERE ri.ingredient_id = i.id) AS recipe_count
     FROM ingredients i LEFT JOIN families f ON f.id = i.family_id
     ORDER BY i.is_base DESC, i.grp, i.name`
  ).all();
  res.json({ products, groups: GROUP_ORDER });
});

// ── Сводка для дашборда: счётчики, активность, ряды по дням ──
app.get("/api/admin/stats", auth, requireRole("admin", "moderator"), (req, res) => {
  const one = (sql, ...args) => db.prepare(sql).get(...args);

  const totals = {
    users: one("SELECT COUNT(*) c FROM users").c,
    families: one("SELECT COUNT(*) c FROM families").c,
    recipes: one("SELECT COUNT(*) c FROM recipes WHERE is_base = 0").c,
    baseRecipes: one("SELECT COUNT(*) c FROM recipes WHERE is_base = 1").c,
    ingredients: one("SELECT COUNT(*) c FROM ingredients WHERE is_base = 0").c,
    banned: one("SELECT COUNT(*) c FROM users WHERE banned = 1").c,
  };

  const active = {
    day: one("SELECT COUNT(*) c FROM users WHERE last_seen >= datetime('now','-1 day')").c,
    week: one("SELECT COUNT(*) c FROM users WHERE last_seen >= datetime('now','-7 days')").c,
    month: one("SELECT COUNT(*) c FROM users WHERE last_seen >= datetime('now','-30 days')").c,
  };

  // Ряд по дням за N суток — заполняем нулями отсутствующие даты.
  const DAYS = 14;
  const series = (rows) => {
    const map = Object.fromEntries(rows.map((r) => [r.d, r.c]));
    const out = [];
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      out.push({ date: d, count: map[d] || 0 });
    }
    return out;
  };
  const regRows = db.prepare(
    "SELECT date(created_at) d, COUNT(*) c FROM users WHERE created_at >= date('now', ?) GROUP BY d"
  ).all(`-${DAYS - 1} days`);
  const loginRows = db.prepare(
    "SELECT date(created_at) d, COUNT(*) c FROM audit_log WHERE action = 'login' AND created_at >= date('now', ?) GROUP BY d"
  ).all(`-${DAYS - 1} days`);

  const actionCounts = db.prepare(
    "SELECT action, COUNT(*) c FROM audit_log GROUP BY action ORDER BY c DESC"
  ).all();

  res.json({
    totals,
    active,
    registrations: series(regRows),
    logins: series(loginRows),
    actionCounts,
  });
});

// ── Журнал действий с фильтром и пагинацией ──
app.get("/api/admin/log", auth, requireRole("admin", "moderator"), (req, res) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const action = typeof req.query.action === "string" ? req.query.action : "";

  const where = action ? "WHERE action = ?" : "";
  const args = action ? [action] : [];
  const total = db.prepare(`SELECT COUNT(*) c FROM audit_log ${where}`).get(...args).c;
  const rows = db.prepare(
    `SELECT id, action, actor_id, actor_name, target_id, target_name, meta, ip, created_at
     FROM audit_log ${where} ORDER BY id DESC LIMIT ? OFFSET ?`
  ).all(...args, limit, offset);

  const entries = rows.map((r) => ({
    ...r,
    meta: r.meta ? JSON.parse(r.meta) : null,
  }));
  res.json({ entries, total, limit, offset });
});

app.post("/api/admin/ban", auth, requireRole("admin", "moderator"), (req, res) => {
  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(req.body?.user_id));
  if (!target) return res.status(404).json({ error: "Пользователь не найден" });
  if (!canModerate(req.user, target)) return res.status(403).json({ error: "Недостаточно прав для этого пользователя" });

  db.prepare("UPDATE users SET banned = 1 WHERE id = ?").run(target.id);
  logEvent("ban", { actor: req.user, target, ip: req.ip });
  res.json({ ok: true });
});

app.post("/api/admin/unban", auth, requireRole("admin", "moderator"), (req, res) => {
  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(req.body?.user_id));
  if (!target) return res.status(404).json({ error: "Пользователь не найден" });
  if (!canModerate(req.user, target)) return res.status(403).json({ error: "Недостаточно прав" });
  db.prepare("UPDATE users SET banned = 0 WHERE id = ?").run(target.id);
  logEvent("unban", { actor: req.user, target, ip: req.ip });
  res.json({ ok: true });
});

app.post("/api/admin/role", auth, requireRole("admin"), (req, res) => {
  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(req.body?.user_id));
  const role = req.body?.role;
  if (!target) return res.status(404).json({ error: "Пользователь не найден" });
  if (target.id === req.user.id) return res.status(403).json({ error: "Нельзя менять свою роль" });
  if (!["user", "moderator", "admin"].includes(role)) return res.status(400).json({ error: "Неизвестная роль" });
  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, target.id);
  logEvent("role_change", { actor: req.user, target, meta: { from: target.role, to: role }, ip: req.ip });
  res.json({ ok: true });
});

// ──────────────────────────  SHOPPING LIST  ──────────────────────────
app.get("/api/shopping", auth, (req, res) => {
  const rows = db.prepare(
    `SELECT s.id, s.ingredient_id, s.amount, s.checked, i.name, i.unit, i.grp AS "group"
     FROM shopping_items s JOIN ingredients i ON i.id = s.ingredient_id WHERE s.family_id = ?`
  ).all(req.user.family_id);
  res.json({ items: rows, groups: GROUP_ORDER });
});

app.post("/api/shopping", auth, (req, res) => {
  const items = req.body?.items || [];
  const upsert = db.prepare(
    `INSERT INTO shopping_items (family_id, ingredient_id, amount, added_by) VALUES (?, ?, ?, ?)
     ON CONFLICT(family_id, ingredient_id) DO UPDATE SET amount = amount + excluded.amount`
  );
  db.transaction(() => {
    for (const it of items) if (it.ingredient_id && Number(it.amount) > 0) upsert.run(req.user.family_id, it.ingredient_id, Number(it.amount), req.user.id);
  })();
  res.json({ ok: true });
});

app.patch("/api/shopping/:id", auth, (req, res) => {
  const item = db.prepare("SELECT * FROM shopping_items WHERE id = ? AND family_id = ?").get(Number(req.params.id), req.user.family_id);
  if (!item) return res.status(404).json({ error: "Позиция не найдена" });
  db.prepare("UPDATE shopping_items SET checked = ? WHERE id = ?").run(req.body?.checked ? 1 : 0, item.id);
  res.json({ ok: true });
});

app.delete("/api/shopping/:id", auth, (req, res) => {
  db.prepare("DELETE FROM shopping_items WHERE id = ? AND family_id = ?").run(Number(req.params.id), req.user.family_id);
  res.json({ ok: true });
});

app.delete("/api/shopping", auth, (req, res) => {
  db.prepare("DELETE FROM shopping_items WHERE family_id = ?").run(req.user.family_id);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API на http://localhost:${PORT}`));
