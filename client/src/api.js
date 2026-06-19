const TOKEN_KEY = "menu_token";
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

async function req(path, { method = "GET", body } = {}) {
  const res = await fetch("/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Ошибка запроса");
  return data;
}

export const api = {
  register: (b) => req("/auth/register", { method: "POST", body: b }),
  login: (b) => req("/auth/login", { method: "POST", body: b }),
  me: () => req("/me"),

  uploadImage: async (file) => {
    const fd = new FormData();
    fd.append("image", file);
    const res = await fetch("/api/uploads", {
      method: "POST",
      headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Ошибка загрузки");
    return data; // { url }
  },

  joinFamily: (code) => req("/family/join", { method: "POST", body: { code } }),
  newFamily: (name) => req("/family/new", { method: "POST", body: { name } }),
  renameFamily: (name) => req("/family", { method: "PATCH", body: { name } }),

  ingredients: () => req("/ingredients"),
  addIngredient: (b) => req("/ingredients", { method: "POST", body: b }),

  recipes: () => req("/recipes"),
  createRecipe: (b) => req("/recipes", { method: "POST", body: b }),
  updateRecipe: (id, b) => req(`/recipes/${id}`, { method: "PUT", body: b }),
  deleteRecipe: (id) => req(`/recipes/${id}`, { method: "DELETE" }),
  react: (id, value) => req(`/recipes/${id}/react`, { method: "POST", body: { value } }),

  adminUsers: () => req("/admin/users"),
  adminBan: (user_id) => req("/admin/ban", { method: "POST", body: { user_id } }),
  adminUnban: (user_id) => req("/admin/unban", { method: "POST", body: { user_id } }),
  adminRole: (user_id, role) => req("/admin/role", { method: "POST", body: { user_id, role } }),

  shopping: () => req("/shopping"),
  addShopping: (items) => req("/shopping", { method: "POST", body: { items } }),
  checkShopping: (id, checked) => req(`/shopping/${id}`, { method: "PATCH", body: { checked } }),
  removeShopping: (id) => req(`/shopping/${id}`, { method: "DELETE" }),
  clearShopping: () => req("/shopping", { method: "DELETE" }),
};
