import React, { useState, useMemo, useRef } from "react";
import { ArrowLeft, Plus, X, Search, Save, LayoutGrid, ChevronDown, ImagePlus, Loader2, Lock, Globe, Minus } from "lucide-react";
import { api } from "./api.js";
import { MEALS, UNITS, perForUnit, defaultAmount, mealColor } from "./ui.js";

// Загрузчик изображения: кнопка/превью. value = url | null
function ImageInput({ value, onChange, variant = "cover" }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true); setError("");
    try {
      const { url } = await api.uploadImage(file, variant === "step" ? "step" : "cover");
      onChange(url);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  if (variant === "step") {
    return (
      <div className="mt-2">
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={pick} />
        {value ? (
          <div className="relative inline-block">
            <img src={value} alt="" className="h-20 w-28 object-cover rounded-lg border border-[#DAD3C4]" />
            <button onClick={() => onChange(null)} className="absolute -top-2 -right-2 grid place-items-center w-6 h-6 rounded-full bg-[#23201B] text-white"><X size={13} /></button>
          </div>
        ) : (
          <button onClick={() => ref.current?.click()} disabled={busy}
            className="flex items-center gap-1.5 text-xs text-[#6B655A] hover:text-[#3F6F4B]">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />} Фото к шагу
          </button>
        )}
        {error && <p className="text-xs text-[#C24A38] mt-1">{error}</p>}
      </div>
    );
  }

  // cover
  return (
    <div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={pick} />
      {value ? (
        <div className="relative">
          <img src={value} alt="" className="w-full h-48 object-cover rounded-lg border border-[#DAD3C4]" />
          <button onClick={() => onChange(null)} className="absolute top-2 right-2 grid place-items-center w-8 h-8 rounded-full bg-[#23201B]/80 text-white hover:bg-[#23201B]"><X size={16} /></button>
        </div>
      ) : (
        <button onClick={() => ref.current?.click()} disabled={busy}
          className="w-full h-32 grid place-items-center rounded-lg border-2 border-dashed border-[#DAD3C4] text-[#6B655A] hover:border-[#3F6F4B] hover:text-[#3F6F4B] transition">
          <div className="flex flex-col items-center gap-1.5 text-sm">
            {busy ? <Loader2 size={22} className="animate-spin" /> : <ImagePlus size={22} />}
            {busy ? "Загрузка…" : "Добавить обложку"}
          </div>
        </button>
      )}
      {error && <p className="text-xs text-[#C24A38] mt-1">{error}</p>}
    </div>
  );
}

