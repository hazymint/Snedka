import React, { useState } from "react";
import { ChefHat, Loader2 } from "lucide-react";
import { api, setToken } from "./api.js";

export default function Auth({ onAuthed }) {
  const [mode, setMode] = useState("login"); // login | register
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      const payload = mode === "login"
        ? await api.login({ email, password })
        : await api.register({ email, password, name });
      setToken(payload.token);
      onAuthed(payload);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="flex items-center gap-2">
            <span className="grid place-items-center w-10 h-10 rounded-lg bg-[#3F6F4B] text-[#F6F3EC]"><ChefHat size={22} /></span>
            <span className="font-serif text-2xl tracking-tight text-[#23201B]">Снедка</span>
          </div>
          <p className="text-sm text-[#6B655A]">Готовим всей семьёй — рецепты, меню и покупки в одном месте</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#DAD3C4] p-6">
          <div className="flex gap-1 p-1 mb-5 bg-[#F6F3EC] rounded-lg">
            {["login", "register"].map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(""); }}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition ${mode === m ? "bg-white shadow-sm text-[#23201B]" : "text-[#6B655A]"}`}>
                {m === "login" ? "Вход" : "Регистрация"}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {mode === "register" && (
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ваше имя"
                className="w-full px-3 py-2.5 rounded-lg border border-[#DAD3C4] bg-[#F6F3EC] focus:outline-none focus:border-[#3F6F4B]" />
            )}
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" autoComplete="email"
              className="w-full px-3 py-2.5 rounded-lg border border-[#DAD3C4] bg-[#F6F3EC] focus:outline-none focus:border-[#3F6F4B]" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Пароль"
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="w-full px-3 py-2.5 rounded-lg border border-[#DAD3C4] bg-[#F6F3EC] focus:outline-none focus:border-[#3F6F4B]" />

            {error && <p className="text-sm text-[#C24A38]">{error}</p>}

            <button onClick={submit} disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#3F6F4B] text-white font-medium hover:bg-[#345e3f] transition disabled:opacity-60">
              {busy && <Loader2 size={18} className="animate-spin" />}
              {mode === "login" ? "Войти" : "Создать аккаунт"}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-[#A8A192] mt-4">
          При регистрации создаётся ваша семья. Близких можно пригласить по коду — рецепты и список покупок станут общими.
        </p>
      </div>
    </div>
  );
}
