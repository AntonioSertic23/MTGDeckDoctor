"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  applyTheme,
  readThemePreference,
  saveThemePreference,
  type ThemePreference,
} from "@/lib/theme";

const ORDER: ThemePreference[] = ["system", "light", "dark"];

const LABEL: Record<ThemePreference, string> = {
  system: "Theme: system",
  light: "Theme: light",
  dark: "Theme: dark",
};

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setPreference(next: ThemePreference) {
  saveThemePreference(next);
  for (const listener of listeners) listener();
}

/** Cycles System → Light → Dark. */
export function ThemeToggle() {
  const preference = useSyncExternalStore(subscribe, readThemePreference, () => "system" as const);

  // Follow OS changes while on "system".
  useEffect(() => {
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  const Icon = preference === "dark" ? Moon : preference === "light" ? Sun : Monitor;
  const next = ORDER[(ORDER.indexOf(preference) + 1) % ORDER.length];

  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-black/5 hover:text-ink dark:hover:bg-white/5"
      aria-label={`${LABEL[preference]}. Switch to ${next}.`}
      title={LABEL[preference]}
    >
      <Icon className="h-4.5 w-4.5" aria-hidden />
    </button>
  );
}