export default function RecipeForm({ catalog, groups, initial, onIngredientCreated, onSaved, onCancel }) {
  const byId = useMemo(() => Object.fromEntries(catalog.map((i) => [i.id, i])), [catalog]);

  const [name, setName] = useState(initial?.name || "");
  const [meal, setMeal] = useState(initial?.meal || "Обед");
  const [time, setTime] = useState(initial?.time ? String(initial.time) : "");
  const [servings, setServings] = useState(initial?.servings || 1);
  const [image, setImage] = useState(initial?.image || null);
  const [visibility, setVisibility] = useState(initial?.visibility || "family");
  const [chosen, setChosen] = useState(
    initial ? initial.ings.map((i) => ({ id: i.ingredient_id, amount: i.amount })) : []
  );
  const [steps, setSteps] = useState(
    initial?.steps?.length ? initial.steps.map((s) => ({ text: s.text || "", image: s.image || null })) : [{ text: "", image: null }]
  );
  const [pickMode, setPickMode] = useState("catalog");
  const [query, setQuery] = useState("");
  const [openGroup, setOpenGroup] = useState(groups[0] || null);
  const [showNewIng, setShowNewIng] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const chosenIds = new Set(chosen.map((c) => c.id));

  const addChosen = (id) => {
    if (chosenIds.has(id)) return;
    const per = byId[id]?.per || "100";
    setChosen((c) => [...c, { id, amount: defaultAmount(per) }]);
  };
  const setAmount = (id, val) => setChosen((c) => c.map((it) => (it.id === id ? { ...it, amount: val } : it)));
  const removeChosen = (id) => setChosen((c) => c.filter((it) => it.id !== id));

  const updateStep = (i, patch) => setSteps((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const addStep = () => setSteps((s) => [...s, { text: "", image: null }]);
  const removeStep = (i) => setSteps((s) => (s.length === 1 ? [{ text: "", image: null }] : s.filter((_, j) => j !== i)));

  const searchMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((i) => !chosenIds.has(i.id) && i.name.toLowerCase().includes(q)).slice(0, 10);
  }, [query, catalog, chosen]);

  const cleanSteps = steps.filter((s) => s.text.trim() || s.image).map((s) => ({ text: s.text.trim(), image: s.image }));
  const validIngs = chosen.filter((c) => Number(c.amount) > 0);
  const canSave = name.trim() && validIngs.length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setBusy(true); setError("");
    try {
      const body = {
        name: name.trim(),
        meal,
        time: time ? Number(time) : 0,
        servings,
        image,
        visibility,
        steps: cleanSteps,
        ings: validIngs.map((c) => ({ ingredient_id: c.id, amount: Number(c.amount) })),
      };
      const saved = initial ? await api.updateRecipe(initial.id, body) : await api.createRecipe(body);
      onSaved(saved);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <button onClick={onCancel} className="flex items-center gap-1.5 text-sm text-[#6B655A] hover:text-[#23201B]"><ArrowLeft size={16} /> Отмена</button>
        <h1 className="font-serif text-xl">{initial ? "Изменить рецепт" : "Новый рецепт"}</h1>
      </div>

      {/* основное */}
      <div className="bg-white rounded-xl border border-[#DAD3C4] p-4 mb-4 space-y-4">
        <ImageInput value={image} onChange={setImage} variant="cover" />
        <div>
          <label className="block text-sm font-medium mb-1.5">Название</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Куриный суп бабушки"
            className="w-full px-3 py-2 rounded-lg border border-[#DAD3C4] bg-[#F6F3EC] focus:outline-none focus:border-[#3F6F4B]" />
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium mb-1.5">Тип</label>
            <div className="flex flex-wrap gap-2">
              {MEALS.map((m) => (
                <button key={m} onClick={() => setMeal(m)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition ${meal === m ? mealColor(m) + " ring-1 ring-current" : "bg-[#F6F3EC] border-[#DAD3C4] text-[#6B655A]"}`}>{m}</button>
              ))}
            </div>
          </div>
          <div className="w-28">
            <label className="block text-sm font-medium mb-1.5">Время, мин</label>
            <input value={time} onChange={(e) => setTime(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="30"
              className="w-full px-3 py-2 rounded-lg border border-[#DAD3C4] bg-[#F6F3EC] focus:outline-none focus:border-[#3F6F4B]" />
          </div>
          <div className="w-40">
            <label className="block text-sm font-medium mb-1.5">Порций</label>
            <div className="flex items-center justify-between gap-1 px-1 h-[42px] rounded-lg border border-[#DAD3C4] bg-[#F6F3EC]">
              <button type="button" onClick={() => setServings((s) => Math.max(1, s - 1))} disabled={servings <= 1}
                className="p-1.5 text-[#6B655A] hover:text-[#23201B] disabled:opacity-30"><Minus size={16} /></button>
              <span className="text-sm tabular-nums">{servings}</span>
              <button type="button" onClick={() => setServings((s) => Math.min(99, s + 1))}
                className="p-1.5 text-[#6B655A] hover:text-[#23201B]"><Plus size={16} /></button>
            </div>
          </div>
        </div>
        <p className="text-xs text-[#A8A192] -mt-2">Укажите количество ингредиентов на это число порций — в рецепте можно будет пересчитать на любое количество.</p>

        <div>
          <label className="block text-sm font-medium mb-1.5">Кто видит рецепт</label>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setVisibility("family")}
              className={`flex items-start gap-2 p-3 rounded-lg border text-left transition ${visibility === "family" ? "border-[#3F6F4B] bg-[#3F6F4B]/[0.06]" : "border-[#DAD3C4] bg-[#F6F3EC]"}`}>
              <Lock size={18} className="mt-0.5 shrink-0 text-[#3F6F4B]" />
              <span><span className="block text-sm font-medium">Только моя семья</span><span className="block text-xs text-[#6B655A]">Виден участникам вашей группы</span></span>
            </button>
            <button onClick={() => setVisibility("public")}
              className={`flex items-start gap-2 p-3 rounded-lg border text-left transition ${visibility === "public" ? "border-[#3F6F4B] bg-[#3F6F4B]/[0.06]" : "border-[#DAD3C4] bg-[#F6F3EC]"}`}>
              <Globe size={18} className="mt-0.5 shrink-0 text-[#3F6F4B]" />
              <span><span className="block text-sm font-medium">Публичный</span><span className="block text-xs text-[#6B655A]">Виден всем пользователям</span></span>
            </button>
          </div>
        </div>
      </div>

      {/* ингредиенты */}
      <div className="bg-white rounded-xl border border-[#DAD3C4] p-4 mb-4">
        <h2 className="font-serif text-lg mb-3">Ингредиенты</h2>

        {chosen.length > 0 && (
          <ul className="font-mono text-sm divide-y divide-[#EEE9DD] mb-4">
            {chosen.map((c) => (
              <li key={c.id} className="flex items-center gap-2 py-2">
                <span className="flex-1 truncate">{byId[c.id]?.name || "—"}</span>
                <input value={c.amount} onChange={(e) => setAmount(c.id, e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal"
                  className="w-20 px-2 py-1 rounded-md border border-[#DAD3C4] bg-[#F6F3EC] text-right focus:outline-none focus:border-[#3F6F4B]" />
                <span className="w-9 text-[#6B655A] text-xs">{byId[c.id]?.unit}</span>
                <button onClick={() => removeChosen(c.id)} className="text-[#C4BCA9] hover:text-[#C24A38]"><X size={16} /></button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-1 p-1 mb-3 bg-[#F6F3EC] rounded-lg w-fit">
          <button onClick={() => setPickMode("catalog")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition ${pickMode === "catalog" ? "bg-white shadow-sm" : "text-[#6B655A]"}`}>
            <LayoutGrid size={15} /> Каталог
          </button>
          <button onClick={() => setPickMode("search")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition ${pickMode === "search" ? "bg-white shadow-sm" : "text-[#6B655A]"}`}>
            <Search size={15} /> Поиск
          </button>
        </div>

        {pickMode === "search" ? (
          <div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#DAD3C4] bg-[#F6F3EC] focus-within:border-[#3F6F4B]">
              <Search size={16} className="text-[#6B655A]" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Найти продукт…" className="flex-1 bg-transparent text-sm focus:outline-none" />
            </div>
            {query.trim() && (
              <div className="mt-2 border border-[#DAD3C4] rounded-lg overflow-hidden">
                {searchMatches.length ? searchMatches.map((i) => (
                  <button key={i.id} onClick={() => addChosen(i.id)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-[#F6F3EC] border-b border-[#EEE9DD] last:border-0">
                    <span>{i.name}</span><span className="text-xs text-[#A8A192]">{i.group} · {i.unit}</span>
                  </button>
                )) : <div className="px-3 py-2 text-sm text-[#A8A192]">Ничего не найдено — создайте продукт ниже.</div>}
              </div>
            )}
          </div>
        ) : (
          <div className="border border-[#DAD3C4] rounded-lg overflow-hidden divide-y divide-[#EEE9DD]">
            {groups.map((g) => {
              const items = catalog.filter((i) => i.group === g);
              if (!items.length) return null;
              const open = openGroup === g;
              return (
                <div key={g}>
                  <button onClick={() => setOpenGroup(open ? null : g)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium hover:bg-[#F6F3EC]">
                    <span>{g} <span className="text-[#A8A192] font-normal">· {items.length}</span></span>
                    <ChevronDown size={16} className={`text-[#6B655A] transition ${open ? "rotate-180" : ""}`} />
                  </button>
                  {open && (
                    <div className="px-3 pb-3 flex flex-wrap gap-2">
                      {items.map((i) => {
                        const picked = chosenIds.has(i.id);
                        return (
                          <button key={i.id} onClick={() => addChosen(i.id)} disabled={picked}
                            className={`px-2.5 py-1.5 rounded-full text-sm border transition ${picked ? "bg-[#3F6F4B]/10 border-[#3F6F4B]/30 text-[#3F6F4B] cursor-default" : "bg-white border-[#DAD3C4] hover:border-[#3F6F4B] hover:bg-[#F6F3EC]"}`}>
                            {picked ? "✓ " : "+ "}{i.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-3">
          {!showNewIng ? (
            <button onClick={() => setShowNewIng(true)} className="flex items-center gap-1.5 text-sm text-[#3F6F4B] hover:underline"><Plus size={15} /> Создать новый продукт</button>
          ) : (
            <NewIngredientForm groups={groups} onCancel={() => setShowNewIng(false)}
              onCreate={async (def) => {
                const row = await api.addIngredient(def);
                onIngredientCreated(row);
                addChosen(row.id);
                setShowNewIng(false);
              }} />
          )}
        </div>
      </div>

      {/* шаги */}
      <div className="bg-white rounded-xl border border-[#DAD3C4] p-4 mb-4">
        <h2 className="font-serif text-lg mb-3">Приготовление</h2>
        <div className="space-y-3">
          {steps.map((s, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="shrink-0 grid place-items-center w-6 h-6 mt-1.5 rounded-full bg-[#F6F3EC] border border-[#DAD3C4] font-mono text-xs">{i + 1}</span>
              <div className="flex-1">
                <textarea value={s.text} onChange={(e) => updateStep(i, { text: e.target.value })} rows={2} placeholder="Опишите шаг…"
                  className="w-full px-3 py-2 rounded-lg border border-[#DAD3C4] bg-[#F6F3EC] text-sm resize-y focus:outline-none focus:border-[#3F6F4B]" />
                <ImageInput value={s.image} onChange={(url) => updateStep(i, { image: url })} variant="step" />
              </div>
              <button onClick={() => removeStep(i)} className="mt-1.5 text-[#C4BCA9] hover:text-[#C24A38]"><X size={16} /></button>
            </div>
          ))}
        </div>
        <button onClick={addStep} className="mt-3 flex items-center gap-1.5 text-sm text-[#3F6F4B] hover:underline"><Plus size={15} /> Добавить шаг</button>
      </div>

      {error && <p className="text-sm text-[#C24A38] mb-3">{error}</p>}
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={!canSave || busy}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#3F6F4B] text-white font-medium hover:bg-[#345e3f] transition disabled:opacity-40 disabled:cursor-not-allowed">
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} {initial ? "Сохранить изменения" : "Сохранить рецепт"}
        </button>
        {!canSave && <span className="text-xs text-[#A8A192]">Нужны название и хотя бы один продукт</span>}
      </div>
    </div>
  );
}

function NewIngredientForm({ groups, onCreate, onCancel }) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("г");
  const [group, setGroup] = useState(groups[0]);
  const [kcal, setKcal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true); setError("");
    try {
      await onCreate({ name: name.trim(), unit, group, kcal: kcal ? Number(kcal) : 0, per: perForUnit(unit) });
    } catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <div className="rounded-lg border border-[#3F6F4B]/30 bg-[#3F6F4B]/[0.04] p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Новый продукт</span>
        <button onClick={onCancel} className="text-[#C4BCA9] hover:text-[#23201B]"><X size={16} /></button>
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название продукта"
        className="w-full px-3 py-2 rounded-lg border border-[#DAD3C4] bg-white text-sm focus:outline-none focus:border-[#3F6F4B]" />
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-xs text-[#6B655A] mb-1">Отдел</label>
          <select value={group} onChange={(e) => setGroup(e.target.value)} className="w-full px-2 py-2 rounded-lg border border-[#DAD3C4] bg-white text-sm focus:outline-none focus:border-[#3F6F4B]">
            {groups.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="w-24">
          <label className="block text-xs text-[#6B655A] mb-1">Единица</label>
          <select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full px-2 py-2 rounded-lg border border-[#DAD3C4] bg-white text-sm focus:outline-none focus:border-[#3F6F4B]">
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="w-28">
          <label className="block text-xs text-[#6B655A] mb-1">Ккал {perForUnit(unit) === "pc" ? "за шт" : "на 100"}</label>
          <input value={kcal} onChange={(e) => setKcal(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="0"
            className="w-full px-2 py-2 rounded-lg border border-[#DAD3C4] bg-white text-sm focus:outline-none focus:border-[#3F6F4B]" />
        </div>
      </div>
      {error && <p className="text-xs text-[#C24A38]">{error}</p>}
      <button onClick={submit} disabled={!name.trim() || busy} className="w-full py-2 rounded-lg bg-[#3F6F4B] text-white text-sm font-medium hover:bg-[#345e3f] disabled:opacity-40">Добавить продукт</button>
    </div>
  );
}
