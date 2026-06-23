import React, { useState, useEffect } from "react";
import { Clock, Flame, Plus, ShoppingBasket, ArrowLeft, Minus, Pencil, Trash2, ThumbsUp, ThumbsDown, Lock, Globe, Dices, X } from "lucide-react";
import { recipeKcalPerServing, fmtAmount, mealColor } from "./ui.js";

function WhatToEat({ onSurprise }) {
  const [open, setOpen] = useState(false);
  const choices = ["Завтрак", "Обед", "Ужин"];
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 mb-4 px-4 py-3 rounded-xl bg-[#C24A38] text-white font-medium shadow-[0_6px_20px_-10px_rgba(194,74,56,0.9)] hover:bg-[#a83e2e] transition">
        <Dices size={18} /> Не знаю что поесть
      </button>

      {open && (
        <div className="fixed inset-0 z-40 grid place-items-center p-4 bg-[#23201B]/50 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm bg-[#F6F3EC] rounded-2xl border border-[#DAD3C4] shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-1">
              <h3 className="font-serif text-xl">Что приготовить?</h3>
              <button onClick={() => setOpen(false)} className="grid place-items-center w-8 h-8 -mr-2 -mt-1 rounded-lg text-[#6B655A] hover:bg-white"><X size={18} /></button>
            </div>
            <p className="text-sm text-[#6B655A] mb-5">Выберите приём пищи — подберём случайный рецепт из семейных и публичных.</p>
            <div className="grid gap-2.5">
              {choices.map((m) => (
                <button key={m} onClick={() => { setOpen(false); onSurprise(m); }}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border text-left font-medium transition hover:border-[#3F6F4B] hover:bg-white ${mealColor(m)}`}>
                  <span>{m}</span>
                  <Dices size={16} className="opacity-50" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function VisBadge({ r }) {
  if (r.isBase) return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-[#DAD3C4] bg-white text-[#6B655A]">Каталог</span>;
  if (r.visibility === "public")
    return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-[#3F6F4B]/35 bg-[#3F6F4B]/10 text-[#2F5638]"><Globe size={12} /> Публичный</span>;
  return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-[#C24A38]/40 bg-[#C24A38]/10 text-[#C24A38]"><Lock size={12} /> Семейный</span>;
}

function Reactions({ r, onReact, size = "sm" }) {
  const pad = size === "lg" ? "px-3 py-2 text-sm" : "px-2 py-1 text-xs";
  const ic = size === "lg" ? 18 : 15;
  const toggle = (v) => onReact(r, r.myReaction === v ? 0 : v);
  return (
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <button onClick={() => toggle(1)}
        className={`flex items-center gap-1.5 rounded-lg border transition ${pad} ${r.myReaction === 1 ? "bg-[#3F6F4B] border-[#3F6F4B] text-white" : "bg-white border-[#DAD3C4] text-[#6B655A] hover:border-[#3F6F4B]"}`}>
        <ThumbsUp size={ic} /> <span className="tabular-nums">{r.likes}</span>
      </button>
      <button onClick={() => toggle(-1)}
        className={`flex items-center gap-1.5 rounded-lg border transition ${pad} ${r.myReaction === -1 ? "bg-[#C24A38] border-[#C24A38] text-white" : "bg-white border-[#DAD3C4] text-[#6B655A] hover:border-[#C24A38]"}`}>
        <ThumbsDown size={ic} /> <span className="tabular-nums">{r.dislikes}</span>
      </button>
    </div>
  );
}

export function RecipeList({ recipes, mealFilter, setMealFilter, scope, setScope, onOpen, onAddAll, onReact, onSurprise, onCreate }) {
  const meals = ["Все", "Завтрак", "Обед", "Ужин", "Другое"];
  const scopes = [["all", "Все"], ["mine", "Мои семейные"], ["public", "Публичные"]];
  return (
    <div>
      {onSurprise && <WhatToEat onSurprise={onSurprise} />}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
        {scopes.map(([id, label]) => (
          <button key={id} onClick={() => setScope(id)}
            className={`px-3.5 py-1.5 rounded-full text-sm whitespace-nowrap border transition ${scope === id ? "bg-[#3F6F4B] text-white border-[#3F6F4B]" : "bg-white border-[#DAD3C4] hover:border-[#3F6F4B]/40"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {meals.map((m) => (
          <button key={m} onClick={() => setMealFilter(m)}
            className={`px-3.5 py-1.5 rounded-full text-sm whitespace-nowrap border transition ${mealFilter === m ? "bg-[#23201B] text-[#F6F3EC] border-[#23201B]" : "bg-white border-[#DAD3C4] hover:border-[#23201B]/40"}`}>
            {m}
          </button>
        ))}
      </div>

      {recipes.length === 0 ? (
        <div className="text-center py-16 text-[#6B655A]">
          <p className="mb-4">Здесь пока нет рецептов.</p>
          <button onClick={onCreate} className="px-5 py-2.5 rounded-lg bg-[#3F6F4B] text-white font-medium hover:bg-[#345e3f]">Создать рецепт</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {recipes.map((r) => (
            <article key={r.id} className="group bg-white rounded-xl border border-[#DAD3C4] overflow-hidden hover:shadow-[0_6px_24px_-12px_rgba(35,32,27,0.4)] transition flex flex-col">
              {r.image && (
                <button onClick={() => onOpen(r.id)} className="block"><img src={r.image} alt="" onError={(e) => (e.currentTarget.style.display = "none")} className="w-full h-36 object-cover" /></button>
              )}
              <button onClick={() => onOpen(r.id)} className="text-left p-4 flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full border ${mealColor(r.meal)}`}>{r.meal}</span>
                  <VisBadge r={r} />
                </div>
                <h3 className="font-serif text-lg leading-snug mb-3 group-hover:text-[#3F6F4B] transition">{r.name}</h3>
                <div className="flex items-center gap-4 text-sm text-[#6B655A]">
                  <span className="flex items-center gap-1"><Clock size={14} /> {r.time || "—"} мин</span>
                  <span className="flex items-center gap-1"><Flame size={14} /> ~{recipeKcalPerServing(r)} ккал</span>
                  <span className="ml-auto text-xs">{r.ings.length} прод.</span>
                </div>
                {r.servings > 1 && <p className="mt-2 text-xs text-[#A8A192]">на {r.servings} порц.</p>}
              </button>
              <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-[#DAD3C4]">
                <Reactions r={r} onReact={onReact} />
                <button onClick={() => onAddAll(r)} className="flex items-center gap-1.5 text-sm font-medium text-[#3F6F4B] hover:underline">
                  <Plus size={16} /> В список
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function RecipeDetail({ recipe, surpriseMeal, onSurpriseAgain, onBack, onAddAll, onAddOne, onReact, onEdit, onDelete }) {
  const base = recipe.servings || 1; // на сколько порций заданы количества в рецепте
  const [servings, setServings] = useState(base);
  const [confirmDel, setConfirmDel] = useState(false);
  // При переходе к другому рецепту сбрасываем выбор порций на «родное» количество.
  useEffect(() => { setServings(base); }, [recipe.id, base]);
  const scaled = recipe.ings.map((i) => ({ ...i, amount: (i.amount * servings) / base }));

  return (
    <div>
      {onSurpriseAgain && (
        <div className="flex items-center justify-between gap-2 mb-4 px-3.5 py-2.5 rounded-xl bg-[#C24A38]/10 border border-[#C24A38]/30">
          <span className="flex items-center gap-1.5 text-sm text-[#C24A38]"><Dices size={15} /> Случайный выбор{surpriseMeal ? ` · ${surpriseMeal.toLowerCase()}` : ""}</span>
          <button onClick={onSurpriseAgain} className="flex items-center gap-1.5 text-sm font-medium text-white bg-[#C24A38] hover:bg-[#a83e2e] px-3 py-1.5 rounded-lg transition">
            <Dices size={15} /> Ещё вариант
          </button>
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[#6B655A] hover:text-[#23201B]"><ArrowLeft size={16} /> К рецептам</button>
        {recipe.canManage && (
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="flex items-center gap-1.5 text-sm text-[#6B655A] hover:text-[#23201B]"><Pencil size={15} /> Изменить</button>
            {confirmDel ? (
              <button onClick={onDelete} className="flex items-center gap-1.5 text-sm text-white bg-[#C24A38] px-2.5 py-1 rounded-md"><Trash2 size={15} /> Точно удалить?</button>
            ) : (
              <button onClick={() => setConfirmDel(true)} className="flex items-center gap-1.5 text-sm text-[#C24A38] hover:underline"><Trash2 size={15} /> Удалить</button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className={`inline-block text-xs px-2 py-0.5 rounded-full border ${mealColor(recipe.meal)}`}>{recipe.meal}</span>
        <VisBadge r={recipe} />
        {recipe.author && !recipe.isBase && <span className="text-xs text-[#A8A192]">автор: {recipe.author}</span>}
      </div>
      <h1 className="font-serif text-3xl leading-tight mb-3">{recipe.name}</h1>
      <div className="flex items-center gap-5 text-sm text-[#6B655A] mb-4">
        <span className="flex items-center gap-1.5"><Clock size={15} /> {recipe.time || "—"} мин</span>
        <span className="flex items-center gap-1.5"><Flame size={15} /> ~{recipeKcalPerServing(recipe)} ккал / порция</span>
      </div>

      <div className="mb-5"><Reactions r={recipe} onReact={onReact} size="lg" /></div>

      {recipe.image && <img src={recipe.image} alt="" onError={(e) => (e.currentTarget.style.display = "none")} className="w-full h-56 sm:h-64 object-cover rounded-xl border border-[#DAD3C4] mb-5" />}

      <div className="bg-white rounded-xl border border-[#DAD3C4] p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-lg">Нужные продукты</h2>
          <div className="flex items-center gap-2 bg-[#F6F3EC] rounded-lg border border-[#DAD3C4] px-1">
            <button onClick={() => setServings((s) => Math.max(1, s - 1))} disabled={servings <= 1} className="p-1.5 text-[#6B655A] hover:text-[#23201B] disabled:opacity-30"><Minus size={15} /></button>
            <span className="text-sm tabular-nums w-14 text-center">{servings} порц.</span>
            <button onClick={() => setServings((s) => Math.min(99, s + 1))} className="p-1.5 text-[#6B655A] hover:text-[#23201B]"><Plus size={15} /></button>
          </div>
        </div>

        <ul className="font-mono text-sm divide-y divide-[#EEE9DD]">
          {scaled.map((i) => (
            <li key={i.ingredient_id} className="flex items-baseline gap-2 py-2">
              <span>{i.name}</span>
              <span className="flex-1 border-b border-dotted border-[#23201B]/20 translate-y-[-3px]" />
              <span className="text-[#6B655A] tabular-nums">{fmtAmount(i.amount)} {i.unit}</span>
              <button onClick={() => onAddOne(i)} title="Добавить в список" className="ml-2 grid place-items-center w-6 h-6 rounded-md border border-[#DAD3C4] text-[#3F6F4B] hover:bg-[#3F6F4B] hover:text-white hover:border-[#3F6F4B] transition"><Plus size={14} /></button>
            </li>
          ))}
        </ul>

        <button onClick={() => onAddAll(scaled)} className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#3F6F4B] text-white font-medium hover:bg-[#345e3f] transition">
          <ShoppingBasket size={18} /> Добавить все продукты в список
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[#DAD3C4] p-4">
        <h2 className="font-serif text-lg mb-3">Приготовление</h2>
        {recipe.steps.length === 0 ? (
          <p className="text-sm text-[#A8A192]">Шаги не указаны.</p>
        ) : (
          <ol className="space-y-3">
            {recipe.steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed">
                <span className="shrink-0 grid place-items-center w-6 h-6 rounded-full bg-[#F6F3EC] border border-[#DAD3C4] font-mono text-xs">{i + 1}</span>
                <div className="pt-0.5 flex-1">
                  {s.text && <span className="whitespace-pre-wrap">{s.text}</span>}
                  {s.image && <img src={s.image} alt="" onError={(e) => (e.currentTarget.style.display = "none")} className="mt-2 max-h-56 rounded-lg border border-[#DAD3C4]" />}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
