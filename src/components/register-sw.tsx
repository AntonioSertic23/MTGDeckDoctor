"use client";

import { useEffect } from "react";

/** Registers the PWA service worker in production (needed for install prompts). */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      void navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.warn("Service worker registration failed:", error);
      });
    };

    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(register, { timeout: 4000 });
    } else {
      window.setTimeout(register, 1500);
    }
  }, []);

  return null;
}
