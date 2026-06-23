import React, { useState, useEffect, useMemo, useRef } from "react";
import { ChefHat, ShoppingBasket, Users, PenLine, LogOut, Loader2, Check, Shield } from "lucide-react";
import { api, getToken, setToken } from "./api.js";
import Auth from "./Auth.jsx";
import { RecipeList, RecipeDetail } from "./Recipes.jsx";
import RecipeForm from "./RecipeForm.jsx";
import Shopping from "./Shopping.jsx";
import Family from "./Family.jsx";
import Admin from "./Admin.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

export default function App() {
  const [me, setMe] = useState(null);
  const [booting, setBooting] = useState(true);

  const [catalog, setCatalog] = useState([]);
  const [groups, setGroups] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [shopping, setShopping] = useState({ items: [], groups: [] });

  const [tab, setTab] = useState("recipes"); // recipes | shopping | family | admin
  const [sub, setSub] = useState(null); // {detail:id} | {form:'new'|id}
  const [mealFilter, setMealFilter] = useState("Все");
  const [scope, setScope] = useState("all"); // all | mine | public
  const [flash, setFlash] = useState(null);

  const showFlash = (m) => { setFlash(m); setTimeout(() => setFlash(null), 1800); };

  const loadData = async () => {
    const [ing, recs, shop] = await Promise.all([api.ingredients(), api.recipes(), api.shopping()]);
    setCatalog(ing.ingredients); setGroups(ing.groups);
    setRecipes(recs);
    setShopping(shop);
  };

  useEffect(() => {
    (async () => {
      if (getToken()) {
        try { const m = await api.me(); setMe(m); await loadData(); }
        catch { setToken(null); }
      }
      setBooting(false);
    })();
  }, []);

  const onAuthed = async (payload) => {
    setMe({ user: payload.user, family: payload.family, members: payload.members });
    await loadData();
  };

  const logout = () => { setToken(null); setMe(null); setTab("recipes"); setSub(null); };

  const reloadShopping = async () => setShopping(await api.shopping());
  const reloadRecipes = async () => setRecipes(await api.recipes());

  const addToShopping = async (ings, label) => {
    await api.addShopping(ings.map((i) => ({ ingredient_id: i.ingredient_id, amount: i.amount })));
    await reloadShopping();
    showFlash(label);
  };

  const handleReact = async (recipe, value) => {
    try {
      const res = await api.react(recipe.id, value);
      setRecipes((rs) => rs.map((r) => (r.id === res.id ? { ...r, likes: res.likes, dislikes: res.dislikes, myReaction: res.myReaction } : r)));
    } catch (e) { showFlash(e.message); }
  };

  const lastSurpriseRef = useRef(null);

  const surprise = (meal) => {
    let pool = recipes.filter((r) => r.meal === meal);
    if (!pool.length) { showFlash(`Пока нет рецептов: ${meal.toLowerCase()}`); return; }

    // Не предлагать сильно «дизлайкнутые» (если после этого остаётся выбор).
    const notHated = pool.filter((r) => r.dislikes - r.likes < 3);
    if (notHated.length) pool = notHated;

    // Не повторять последний показанный рецепт.
    if (pool.length > 1 && lastSurpriseRef.current != null) {
      const noRepeat = pool.filter((r) => r.id !== lastSurpriseRef.current);
      if (noRepeat.length) pool = noRepeat;
    }

    // Взвешенный случайный выбор: чаще выпадает то, что больше лайкают.
    const weight = (r) => Math.min(4, Math.max(0.2, 1 + (r.likes - r.dislikes) * 0.5));
    const total = pool.reduce((s, r) => s + weight(r), 0);
    let t = Math.random() * total;
    let pick = pool[pool.length - 1];
    for (const r of pool) { t -= weight(r); if (t <= 0) { pick = r; break; } }

    lastSurpriseRef.current = pick.id;
    setTab("recipes");
    setSub({ detail: pick.id, surprise: meal });
  };

  const filtered = useMemo(() => recipes.filter((r) => {
    if (mealFilter !== "Все" && r.meal !== mealFilter) return false;
    if (scope === "mine" && !r.mine) return false;
    if (scope === "public" && r.visibility !== "public") return false;
    return true;
  }), [recipes, mealFilter, scope]);

  const openRecipe = sub?.detail ? recipes.find((r) => r.id === sub.detail) : null;
  const editRecipe = sub?.form && sub.form !== "new" ? recipes.find((r) => r.id === sub.form) : null;

  if (booting) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (!me) return <Auth onAuthed={onAuthed} />;

  const isStaff = me.user.role === "admin" || me.user.role === "moderator";
  const tabs = [
    { id: "recipes", label: "Рецепты", icon: ChefHat },
    { id: "shopping", label: "Список", icon: ShoppingBasket, badge: shopping.items.length },
    { id: "family", label: "Семья", icon: Users },
    ...(isStaff ? [{ id: "admin", label: "Админка", icon: Shield }] : []),
  ];

  return (
    <div className="min-h-screen bg-paper text-ink antialiased">
      <header className="sticky top-0 z-20 bg-paper/95 backdrop-blur border-b border-line">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
          <button onClick={() => { setTab("recipes"); setSub(null); }} className="flex items-center gap-2">
            <span className="grid place-items-center w-9 h-9 rounded-lg bg-primary text-paper"><ChefHat size={20} /></span>
            <span className="font-serif text-xl tracking-tight hidden md:inline">Снедка</span>
          </button>

          <nav className="flex items-center gap-1">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => { setTab(t.id); setSub(null); }}
                className={`relative flex items-center gap-1.5 px-3 h-10 rounded-lg text-sm font-medium transition ${tab === t.id && !sub ? "bg-primary text-paper" : "hover:bg-surface"}`}>
                <t.icon size={17} /><span className="hidden sm:inline">{t.label}</span>
                {t.badge > 0 && <span className="grid place-items-center min-w-5 h-5 px-1 rounded-full bg-danger text-white text-xs font-bold">{t.badge}</span>}
              </button>
            ))}
            <button onClick={() => { setTab("recipes"); setSub({ form: "new" }); }}
              className="flex items-center gap-1.5 px-3 h-10 rounded-lg border border-line bg-surface hover:border-primary/50 text-sm font-medium ml-1">
              <PenLine size={16} /><span className="hidden sm:inline">Новый</span>
            </button>
            <ThemeToggle />
            <button onClick={logout} title="Выйти" className="grid place-items-center w-10 h-10 rounded-lg hover:bg-surface text-muted"><LogOut size={18} /></button>
          </nav>
        </div>
      </header>

      {flash && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-ink text-paper text-sm shadow-lg">
          <Check size={16} className="text-mint" /> {flash}
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 py-6">
        {sub?.form && (
          <RecipeForm
            catalog={catalog} groups={groups} initial={editRecipe}
            onIngredientCreated={(row) => setCatalog((c) => [...c, row].sort((a, b) => a.name.localeCompare(b.name)))}
            onSaved={async (saved) => { await reloadRecipes(); setSub({ detail: saved.id }); showFlash(editRecipe ? "Рецепт обновлён" : "Рецепт сохранён"); }}
            onCancel={() => setSub(openRecipe ? { detail: openRecipe.id } : null)}
          />
        )}

        {sub?.detail && openRecipe && !sub.form && (
          <RecipeDetail
            recipe={openRecipe}
            surpriseMeal={sub.surprise || null}
            onSurpriseAgain={sub.surprise ? () => surprise(sub.surprise) : null}
            onBack={() => setSub(null)}
            onAddAll={(ings) => addToShopping(ings, `«${openRecipe.name}» — продукты в списке`)}
            onAddOne={(i) => addToShopping([i], `${i.name} — в списке`)}
            onReact={handleReact}
            onEdit={() => setSub({ form: openRecipe.id })}
            onDelete={async () => { await api.deleteRecipe(openRecipe.id); await reloadRecipes(); setSub(null); showFlash("Рецепт удалён"); }}
          />
        )}

        {!sub && tab === "recipes" && (
          <RecipeList recipes={filtered} mealFilter={mealFilter} setMealFilter={setMealFilter} scope={scope} setScope={setScope}
            onOpen={(id) => setSub({ detail: id })}
            onAddAll={(r) => addToShopping(r.ings, `«${r.name}» — продукты в списке`)}
            onReact={handleReact}
            onSurprise={surprise}
            onCreate={() => setSub({ form: "new" })} />
        )}

        {!sub && tab === "shopping" && (
          <Shopping items={shopping.items} groups={shopping.groups}
            onToggle={async (it) => { await api.checkShopping(it.id, !it.checked); await reloadShopping(); }}
            onRemove={async (it) => { await api.removeShopping(it.id); await reloadShopping(); }}
            onClear={async () => { await api.clearShopping(); await reloadShopping(); }}
            onBrowse={() => setTab("recipes")} />
        )}

        {!sub && tab === "family" && (
          <Family me={me} onUpdate={async (next) => { setMe(next); await loadData(); }} onFlash={showFlash} />
        )}

        {!sub && tab === "admin" && isStaff && <Admin onFlash={showFlash} />}
      </main>
    </div>
  );
}
