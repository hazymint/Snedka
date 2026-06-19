import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
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
app.set("trust proxy", true); // чтобы req.ip отражал реальный адрес за реверс-прокси
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "7d" }));

// ── Блокировка по IP (бан по нику = бан по IP) ──
app.use((req, res, next) => {
  const ip = req.ip;
  if (ip && db.prepare("SELECT 1 FROM banned_ips WHERE ip = ?").get(ip))
    return res.status(403).json({ error: "Доступ заблокирован" });
  next();
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || ".jpg").toLowerCase();
    cb(null, crypto.randomBytes(12).toString("hex") + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    /^image\//.test(file.mimetype) ? cb(null, true) : cb(new Error("Можно загружать только изображения")),
});

const SECRET = process.env.JWT_SECRET || "change-me-in-production";
const sign = (user) => jwt.sign({ uid: user.id }, SECRET, { expiresIn: "30d" });

function recordIp(userId, ip) {
  if (!ip) return;
  db.prepare("INSERT OR IGNORE INTO user_ips (user_id, ip) VALUES (?, ?)").run(userId, ip);
  db.prepare("UPDATE users SET last_ip = ? WHERE id = ?").run(ip, userId);
}

// ── middleware ──
function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Требуется вход" });
  try {
    const { uid } = jwt.verify(token, SECRET);
    const user = db.prepare("SELECT id, email, name, family_id, role, banned FROM users WHERE id = ?").get(uid);
    if (!user) return res.status(401).json({ error: "Пользователь не найден" });
    if (user.banned) return res.status(403).json({ error: "Аккаунт заблокирован" });
    recordIp(user.id, req.ip);
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
  if (r.is_base) return false;
  return r.family_id === user.family_id || user.role === "admin" || user.role === "moderator";
}

