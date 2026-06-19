import React from "react";
import { Trash2, Check, X, ListChecks } from "lucide-react";
import { fmtAmount } from "./ui.js";

export default function Shopping({ items, groups, onToggle, onRemove, onClear, onBrowse }) {
  const count = items.length;
  const checkedCount = items.filter((i) => i.checked).length;

  if (count === 0) {
    return (
      <div className="text-center py-20">
        <div className="inline-grid place-items-center w-16 h-16 rounded-full bg-white border border-[#DAD3C4] mb-4"><ListChecks size={28} className="text-[#6B655A]" /></div>
        <h2 className="font-serif text-xl mb-2">Список пуст</h2>
        <p className="text-[#6B655A] mb-5">Откройте рецепт и добавьте продукты — они появятся здесь у всей семьи.</p>
        <button onClick={onBrowse} className="px-5 py-2.5 rounded-lg bg-[#3F6F4B] text-white font-medium hover:bg-[#345e3f] transition">К рецептам</button>
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
          <p className="text-sm text-[#6B655A] mt-0.5">{checkedCount} из {count} куплено · общий для семьи</p>
        </div>
        <button onClick={onClear} className="flex items-center gap-1.5 text-sm text-[#C24A38] hover:underline"><Trash2 size={15} /> Очистить</button>
      </div>

      <div className="bg-white rounded-xl border border-[#DAD3C4] overflow-hidden">
        {grouped.map(([group, arr], gi) => (
          <div key={group} className={gi > 0 ? "border-t border-[#DAD3C4]" : ""}>
            <div className="px-4 py-2 bg-[#F6F3EC] text-xs font-medium tracking-wide uppercase text-[#6B655A]">{group}</div>
            <ul className="font-mono text-sm">
              {arr.map((it) => (
                <li key={it.id} className="flex items-center gap-3 px-4 py-2.5 border-t border-[#EEE9DD] first:border-t-0">
                  <button onClick={() => onToggle(it)} className={`shrink-0 grid place-items-center w-5 h-5 rounded-md border transition ${it.checked ? "bg-[#3F6F4B] border-[#3F6F4B] text-white" : "border-[#C4BCA9] hover:border-[#3F6F4B]"}`}>{it.checked ? <Check size={14} /> : null}</button>
                  <span className={it.checked ? "line-through text-[#A8A192]" : ""}>{it.name}</span>
                  <span className="flex-1 border-b border-dotted border-[#23201B]/15 translate-y-[-3px]" />
                  <span className={`tabular-nums ${it.checked ? "text-[#A8A192]" : "text-[#6B655A]"}`}>{fmtAmount(it.amount)} {it.unit}</span>
                  <button onClick={() => onRemove(it)} className="shrink-0 text-[#C4BCA9] hover:text-[#C24A38] transition"><X size={16} /></button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="text-xs text-[#A8A192] mt-3 text-center">Одинаковые продукты из разных рецептов суммируются автоматически.</p>
    </div>
  );
}
