import React, { useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { getPreference, setPreference, THEME_OPTIONS } from "./theme.js";

const ICON = { light: Sun, dark: Moon, system: Monitor };
const LABEL = { light: "Светлая тема", dark: "Тёмная тема", system: "Системная тема" };

export default function ThemeToggle({ className = "" }) {
  const [pref, setPref] = useState(getPreference());
  const Icon = ICON[pref];

  const cycle = () => {
    const next = THEME_OPTIONS[(THEME_OPTIONS.indexOf(pref) + 1) % THEME_OPTIONS.length];
    setPreference(next);
    setPref(next);
  };

  return (
    <button
      onClick={cycle}
      title={LABEL[pref]}
      aria-label={LABEL[pref]}
      className={`grid place-items-center w-10 h-10 rounded-lg hover:bg-surface text-muted transition ${className}`}
    >
      <Icon size={18} />
    </button>
  );
}
