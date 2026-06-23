import React, { useState, useEffect } from "react";
import { Clock, Flame, Plus, ShoppingBasket, ArrowLeft, Minus, Pencil, Trash2, ThumbsUp, ThumbsDown, Lock, Globe, Dices, X } from "lucide-react";
import { recipeKcalPerServing, fmtAmount, mealColor, thumbUrl } from "./ui.js";

function WhatToEat({ onSurprise }) {
  const [open, setOpen] = useState(false);
  const choices = ["Завтрак", "Обед", "Ужин"];
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 mb-4 px-4 py-3 rounded-xl bg-danger text-white font-medium shadow-[0_6px_20px_-10px_rgba(194,74,56,0.9)] hover:bg-danger-700 transition">
        <Dices size={18} /> Не знаю что поесть
      </button>

      {open && (
        <div className="fixed inset-0 z-40 grid place-items-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm bg-paper rounded-2xl border border-line shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-1">
              <h3 className="font-serif text-xl">Что приготовить?</h3>
              <button onClick={() => setOpen(false)} className="grid place-items-center w-8 h-8 -mr-2 -mt-1 rounded-lg text-muted hover:bg-surface"><X size={18} /></button>
            </div>
            <p className="text-sm text-muted mb-5">Выберите приём пищи — подберём случайный рецепт из семейных и публичных.</p>
            <div className="grid gap-2.5">
              {choices.map((m) => (
                <button key={m} onClick={() => { setOpen(false); onSurprise(m); }}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border text-left font-medium transition hover:border-primary hover:bg-surface ${mealColor(m)}`}>
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
  if (r.isBase) return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-line bg-surface text-muted">Каталог</span>;
  if (r.visibility === "public")
    return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-primary/35 bg-primary/10 text-primary-800"><Globe size={12} /> Публичный</span>;
  return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-danger/40 bg-danger/10 text-danger"><Lock size={12} /> Семейный</span>;
}

function Reactions({ r, onReact, size = "sm" }) {
  const pad = size === "lg" ? "px-3 py-2 text-sm" : "px-2 py-1 text-xs";
  const ic = size === "lg" ? 18 : 15;
  const toggle = (v) => onReact(r, r.myReaction === v ? 0 : v);
  return (
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <button onClick={() => toggle(1)}
        className={`flex items-center gap-1.5 rounded-lg border transition ${pad} ${r.myReaction === 1 ? "bg-primary border-primary text-white" : "bg-surface border-line text-muted hover:border-primary"}`}>
        <ThumbsUp size={ic} /> <span className="tabular-nums">{r.likes}</span>
      </button>
      <button onClick={() => toggle(-1)}
        className={`flex items-center gap-1.5 rounded-lg border transition ${pad} ${r.myReaction === -1 ? "bg-danger border-danger text-white" : "bg-surface border-line text-muted hover:border-danger"}`}>
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
            className={`px-3.5 py-1.5 rounded-full text-sm whitespace-nowrap border transition ${scope === id ? "bg-primary text-white border-primary" : "bg-surface border-line hover:border-primary/40"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {meals.map((m) => (
          <button key={m} onClick={() => setMealFilter(m)}
            className={`px-3.5 py-1.5 rounded-full text-sm whitespace-nowrap border transition ${mealFilter === m ? "bg-ink text-paper border-ink" : "bg-surface border-line hover:border-ink/40"}`}>
            {m}
          </button>
        ))}
      </div>

      {recipes.length === 0 ? (
        <div className="text-center py-16 text-muted">
          <p className="mb-4">Здесь пока нет рецептов.</p>
          <button onClick={onCreate} className="px-5 py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-primary-700">Создать рецепт</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {recipes.map((r) => (
            <article key={r.id} className="group bg-surface rounded-xl border border-line overflow-hidden hover:shadow-[0_6px_24px_-12px_rgba(35,32,27,0.4)] transition flex flex-col">
              {r.image && (
                <button onClick={() => onOpen(r.id)} className="block"><img src={thumbUrl(r.image)} data-full={r.image} alt="" loading="lazy" decoding="async" onError={(e) => { const el = e.currentTarget; if (!el.dataset.fellBack && el.dataset.full && el.dataset.full !== thumbUrl(r.image)) { el.dataset.fellBack = "1"; el.src = el.dataset.full; } else el.style.display = "none"; }} className="w-full h-36 object-cover" /></button>
              )}
              <button onClick={() => onOpen(r.id)} className="text-left p-4 flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full border ${mealColor(r.meal)}`}>{r.meal}</span>
                  <VisBadge r={r} />
                </div>
                <h3 className="font-serif text-lg leading-snug mb-3 group-hover:text-primary transition">{r.name}</h3>
                <div className="flex items-center gap-4 text-sm text-muted">
                  <span className="flex items-center gap-1"><Clock size={14} /> {r.time || "—"} мин</span>
                  <span className="flex items-center gap-1"><Flame size={14} /> ~{recipeKcalPerServing(r)} ккал</span>
                  <span className="ml-auto text-xs">{r.ings.length} прод.</span>
                </div>
                {r.servings > 1 && <p className="mt-2 text-xs text-muted-soft">на {r.servings} порц.</p>}
              </button>
              <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-line">
                <Reactions r={r} onReact={onReact} />
                <button onClick={() => onAddAll(r)} className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
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
        <div className="flex items-center justify-between gap-2 mb-4 px-3.5 py-2.5 rounded-xl bg-danger/10 border border-danger/30">
          <span className="flex items-center gap-1.5 text-sm text-danger"><Dices size={15} /> Случайный выбор{surpriseMeal ? ` · ${surpriseMeal.toLowerCase()}` : ""}</span>
          <button onClick={onSurpriseAgain} className="flex items-center gap-1.5 text-sm font-medium text-white bg-danger hover:bg-danger-700 px-3 py-1.5 rounded-lg transition">
            <Dices size={15} /> Ещё вариант
          </button>
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft size={16} /> К рецептам</button>
        {recipe.canManage && (
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="flex items-center gap-1.5 text-sm text-muted hover:text-ink"><Pencil size={15} /> Изменить</button>
            {confirmDel ? (
              <button onClick={onDelete} className="flex items-center gap-1.5 text-sm text-white bg-danger px-2.5 py-1 rounded-md"><Trash2 size={15} /> Точно удалить?</button>
            ) : (
              <button onClick={() => setConfirmDel(true)} className="flex items-center gap-1.5 text-sm text-danger hover:underline"><Trash2 size={15} /> Удалить</button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className={`inline-block text-xs px-2 py-0.5 rounded-full border ${mealColor(recipe.meal)}`}>{recipe.meal}</span>
        <VisBadge r={recipe} />
        {recipe.author && !recipe.isBase && <span className="text-xs text-muted-soft">автор: {recipe.author}</span>}
      </div>
      <h1 className="font-serif text-3xl leading-tight mb-3">{recipe.name}</h1>
      <div className="flex items-center gap-5 text-sm text-muted mb-4">
        <span className="flex items-center gap-1.5"><Clock size={15} /> {recipe.time || "—"} мин</span>
        <span className="flex items-center gap-1.5"><Flame size={15} /> ~{recipeKcalPerServing(recipe)} ккал / порция</span>
      </div>

      <div className="mb-5"><Reactions r={recipe} onReact={onReact} size="lg" /></div>

      {recipe.image && <img src={recipe.image} alt="" loading="lazy" decoding="async" onError={(e) => (e.currentTarget.style.display = "none")} className="w-full h-56 sm:h-64 object-cover rounded-xl border border-line mb-5" />}

      <div className="bg-surface rounded-xl border border-line p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-lg">Нужные продукты</h2>
          <div className="flex items-center gap-2 bg-paper rounded-lg border border-line px-1">
            <button onClick={() => setServings((s) => Math.max(1, s - 1))} disabled={servings <= 1} className="p-1.5 text-muted hover:text-ink disabled:opacity-30"><Minus size={15} /></button>
            <span className="text-sm tabular-nums w-14 text-center">{servings} порц.</span>
            <button onClick={() => setServings((s) => Math.min(99, s + 1))} className="p-1.5 text-muted hover:text-ink"><Plus size={15} /></button>
          </div>
        </div>

        <ul className="font-mono text-sm divide-y divide-line-soft">
          {scaled.map((i) => (
            <li key={i.ingredient_id} className="flex items-baseline gap-2 py-2">
              <span>{i.name}</span>
              <span className="flex-1 border-b border-dotted border-ink/20 translate-y-[-3px]" />
              <span className="text-muted tabular-nums">{fmtAmount(i.amount)} {i.unit}</span>
              <button onClick={() => onAddOne(i)} title="Добавить в список" className="ml-2 grid place-items-center w-6 h-6 rounded-md border border-line text-primary hover:bg-primary hover:text-white hover:border-primary transition"><Plus size={14} /></button>
            </li>
          ))}
        </ul>

        <button onClick={() => onAddAll(scaled)} className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-primary-700 transition">
          <ShoppingBasket size={18} /> Добавить все продукты в список
        </button>
      </div>

      <div className="bg-surface rounded-xl border border-line p-4">
        <h2 className="font-serif text-lg mb-3">Приготовление</h2>
        {recipe.steps.length === 0 ? (
          <p className="text-sm text-muted-soft">Шаги не указаны.</p>
        ) : (
          <ol className="space-y-3">
            {recipe.steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed">
                <span className="shrink-0 grid place-items-center w-6 h-6 rounded-full bg-paper border border-line font-mono text-xs">{i + 1}</span>
                <div className="pt-0.5 flex-1">
                  {s.text && <span className="whitespace-pre-wrap">{s.text}</span>}
                  {s.image && <img src={s.image} alt="" loading="lazy" decoding="async" onError={(e) => (e.currentTarget.style.display = "none")} className="mt-2 max-h-56 rounded-lg border border-line" />}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
