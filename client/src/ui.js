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

export const ROLE_LABEL = { admin: "Админ", moderator: "Модератор", user: "Пользователь" };
export const roleBadge = (r) =>
  r === "admin"
    ? "bg-[#C24A38]/12 text-[#C24A38] border-[#C24A38]/35"
    : r === "moderator"
    ? "bg-[#7A5BA8]/12 text-[#5B4185] border-[#7A5BA8]/35"
    : "bg-[#6B655A]/12 text-[#4A453C] border-[#6B655A]/30";
