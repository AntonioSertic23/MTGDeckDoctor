"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  layout = "split",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** `stacked` keeps the title on its own full-width row so long names wrap across the page. */
  layout?: "split" | "stacked";
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-3 sm:mb-8",
        layout === "split" && "sm:flex-row sm:items-end sm:justify-between",
      )}
    >
      <div className="min-w-0 w-full space-y-1.5">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-strong">
            {eyebrow}
          </p>
        ) : null}
        <h1
          className={cn(
            "font-[family-name:var(--font-display)] font-semibold tracking-tight text-ink dark:text-white",
            layout === "stacked"
              ? "w-full text-left text-2xl leading-tight sm:text-3xl"
              : "text-3xl sm:text-4xl",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-ink-muted sm:text-base">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={cn("card-surface rounded-2xl p-4 sm:p-5", className)}>{children}</section>;
}

const buttonVariants = {
  // Dark-mode accent is a light teal, so it needs dark text for contrast.
  primary: "bg-accent text-white hover:bg-accent-strong dark:text-[var(--background)]",
  secondary:
    "border border-[var(--border)] bg-[var(--card)] text-ink hover:bg-black/[0.03] dark:hover:bg-white/[0.04]",
  ghost: "text-muted hover:bg-black/[0.04] hover:text-ink dark:hover:bg-white/[0.05]",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
} as const;

export type ButtonVariant = keyof typeof buttonVariants;

export function buttonClassName(variant: ButtonVariant = "primary", className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
    buttonVariants[variant],
    className,
  );
}

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
}) {
  return (
    <button className={buttonClassName(variant, className)} {...props}>
      {children}
    </button>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Panel className="flex flex-col items-start gap-3 py-10 text-left sm:items-center sm:py-14 sm:text-center">
      <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink">{title}</h2>
      <p className="max-w-md text-sm leading-relaxed text-ink-muted">{description}</p>
      {action}
    </Panel>
  );
}

export function StatChip({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  /** Small secondary line, e.g. "3 cards without a price". */
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{value}</div>
      {hint ? <div className="text-[11px] leading-tight text-muted">{hint}</div> : null}
    </div>
  );
}

export const selectClassName =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm outline-none ring-accent focus:ring-2";

export const inputClassName =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm outline-none ring-accent focus:ring-2 disabled:opacity-60";

/** Labelled native select with the app's field styling. */
export function Select({
  label,
  wrapperClassName,
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  wrapperClassName?: string;
}) {
  return (
    <label className={cn("block w-full min-w-0 space-y-1.5", wrapperClassName)}>
      <span className="text-xs font-medium text-muted">{label}</span>
      <select className={cn(selectClassName, className)} {...props}>
        {children}
      </select>
    </label>
  );
}

/** Display-font section heading used at the top of panels. */
export function SectionTitle({
  children,
  description,
  size = "xl",
  className,
}: {
  children: React.ReactNode;
  description?: React.ReactNode;
  size?: "lg" | "xl";
  className?: string;
}) {
  return (
    <div className={className}>
      <h2
        className={cn(
          "font-[family-name:var(--font-display)] font-semibold",
          size === "xl" ? "text-xl" : "text-lg",
        )}
      >
        {children}
      </h2>
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
    </div>
  );
}

/** Pulsing placeholder block for loading states. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-xl bg-black/[0.06] dark:bg-white/[0.07]", className)}
    />
  );
}

export interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/**
 * Small dropdown menu. `trigger` receives the toggle props so callers control
 * how the button looks (an email address, a "⋯" icon, …).
 */
export function Menu({
  trigger,
  items,
  header,
  align = "right",
}: {
  trigger: (props: {
    "aria-expanded": boolean;
    "aria-haspopup": "menu";
    onClick: () => void;
  }) => React.ReactNode;
  items: MenuItem[];
  /** Optional extra content above the items. */
  header?: React.ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      {trigger({
        "aria-expanded": open,
        "aria-haspopup": "menu",
        onClick: () => setOpen((value) => !value),
      })}
      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute z-40 mt-1 min-w-44 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {header}
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={cn(
                "w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
                item.danger
                  ? "text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                  : "text-ink hover:bg-black/5 dark:hover:bg-white/5",
              )}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
