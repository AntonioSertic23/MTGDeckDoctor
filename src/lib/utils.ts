import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export type HealthStatus = "healthy" | "attention" | "observation" | "critical";

/** Playful statuses from PRD §39, kept clear rather than cute. */
export function healthStatus(score: number): HealthStatus {
  if (score >= 80) return "healthy";
  if (score >= 65) return "attention";
  if (score >= 45) return "observation";
  return "critical";
}

export const HEALTH_STATUS_LABEL: Record<HealthStatus, string> = {
  healthy: "Healthy",
  attention: "Needs attention",
  observation: "Under observation",
  critical: "Critical",
};

export const HEALTH_STATUS_TEXT: Record<HealthStatus, string> = {
  healthy: "text-emerald-600 dark:text-emerald-400",
  attention: "text-amber-600 dark:text-amber-400",
  observation: "text-orange-600 dark:text-orange-400",
  critical: "text-rose-600 dark:text-rose-400",
};

export const HEALTH_STATUS_BAR: Record<HealthStatus, string> = {
  healthy: "bg-emerald-500",
  attention: "bg-amber-500",
  observation: "bg-orange-500",
  critical: "bg-rose-500",
};

export const HEALTH_STATUS_SOFT_BG: Record<HealthStatus, string> = {
  healthy: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  attention: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  observation: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  critical: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function formatEur(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

export function cardEurPrice(card: { prices: { eur: string | null } } | undefined): number | null {
  if (!card?.prices.eur) return null;
  const value = Number.parseFloat(card.prices.eur);
  return Number.isFinite(value) ? value : null;
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(iso).toLocaleDateString();
}
