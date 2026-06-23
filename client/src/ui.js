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
  "Завтрак": "bg-[#E8B23A]/15 text-[#9A6B12] border-[#E8B23A]/40",
  "Обед": "bg-[#3F6F4B]/12 text-[#2F5638] border-[#3F6F4B]/35",
  "Ужин": "bg-[#7A5BA8]/12 text-[#5B4185] border-[#7A5BA8]/35",
  "Другое": "bg-[#6B655A]/12 text-[#4A453C] border-[#6B655A]/35",
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

export const ROLE_LABEL = { admin: "Админ", moderator: "Модератор", user: "Пользователь" };
export const roleBadge = (r) =>
  r === "admin"
    ? "bg-[#C24A38]/12 text-[#C24A38] border-[#C24A38]/35"
    : r === "moderator"
    ? "bg-[#7A5BA8]/12 text-[#5B4185] border-[#7A5BA8]/35"
    : "bg-[#6B655A]/12 text-[#4A453C] border-[#6B655A]/30";
