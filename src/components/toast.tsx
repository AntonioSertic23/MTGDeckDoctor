"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

type ToastFn = (message: string, options?: { tone?: ToastTone; durationMs?: number }) => void;

const ToastContext = createContext<ToastFn | null>(null);

export function useToast(): ToastFn {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast must be used inside <ToastProvider>.");
  return toast;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback<ToastFn>(
    (message, options = {}) => {
      const id = nextId.current++;
      const tone = options.tone ?? "success";
      // Keep at most three on screen.
      setItems((current) => [...current.slice(-2), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), options.durationMs ?? (tone === "error" ? 6000 : 3000));
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:px-6"
      >
        {items.map((item) => {
          const Icon = item.tone === "error" ? CircleAlert : CheckCircle2;
          return (
            <div
              key={item.id}
              role={item.tone === "error" ? "alert" : "status"}
              className={cn(
                "pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border bg-[var(--card)] px-3.5 py-3 text-sm text-ink shadow-lg",
                item.tone === "error" ? "border-rose-500/40" : "border-[var(--border)]",
              )}
            >
              <Icon
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0",
                  item.tone === "error"
                    ? "text-rose-600 dark:text-rose-400"
                    : item.tone === "success"
                      ? "text-accent-strong"
                      : "text-muted",
                )}
                aria-hidden
              />
              <p className="min-w-0 flex-1 leading-snug">{item.message}</p>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="-m-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted hover:text-ink"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
