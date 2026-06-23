import React from "react";
import { Trash2, Check, X, ListChecks } from "lucide-react";
import { fmtAmount } from "./ui.js";

export default function Shopping({ items, groups, onToggle, onRemove, onClear, onBrowse }) {
  const count = items.length;
  const checkedCount = items.filter((i) => i.checked).length;

  if (count === 0) {
    return (
      <div className="text-center py-20">
        <div className="inline-grid place-items-center w-16 h-16 rounded-full bg-surface border border-line mb-4"><ListChecks size={28} className="text-muted" /></div>
        <h2 className="font-serif text-xl mb-2">Список пуст</h2>
        <p className="text-muted mb-5">Откройте рецепт и добавьте продукты — они появятся здесь у всей семьи.</p>
        <button onClick={onBrowse} className="px-5 py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-primary-700 transition">К рецептам</button>
      </div>
    );
  }

  const grouped = groups
    .map((g) => [g, items.filter((i) => i.group === g)])
    .filter(([, arr]) => arr.length);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-serif text-2xl">Список покупок</h1>
          <p className="text-sm text-muted mt-0.5">{checkedCount} из {count} куплено · общий для семьи</p>
        </div>
        <button onClick={onClear} className="flex items-center gap-1.5 text-sm text-danger hover:underline"><Trash2 size={15} /> Очистить</button>
      </div>

      <div className="bg-surface rounded-xl border border-line overflow-hidden">
        {grouped.map(([group, arr], gi) => (
          <div key={group} className={gi > 0 ? "border-t border-line" : ""}>
            <div className="px-4 py-2 bg-paper text-xs font-medium tracking-wide uppercase text-muted">{group}</div>
            <ul className="font-mono text-sm">
              {arr.map((it) => (
                <li key={it.id} className="flex items-center gap-3 px-4 py-2.5 border-t border-line-soft first:border-t-0">
                  <button onClick={() => onToggle(it)} className={`shrink-0 grid place-items-center w-5 h-5 rounded-md border transition ${it.checked ? "bg-primary border-primary text-white" : "border-line-strong hover:border-primary"}`}>{it.checked ? <Check size={14} /> : null}</button>
                  <span className={it.checked ? "line-through text-muted-soft" : ""}>{it.name}</span>
                  <span className="flex-1 border-b border-dotted border-ink/15 translate-y-[-3px]" />
                  <span className={`tabular-nums ${it.checked ? "text-muted-soft" : "text-muted"}`}>{fmtAmount(it.amount)} {it.unit}</span>
                  <button onClick={() => onRemove(it)} className="shrink-0 text-line-strong hover:text-danger transition"><X size={16} /></button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-soft mt-3 text-center">Одинаковые продукты из разных рецептов суммируются автоматически.</p>
    </div>
  );
}
