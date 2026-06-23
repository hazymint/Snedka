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

export const ROLE_LABEL = { admin: "Админ", moderator: "Модератор", user: "Пользователь" };
export const roleBadge = (r) =>
  r === "admin"
    ? "bg-danger/12 text-danger border-danger/35"
    : r === "moderator"
    ? "bg-violet/12 text-violet-700 border-violet/35"
    : "bg-muted/12 text-ink-soft border-muted/30";
