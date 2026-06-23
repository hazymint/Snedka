export const MEALS = ["Завтрак", "Обед", "Ужин", "Другое"];
export const UNITS = ["г", "мл", "шт", "зуб."];
export const perForUnit = (u) => (u === "шт" || u === "зуб." ? "pc" : "100");
export const defaultAmount = (per) => (per === "pc" ? 1 : 100);
export const fmtAmount = (a) => (Number.isInteger(a) ? a : +Number(a).toFixed(1));

const totalKcal = (r) =>
  (r.ings || []).reduce((s, i) => {
    return s + (i.per === "pc" ? (i.kcal || 0) * i.amount : ((i.kcal || 0) * i.amount) / 100);
  }, 0);

// Суммарная калорийность рецепта (всех порций).
export const recipeKcal = (r) => Math.round(totalKcal(r));

// Калорийность на одну порцию: количество ингредиентов задано на r.servings порций.
export const recipeKcalPerServing = (r) => Math.round(totalKcal(r) / (r.servings || 1));

const MEAL_COLORS = {
  "Завтрак": "bg-accent/15 text-accent-700 border-accent/40",
  "Обед": "bg-primary/12 text-primary-800 border-primary/35",
  "Ужин": "bg-violet/12 text-violet-700 border-violet/35",
  "Другое": "bg-muted/12 text-ink-soft border-muted/35",
};
export const mealColor = (m) => MEAL_COLORS[m] || MEAL_COLORS["Другое"];

// URL лёгкой миниатюры: для локальных загрузок она лежит рядом с основным файлом.
export const thumbUrl = (url) =>
  url && url.startsWith("/uploads/") && url.endsWith(".webp")
    ? url.replace(/\.webp$/, "_thumb.webp")
    : url;

// Уменьшает изображение прямо в браузере перед отправкой — экономит мобильный трафик.
// Возвращает Blob (WebP) либо исходный файл, если декодировать не удалось (например, HEIC) —
// тогда финальное сжатие сделает сервер.
export async function downscaleImage(file, maxDim = 1600, quality = 0.82) {
  if (!file || !file.type?.startsWith("image/") || file.type === "image/gif") return file;
  if (typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1024 * 1024) { bitmap.close?.(); return file; }
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

// SQLite хранит время как UTC-строку "YYYY-MM-DD HH:MM:SS" без таймзоны.
// Приводим к ISO с 'Z', чтобы браузер показал её в локальном времени пользователя.
const parseUtc = (s) => (s ? new Date(s.replace(" ", "T") + "Z") : null);

export function fmtDateTime(s) {
  const d = parseUtc(s);
  if (!d || isNaN(d)) return "—";
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function fmtDate(s) {
  const d = parseUtc(s);
  if (!d || isNaN(d)) return "—";
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

// Относительное время «5 мин назад» — для журнала и активности.
export function fmtRelative(s) {
  const d = parseUtc(s);
  if (!d || isNaN(d)) return "—";
  const sec = Math.round((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "только что";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} мин назад`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} ч назад`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} дн назад`;
  return fmtDate(s);
}

// Человекочитаемые подписи событий журнала.
export const ACTION_LABEL = {
  register: "Регистрация",
  login: "Вход",
  login_fail: "Неудачный вход",
  login_blocked: "Вход заблокирован",
  ban: "Бан",
  unban: "Разбан",
  role_change: "Смена роли",
  recipe_create: "Создан рецепт",
  recipe_update: "Изменён рецепт",
  recipe_delete: "Удалён рецепт",
  family_create: "Создана семья",
  family_join: "Вход в семью",
};

// Цвет-тон для значка события.
export const actionTone = (a) => {
  if (a === "ban" || a === "recipe_delete" || a === "login_fail" || a === "login_blocked")
    return "bg-danger/12 text-danger border-danger/30";
  if (a === "register" || a === "recipe_create" || a === "family_create")
    return "bg-mint/15 text-primary-800 border-primary/30";
  if (a === "role_change" || a === "unban")
    return "bg-violet/12 text-violet-700 border-violet/30";
  return "bg-muted/12 text-ink-soft border-muted/30";
};

export const ROLE_LABEL = { admin: "Админ", moderator: "Модератор", user: "Пользователь" };
export const roleBadge = (r) =>
  r === "admin"
    ? "bg-danger/12 text-danger border-danger/35"
    : r === "moderator"
    ? "bg-violet/12 text-violet-700 border-violet/35"
    : "bg-muted/12 text-ink-soft border-muted/30";
