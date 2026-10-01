"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Activity, ChevronDown, Layers, Library, LogIn, Plus, Share2 } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-provider";
import { getStorageBackend } from "@/lib/storage";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/decks", label: "Decks", icon: Layers },
  { href: "/collection", label: "Collection", icon: Library },
  { href: "/shared", label: "Shared", icon: Share2 },
  { href: "/decks/new", label: "Import", icon: Plus },
] as const;

function navActive(href: string, pathname: string): boolean {
  if (href === "/decks") {
    return pathname === "/decks" || (/^\/decks\/.+/.test(pathname) && !pathname.startsWith("/decks/new"));
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { configured, loading, user, signOut } = useAuth();
  const backend = getStorageBackend();
  const isLogin = pathname === "/login";
  const needsAuth = configured && !loading && !user && !isLogin;

  useEffect(() => {
    if (needsAuth) router.replace("/login");
  }, [needsAuth, router]);

  if (configured && loading) {
    return (
      <div className="flex min-h-full items-center justify-center px-4">
        <p className="text-sm text-muted">Checking your account…</p>
      </div>
    );
  }

  if (needsAuth) {
    return (
      <div className="flex min-h-full items-center justify-center px-4">
        <p className="text-sm text-muted">Redirecting to sign in…</p>
      </div>
    );
  }

  const storageLabel = backend === "supabase" ? "Cloud" : "Local";

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_88%,transparent)] backdrop-blur-md">
        <div className="relative mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:h-16 sm:px-6">
          <Link href="/decks" className="group z-10 flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white shadow-sm transition group-hover:bg-accent-strong">
              <Activity className="h-4.5 w-4.5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-[family-name:var(--font-display)] text-lg font-semibold leading-tight tracking-tight text-ink">
                MTG Deck Doctor
              </span>
              <span className="hidden items-center gap-2 text-xs text-ink-muted sm:flex">
                <span>Take care of your decks.</span>
                <span
                  className="text-[10px] font-medium uppercase tracking-wide text-muted"
                  title={
                    backend === "supabase"
                      ? "Cloud storage"
                      : "Data stays in this browser (IndexedDB)"
                  }
                >
                  {storageLabel}
                </span>
              </span>
            </span>
          </Link>

          {!isLogin ? (
            <nav
              className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex"
              aria-label="Primary"
            >
              {NAV.map((item) => {
                const active = navActive(item.href, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-accent/10 text-accent-strong"
                        : "text-muted hover:bg-black/5 hover:text-ink dark:hover:bg-white/5",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          ) : null}

          <div className="z-10 ml-auto flex shrink-0 items-center">
            {configured && user ? (
              <AccountMenu
                email={user.email ?? "Account"}
                onSignOut={() => {
                  void signOut().then(() => router.replace("/login"));
                }}
              />
            ) : null}

            {configured && !user && !isLogin ? (
              <Link
                href="/login"
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-accent-strong hover:bg-accent/10"
              >
                <LogIn className="h-3.5 w-3.5" aria-hidden />
                Sign in
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-5 sm:px-6 sm:pt-8 md:pb-10">
        {children}
      </main>

      {!isLogin ? (
        <nav
          className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_92%,transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
          aria-label="Mobile"
        >
          <ul className="mx-auto grid max-w-lg grid-cols-4">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = navActive(item.href, pathname);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex flex-col items-center gap-0.5 px-2 py-2.5 text-[11px] font-medium transition-colors",
                      active ? "text-accent-strong" : "text-muted",
                    )}
                  >
                    <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}

function AccountMenu({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
      <button
        type="button"
        className="inline-flex max-w-[42vw] items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted transition hover:bg-black/5 hover:text-ink sm:max-w-[16rem] dark:hover:bg-white/5"
        aria-expanded={open}
        aria-haspopup="menu"
        title={email}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="truncate">{email}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-1 min-w-36 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-ink hover:bg-black/5 dark:hover:bg-white/5"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
