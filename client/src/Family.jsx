import React, { useState } from "react";
import { Users, Copy, Check, LogIn, Pencil, UserPlus } from "lucide-react";
import { api } from "./api.js";

export default function Family({ me, onUpdate, onFlash }) {
  const { family, members, user } = me;
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [editName, setEditName] = useState(false);
  const [famName, setFamName] = useState(family.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const copy = () => {
    navigator.clipboard?.writeText(family.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const join = async () => {
    if (!code.trim()) return;
    setBusy(true); setError("");
    try {
      const next = await api.joinFamily(code.trim());
      onUpdate(next);
      onFlash("Вы присоединились к семье");
      setCode("");
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const leave = async () => {
    setBusy(true); setError("");
    try {
      const next = await api.newFamily(`Семья ${user.username}`);
      onUpdate(next);
      onFlash("Создана новая семья");
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const rename = async () => {
    setBusy(true); setError("");
    try {
      const next = await api.renameFamily(famName.trim());
      onUpdate(next);
      setEditName(false);
      onFlash("Название обновлено");
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="max-w-lg">
      <h1 className="font-serif text-2xl mb-5 flex items-center gap-2"><Users size={24} /> Моя семья</h1>

      <div className="bg-surface rounded-xl border border-line p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          {editName ? (
            <div className="flex items-center gap-2 flex-1">
              <input value={famName} onChange={(e) => setFamName(e.target.value)} className="flex-1 px-3 py-1.5 rounded-lg border border-line bg-paper focus:outline-none focus:border-primary" />
              <button onClick={rename} disabled={busy} className="px-3 py-1.5 rounded-lg bg-primary text-white text-sm">Сохранить</button>
            </div>
          ) : (
            <>
              <h2 className="font-serif text-xl">{family.name}</h2>
              {family.isOwner && <button onClick={() => setEditName(true)} className="text-muted hover:text-ink"><Pencil size={16} /></button>}
            </>
          )}
        </div>

        <div className="text-sm text-muted mb-1.5">Код приглашения</div>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 rounded-lg bg-paper border border-line font-mono tracking-widest text-lg">{family.invite_code}</code>
          <button onClick={copy} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line hover:border-primary text-sm">
            {copied ? <><Check size={16} className="text-primary" /> Скопировано</> : <><Copy size={16} /> Копировать</>}
          </button>
        </div>
        <p className="text-xs text-muted-soft mt-2">Передайте код близким — они присоединятся к общим рецептам и списку покупок.</p>
      </div>

      <div className="bg-surface rounded-xl border border-line p-5 mb-4">
        <h3 className="font-medium mb-3 flex items-center gap-2"><UserPlus size={18} /> Участники ({members.length})</h3>
        <ul className="divide-y divide-line-soft">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2.5">
              <span className="grid place-items-center w-9 h-9 rounded-full bg-primary/10 text-primary font-medium">{m.username.charAt(0).toUpperCase()}</span>
              <div className="flex-1">
                <div className="text-sm font-medium">{m.username}{m.id === user.id && " · вы"}</div>
              </div>
              {m.id === family.owner_id && <span className="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent-700 border border-accent/40">владелец</span>}
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-surface rounded-xl border border-line p-5">
        <h3 className="font-medium mb-3 flex items-center gap-2"><LogIn size={18} /> Присоединиться к другой семье</h3>
        <div className="flex items-center gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Код приглашения"
            className="flex-1 px-3 py-2 rounded-lg border border-line bg-paper font-mono tracking-widest focus:outline-none focus:border-primary" />
          <button onClick={join} disabled={busy || !code.trim()} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-40">Войти</button>
        </div>
        {error && <p className="text-sm text-danger mt-2">{error}</p>}
        <p className="text-xs text-muted-soft mt-3">
          Сейчас вы в семье «{family.name}». При переходе вы покинете её.{" "}
          <button onClick={leave} className="text-danger hover:underline">Создать свою новую семью</button>
        </p>
      </div>
    </div>
  );
}
