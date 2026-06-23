// Управление темой оформления: 'light' | 'dark' | 'system'.
// Класс `dark` на <html> переключает CSS-переменные палитры (см. index.html).
const KEY = "theme";
const mq = window.matchMedia("(prefers-color-scheme: dark)");

export const THEME_OPTIONS = ["light", "dark", "system"];

export function getPreference() {
  const v = localStorage.getItem(KEY);
  return THEME_OPTIONS.includes(v) ? v : "system";
}

export function resolveTheme(pref = getPreference()) {
  if (pref === "system") return mq.matches ? "dark" : "light";
  return pref;
}

export function applyTheme(pref = getPreference()) {
  const mode = resolveTheme(pref);
  document.documentElement.classList.toggle("dark", mode === "dark");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", mode === "dark" ? "#181714" : "#3F6F4B");
}

export function setPreference(pref) {
  const next = THEME_OPTIONS.includes(pref) ? pref : "system";
  localStorage.setItem(KEY, next);
  applyTheme(next);
  return next;
}

// Следим за системной темой — пересчитываем, пока выбран режим «системная».
mq.addEventListener?.("change", () => {
  if (getPreference() === "system") applyTheme("system");
});
