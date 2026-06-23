import React, { useState, useEffect } from "react";
import {
  Shield, Ban, RotateCcw, Loader2, AlertTriangle, BarChart3, Users as UsersIcon,
  ScrollText, UserPlus, LogIn, Crown, ChefHat, PenLine, Trash2, RefreshCw,
} from "lucide-react";
import { api } from "./api.js";
import {
  ROLE_LABEL, roleBadge, ACTION_LABEL, actionTone, fmtDate, fmtRelative, fmtDateTime,
} from "./ui.js";

const TABS = [
  { id: "overview", label: "Обзор", icon: BarChart3 },
  { id: "users", label: "Пользователи", icon: UsersIcon },
  { id: "log", label: "Журнал", icon: ScrollText },
];

export default function Admin({ onFlash }) {
  const [tab, setTab] = useState("overview");

  return (
    <div>
      <h1 className="font-serif text-2xl mb-1 flex items-center gap-2"><Shield size={24} /> Управление</h1>
      <p className="text-sm text-muted mb-4">
        Статистика, участники и журнал действий — регистрации, входы, баны, операции с рецептами.
      </p>

      <div className="flex gap-1 mb-5 border-b border-line">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium -mb-px border-b-2 transition ${
              tab === t.id ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink"
            }`}>
            <t.icon size={16} /><span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview />}
      {tab === "users" && <UsersTab onFlash={onFlash} />}
      {tab === "log" && <ActivityLog />}
    </div>
  );
}

// ─────────────────────────  ОБЗОР  ─────────────────────────
function StatCard({ label, value, hint }) {
  return (
    <div className="bg-surface rounded-xl border border-line px-4 py-3">
      <div className="text-2xl font-serif tabular-nums">{value}</div>
      <div className="text-xs text-muted mt-0.5">{label}</div>
      {hint != null && <div className="text-[11px] text-muted-soft mt-0.5">{hint}</div>}
    </div>
  );
}

// Мини-гистограмма по дням (CSS-столбики, без зависимостей).
function SparkBars({ title, data, barClass }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const sum = data.reduce((s, d) => s + d.count, 0);
  return (
    <div className="bg-surface rounded-xl border border-line p-4">
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-soft">за 14 дней: <b className="text-ink">{sum}</b></span>
      </div>
      <div className="flex items-end gap-1 h-20">
        {data.map((d) => (
          <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full group relative">
            <div className={`w-full rounded-t ${barClass} ${d.count ? "" : "opacity-25"}`}
              style={{ height: `${Math.max(3, (d.count / max) * 100)}%` }} />
            <div className="absolute -top-6 hidden group-hover:block whitespace-nowrap text-[11px] px-1.5 py-0.5 rounded bg-ink text-paper z-10">
              {fmtDate(d.date)}: {d.count}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Overview() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.adminStats().then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-danger flex items-center gap-1.5"><AlertTriangle size={15} /> {error}</p>;
  if (!stats) return <div className="grid place-items-center py-16"><Loader2 className="animate-spin text-primary" /></div>;

  const { totals, active } = stats;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Пользователей" value={totals.users} hint={`активны за сутки: ${active.day}`} />
        <StatCard label="Семей" value={totals.families} />
        <StatCard label="Рецептов" value={totals.recipes} hint={`+${totals.baseRecipes} базовых`} />
        <StatCard label="Забанено" value={totals.banned} hint={`IP в бане: ${totals.bannedIps}`} />
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="bg-surface rounded-xl border border-line px-4 py-3">
          <div className="text-xs text-muted mb-2 uppercase tracking-wide">Активность</div>
          <ul className="text-sm space-y-1.5">
            <li className="flex justify-between"><span className="text-muted">За сутки</span><b className="tabular-nums">{active.day}</b></li>
            <li className="flex justify-between"><span className="text-muted">За неделю</span><b className="tabular-nums">{active.week}</b></li>
            <li className="flex justify-between"><span className="text-muted">За месяц</span><b className="tabular-nums">{active.month}</b></li>
          </ul>
        </div>
        <div className="sm:col-span-2 grid gap-3">
          <SparkBars title="Регистрации" data={stats.registrations} barClass="bg-mint" />
        </div>
      </div>

      <SparkBars title="Входы" data={stats.logins} barClass="bg-primary" />

      <div className="bg-surface rounded-xl border border-line p-4">
        <div className="text-sm font-medium mb-3">События в журнале</div>
        {stats.actionCounts.length === 0 ? (
          <p className="text-sm text-muted-soft">Журнал пока пуст.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {stats.actionCounts.map((a) => (
              <span key={a.action} className={`text-xs px-2.5 py-1 rounded-full border ${actionTone(a.action)}`}>
                {ACTION_LABEL[a.action] || a.action}: <b>{a.c}</b>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────  ПОЛЬЗОВАТЕЛИ  ─────────────────────────
function UsersTab({ onFlash }) {
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

  if (error && !data) return <p className="text-danger">{error}</p>;
  if (!data) return <div className="grid place-items-center py-16"><Loader2 className="animate-spin text-primary" /></div>;

  const isAdmin = data.me.role === "admin";
  const canActOn = (u) => {
    if (u.id === data.me.id) return false;
    if (isAdmin) return true;
    return u.role === "user"; // модератор — только обычные пользователи
  };

  return (
    <div>
      <p className="text-xs text-muted mb-3">
        Бан по аккаунту блокирует и все известные IP пользователя. Всего: {data.users.length}.
      </p>
      {error && <p className="text-sm text-danger mb-3 flex items-center gap-1.5"><AlertTriangle size={15} /> {error}</p>}

      <div className="bg-surface rounded-xl border border-line overflow-hidden">
        <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2 bg-paper text-xs font-medium uppercase tracking-wide text-muted">
          <span>Пользователь</span><span>Роль</span><span>Активность</span><span>Действия</span>
        </div>
        <ul className="divide-y divide-line-soft">
          {data.users.map((u) => (
            <li key={u.id} className="px-4 py-3 grid sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-center">
              <div className="min-w-0">
                <div className="text-sm font-medium flex items-center gap-2">
                  {u.name}{u.id === data.me.id && <span className="text-xs text-muted-soft">(вы)</span>}
                  {u.banned ? <span className="text-xs px-2 py-0.5 rounded-full bg-danger text-white">бан</span> : null}
                </div>
                <div className="text-xs text-muted-soft truncate">{u.email} · {u.family || "—"}</div>
                <div className="text-[11px] text-muted-soft mt-0.5">
                  рег. {fmtDate(u.created_at)} · рецептов: {u.recipe_count} · IP: {u.ip_count}
                </div>
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

              <div className="text-xs text-muted-soft">
                <div title={u.last_ip || ""} className="font-mono">{u.last_ip || "—"}</div>
                <div>{u.last_seen ? fmtRelative(u.last_seen) : "не входил"}</div>
              </div>

              <div className="flex justify-end">
                {canActOn(u) ? (
                  busyId === u.id ? (
                    <Loader2 size={16} className="animate-spin text-muted" />
                  ) : u.banned ? (
                    <button onClick={() => act(() => api.adminUnban(u.id), u.id)}
                      className="flex items-center gap-1.5 text-sm text-primary hover:underline"><RotateCcw size={15} /> Разбанить</button>
                  ) : (
                    <button onClick={() => act(() => api.adminBan(u.id), u.id)}
                      className="flex items-center gap-1.5 text-sm text-danger hover:underline"><Ban size={15} /> Забанить</button>
                  )
                ) : (
                  <span className="text-xs text-line-strong">—</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─────────────────────────  ЖУРНАЛ  ─────────────────────────
const ACTION_ICON = {
  register: UserPlus, login: LogIn, login_fail: AlertTriangle, login_blocked: Ban,
  ban: Ban, unban: RotateCcw, role_change: Crown,
  recipe_create: ChefHat, recipe_update: PenLine, recipe_delete: Trash2,
  family_create: UsersIcon, family_join: UsersIcon,
};

// Дополнительная подпись по метаданным события.
function metaText(e) {
  const m = e.meta || {};
  if (e.action === "role_change" && m.to) return `${ROLE_LABEL[m.from] || m.from || "?"} → ${ROLE_LABEL[m.to] || m.to}`;
  if (e.action === "ban" && m.ips != null) return `заблокировано IP: ${m.ips}`;
  if (e.action === "login_fail" && m.email) return m.email;
  if ((e.action === "recipe_update" || e.action === "recipe_delete") && m.moderated) return "модерация чужого/базового";
  return null;
}

const FILTERS = [
  { value: "", label: "Все события" },
  { value: "register", label: "Регистрации" },
  { value: "login", label: "Входы" },
  { value: "login_fail", label: "Неудачные входы" },
  { value: "ban", label: "Баны" },
  { value: "unban", label: "Разбаны" },
  { value: "role_change", label: "Смены ролей" },
  { value: "recipe_create", label: "Создание рецептов" },
  { value: "recipe_update", label: "Правка рецептов" },
  { value: "recipe_delete", label: "Удаление рецептов" },
];

const PAGE = 50;

function ActivityLog() {
  const [filter, setFilter] = useState("");
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (action, offset) => {
    setLoading(true); setError("");
    try {
      const res = await api.adminLog({ action, limit: PAGE, offset });
      setEntries((prev) => (offset ? [...prev, ...res.entries] : res.entries));
      setTotal(res.total);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(filter, 0); }, [filter]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-lg border border-line bg-surface focus:outline-none focus:border-primary/50">
          {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <button onClick={() => load(filter, 0)} title="Обновить"
          className="grid place-items-center w-9 h-9 rounded-lg border border-line bg-surface hover:border-primary/50 text-muted">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
        <span className="text-xs text-muted-soft ml-auto">всего записей: {total}</span>
      </div>

      {error && <p className="text-sm text-danger mb-3 flex items-center gap-1.5"><AlertTriangle size={15} /> {error}</p>}

      {entries.length === 0 && !loading ? (
        <div className="bg-surface rounded-xl border border-line py-12 text-center text-sm text-muted-soft">
          Событий пока нет.
        </div>
      ) : (
        <ul className="bg-surface rounded-xl border border-line divide-y divide-line-soft overflow-hidden">
          {entries.map((e) => {
            const Icon = ACTION_ICON[e.action] || ScrollText;
            const detail = metaText(e);
            return (
              <li key={e.id} className="px-4 py-2.5 flex items-start gap-3">
                <span className={`grid place-items-center w-7 h-7 shrink-0 rounded-full border ${actionTone(e.action)}`}>
                  <Icon size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm">
                    <span className="font-medium">{ACTION_LABEL[e.action] || e.action}</span>
                    {e.actor_name && <span className="text-muted"> · {e.actor_name}</span>}
                    {e.target_name && e.target_name !== e.actor_name && (
                      <span className="text-muted"> → {e.target_name}</span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-soft flex flex-wrap gap-x-2">
                    {detail && <span>{detail}</span>}
                    {e.ip && <span className="font-mono">{e.ip}</span>}
                  </div>
                </div>
                <time title={fmtDateTime(e.created_at)} className="text-[11px] text-muted-soft shrink-0 whitespace-nowrap">
                  {fmtRelative(e.created_at)}
                </time>
              </li>
            );
          })}
        </ul>
      )}

      {entries.length < total && (
        <div className="text-center mt-4">
          <button onClick={() => load(filter, entries.length)} disabled={loading}
            className="text-sm text-primary hover:underline disabled:opacity-50">
            {loading ? "Загрузка…" : `Показать ещё (${total - entries.length})`}
          </button>
        </div>
      )}
    </div>
  );
}
