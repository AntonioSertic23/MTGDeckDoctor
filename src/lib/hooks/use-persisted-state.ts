"use client";

import { useEffect, useState } from "react";

/**
 * Persists a string preference in localStorage. Initial render uses `defaultValue`
 * to avoid SSR/client hydration mismatches; saved value loads on mount.
 */
export function usePersistedState<T extends string>(
  key: string,
  defaultValue: T,
  isValid: (value: string) => value is T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(defaultValue);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved && isValid(saved)) setValue(saved);
    } catch {
      // Private browsing / blocked storage — keep default.
    }
  }, [key, isValid]);

  useEffect(() => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Ignore write failures.
    }
  }, [key, value]);

  return [value, setValue];
}