// ── helpers ──
function mePayload(user) {
  const family = db.prepare("SELECT id, name, owner_id, invite_code FROM families WHERE id = ?").get(user.family_id);
  const members = db.prepare("SELECT id, name, email, role FROM users WHERE family_id = ? ORDER BY id").all(user.family_id);
  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
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
    `SELECT r.*, u.name AS author
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
    image: r.image || null,
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
app.post("/api/auth/register", (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name) return res.status(400).json({ error: "Заполните все поля" });
  if (password.length < 6) return res.status(400).json({ error: "Пароль минимум 6 символов" });
  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email.toLowerCase()))
    return res.status(409).json({ error: "Email уже зарегистрирован" });

  const firstUser = db.prepare("SELECT COUNT(*) c FROM users").get().c === 0;
  const hash = bcrypt.hashSync(password, 10);
  const user = db.transaction(() => {
    const userId = db.prepare("INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)")
      .run(email.toLowerCase(), hash, name, firstUser ? "admin" : "user").lastInsertRowid;
    const familyId = createFamily(`Семья ${name}`, userId);
    db.prepare("UPDATE users SET family_id = ? WHERE id = ?").run(familyId, userId);
    return db.prepare("SELECT id, email, name, family_id, role FROM users WHERE id = ?").get(userId);
  })();

  recordIp(user.id, req.ip);
  res.json({ token: sign(user), ...mePayload(user) });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get((email || "").toLowerCase());
  if (!user || !bcrypt.compareSync(password || "", user.password_hash))
    return res.status(401).json({ error: "Неверный email или пароль" });
  if (user.banned) return res.status(403).json({ error: "Аккаунт заблокирован" });
  recordIp(user.id, req.ip);
  res.json({ token: sign(user), ...mePayload(user) });
});

app.get("/api/me", auth, (req, res) => res.json(mePayload(req.user)));

// ──────────────────────────  UPLOADS  ──────────────────────────
app.post("/api/uploads", auth, (req, res) => {
  upload.single("image")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "Файл не получен" });
    res.json({ url: `/uploads/${req.file.filename}` });
  });
});

// ──────────────────────────  FAMILY  ──────────────────────────
app.post("/api/family/join", auth, (req, res) => {
  const code = (req.body?.code || "").trim().toUpperCase();
  const family = db.prepare("SELECT id FROM families WHERE invite_code = ?").get(code);
  if (!family) return res.status(404).json({ error: "Семья с таким кодом не найдена" });
  db.prepare("UPDATE users SET family_id = ? WHERE id = ?").run(family.id, req.user.id);
  const user = db.prepare("SELECT id, email, name, family_id, role FROM users WHERE id = ?").get(req.user.id);
  res.json(mePayload(user));
});

app.post("/api/family/new", auth, (req, res) => {
  const name = (req.body?.name || `Семья ${req.user.name}`).trim();
  const familyId = createFamily(name, req.user.id);
  db.prepare("UPDATE users SET family_id = ? WHERE id = ?").run(familyId, req.user.id);
  const user = db.prepare("SELECT id, email, name, family_id, role FROM users WHERE id = ?").get(req.user.id);
  res.json(mePayload(user));
});

app.patch("/api/family", auth, (req, res) => {
  const family = db.prepare("SELECT * FROM families WHERE id = ?").get(req.user.family_id);
  if (family.owner_id !== req.user.id) return res.status(403).json({ error: "Только владелец может переименовать семью" });
  const name = (req.body?.name || "").trim();
  if (name) db.prepare("UPDATE families SET name = ? WHERE id = ?").run(name, family.id);
  const user = db.prepare("SELECT id, email, name, family_id, role FROM users WHERE id = ?").get(req.user.id);
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
  const { name, unit, group, kcal, per } = req.body || {};
  if (!name || !unit || !group) return res.status(400).json({ error: "Укажите название, единицу и отдел" });
  const id = db.prepare(
    "INSERT INTO ingredients (family_id, name, unit, grp, kcal, per, is_base) VALUES (?, ?, ?, ?, ?, ?, 0)"
  ).run(req.user.family_id, name.trim(), unit, group, Number(kcal) || 0, per === "pc" ? "pc" : "100").lastInsertRowid;
  res.json(db.prepare("SELECT id, name, unit, grp AS \"group\", kcal, per, 1 AS custom FROM ingredients WHERE id = ?").get(id));
});

// ──────────────────────────  RECIPES  ──────────────────────────
app.get("/api/recipes", auth, (req, res) => res.json(loadRecipes(req.user)));

function saveRecipeIngredients(recipeId, ings) {
  const insRI = db.prepare("INSERT INTO recipe_ingredients (recipe_id, ingredient_id, amount) VALUES (?, ?, ?)");
  for (const it of ings || []) if (it.ingredient_id && Number(it.amount) > 0) insRI.run(recipeId, it.ingredient_id, Number(it.amount));
}
const cleanVisibility = (v) => (v === "public" ? "public" : "family");

app.post("/api/recipes", auth, (req, res) => {
  const { name, meal, time, steps, ings, image, visibility } = req.body || {};
  if (!name || !ings?.length) return res.status(400).json({ error: "Нужны название и продукты" });
  const id = db.transaction(() => {
    const rid = db.prepare(
      "INSERT INTO recipes (family_id, author_id, name, meal, time, steps, image, visibility, is_base) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)"
    ).run(req.user.family_id, req.user.id, name.trim(), meal || "Другое", Number(time) || 0, JSON.stringify(steps || []), image || null, cleanVisibility(visibility)).lastInsertRowid;
    saveRecipeIngredients(rid, ings);
    return rid;
  })();
  res.json(loadRecipes(req.user).find((r) => r.id === id));
});

app.put("/api/recipes/:id", auth, (req, res) => {
  const id = Number(req.params.id);
  const recipe = db.prepare("SELECT * FROM recipes WHERE id = ?").get(id);
  if (!recipe || !canManageRecipe(req.user, recipe)) return res.status(403).json({ error: "Нет прав на изменение рецепта" });
  const { name, meal, time, steps, ings, image, visibility } = req.body || {};
  if (!name || !ings?.length) return res.status(400).json({ error: "Нужны название и продукты" });
  db.transaction(() => {
    db.prepare("UPDATE recipes SET name = ?, meal = ?, time = ?, steps = ?, image = ?, visibility = ? WHERE id = ?")
      .run(name.trim(), meal || "Другое", Number(time) || 0, JSON.stringify(steps || []), image || null, cleanVisibility(visibility), id);
    db.prepare("DELETE FROM recipe_ingredients WHERE recipe_id = ?").run(id);
    saveRecipeIngredients(id, ings);
  })();
  res.json(loadRecipes(req.user).find((r) => r.id === id));
});

app.delete("/api/recipes/:id", auth, (req, res) => {
  const id = Number(req.params.id);
  const recipe = db.prepare("SELECT * FROM recipes WHERE id = ?").get(id);
  if (!recipe || !canManageRecipe(req.user, recipe)) return res.status(403).json({ error: "Нет прав на удаление рецепта" });
  db.prepare("DELETE FROM recipes WHERE id = ?").run(id);
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
    `SELECT u.id, u.name, u.email, u.role, u.banned, u.last_ip, f.name AS family
     FROM users u LEFT JOIN families f ON f.id = u.family_id ORDER BY u.id`
  ).all();
  res.json({ users, me: { id: req.user.id, role: req.user.role } });
});

app.post("/api/admin/ban", auth, requireRole("admin", "moderator"), (req, res) => {
  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(req.body?.user_id));
  if (!target) return res.status(404).json({ error: "Пользователь не найден" });
  if (!canModerate(req.user, target)) return res.status(403).json({ error: "Недостаточно прав для этого пользователя" });

  db.prepare("UPDATE users SET banned = 1 WHERE id = ?").run(target.id);
  const ips = db.prepare("SELECT ip FROM user_ips WHERE user_id = ?").all(target.id).map((r) => r.ip);
  if (target.last_ip) ips.push(target.last_ip);
  const ins = db.prepare("INSERT OR IGNORE INTO banned_ips (ip, user_id) VALUES (?, ?)");
  // Не блокируем IP, которым пользуются другие активные участники: иначе бан по общему
  // домашнему IP выбивает всю семью и самого модератора без возможности восстановиться.
  const sharedWithActive = db.prepare(
    "SELECT 1 FROM user_ips ui JOIN users u ON u.id = ui.user_id WHERE ui.ip = ? AND u.id != ? AND u.banned = 0 LIMIT 1"
  );
  for (const ip of new Set(ips)) {
    if (!ip || sharedWithActive.get(ip, target.id)) continue;
    ins.run(ip, target.id);
  }
  res.json({ ok: true });
});

app.post("/api/admin/unban", auth, requireRole("admin", "moderator"), (req, res) => {
  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(req.body?.user_id));
  if (!target) return res.status(404).json({ error: "Пользователь не найден" });
  if (!canModerate(req.user, target)) return res.status(403).json({ error: "Недостаточно прав" });
  db.prepare("UPDATE users SET banned = 0 WHERE id = ?").run(target.id);
  db.prepare("DELETE FROM banned_ips WHERE user_id = ?").run(target.id);
  res.json({ ok: true });
});

app.post("/api/admin/role", auth, requireRole("admin"), (req, res) => {
  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(req.body?.user_id));
  const role = req.body?.role;
  if (!target) return res.status(404).json({ error: "Пользователь не найден" });
  if (target.id === req.user.id) return res.status(403).json({ error: "Нельзя менять свою роль" });
  if (!["user", "moderator", "admin"].includes(role)) return res.status(400).json({ error: "Неизвестная роль" });
  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, target.id);
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
