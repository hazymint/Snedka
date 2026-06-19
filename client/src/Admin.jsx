import React, { useState, useEffect } from "react";
import { Shield, Ban, RotateCcw, Loader2, AlertTriangle } from "lucide-react";
import { api } from "./api.js";
import { ROLE_LABEL, roleBadge } from "./ui.js";

export default function Admin({ onFlash }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    try { setData(await api.adminUsers()); }
    catch (e) { setError(e.message); }
  };
  useEffect(() => { load(); }, []);

  const act = async (fn, id) => {
    setBusyId(id); setError("");
    try { await fn(); await load(); }
    catch (e) { setError(e.message); }
    finally { setBusyId(null); }
  };

  if (error && !data) return <p className="text-[#C24A38]">{error}</p>;
  if (!data) return <div className="grid place-items-center py-20"><Loader2 className="animate-spin text-[#3F6F4B]" /></div>;

  const meRole = data.me.role;
  const isAdmin = meRole === "admin";
  const canActOn = (u) => {
    if (u.id === data.me.id) return false;
    if (isAdmin) return true;
    return u.role === "user"; // модератор — только обычные пользователи
  };

  return (
    <div>
      <h1 className="font-serif text-2xl mb-1 flex items-center gap-2"><Shield size={24} /> Управление</h1>
      <p className="text-sm text-[#6B655A] mb-5">
        Вы вошли как {ROLE_LABEL[meRole].toLowerCase()}. Бан по аккаунту блокирует и все известные IP пользователя.
      </p>

      {error && <p className="text-sm text-[#C24A38] mb-3 flex items-center gap-1.5"><AlertTriangle size={15} /> {error}</p>}

      <div className="bg-white rounded-xl border border-[#DAD3C4] overflow-hidden">
        <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2 bg-[#F6F3EC] text-xs font-medium uppercase tracking-wide text-[#6B655A]">
          <span>Пользователь</span><span>Роль</span><span>IP</span><span>Действия</span>
        </div>
        <ul className="divide-y divide-[#EEE9DD]">
          {data.users.map((u) => (
            <li key={u.id} className="px-4 py-3 grid sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-center">
              <div className="min-w-0">
                <div className="text-sm font-medium flex items-center gap-2">
                  {u.name}{u.id === data.me.id && <span className="text-xs text-[#A8A192]">(вы)</span>}
                  {u.banned ? <span className="text-xs px-2 py-0.5 rounded-full bg-[#C24A38] text-white">бан</span> : null}
                </div>
                <div className="text-xs text-[#A8A192] truncate">{u.email} · {u.family || "—"}</div>
              </div>

              <div>
                {isAdmin && u.id !== data.me.id ? (
                  <select value={u.role} disabled={busyId === u.id}
                    onChange={(e) => act(() => api.adminRole(u.id, e.target.value), u.id)}
                    className={`text-xs px-2 py-1 rounded-full border ${roleBadge(u.role)} focus:outline-none`}>
                    <option value="user">Пользователь</option>
                    <option value="moderator">Модератор</option>
                    <option value="admin">Админ</option>
                  </select>
                ) : (
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${roleBadge(u.role)}`}>{ROLE_LABEL[u.role]}</span>
                )}
              </div>

              <div className="text-xs font-mono text-[#A8A192]">{u.last_ip || "—"}</div>

              <div className="flex justify-end">
                {canActOn(u) ? (
                  busyId === u.id ? (
                    <Loader2 size={16} className="animate-spin text-[#6B655A]" />
                  ) : u.banned ? (
                    <button onClick={() => act(() => api.adminUnban(u.id), u.id)}
                      className="flex items-center gap-1.5 text-sm text-[#3F6F4B] hover:underline"><RotateCcw size={15} /> Разбанить</button>
                  ) : (
                    <button onClick={() => act(() => api.adminBan(u.id), u.id)}
                      className="flex items-center gap-1.5 text-sm text-[#C24A38] hover:underline"><Ban size={15} /> Забанить</button>
                  )
                ) : (
                  <span className="text-xs text-[#C4BCA9]">—</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
