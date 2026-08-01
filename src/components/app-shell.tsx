"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Activity, Layers, LayoutDashboard, LogIn, Plus, Share2 } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-provider";
import { getStorageBackend } from "@/lib/storage";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/decks", label: "Decks", icon: Layers },
  { href: "/decks/new", label: "Import", icon: Plus },
  { href: "/shared", label: "Shared", icon: Share2 },
] as const;

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

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_88%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
          <Link href="/" className="group flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white shadow-sm transition group-hover:bg-accent-strong">
              <Activity className="h-4.5 w-4.5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-[family-name:var(--font-display)] text-lg font-semibold leading-tight tracking-tight text-ink">
                MTG Deck Doctor
              </span>
              <span className="hidden text-xs text-ink-muted sm:block">
                Take care of your decks.
              </span>
            </span>
          </Link>

          <div className="flex min-w-0 items-center gap-2">
            <span
              className="hidden rounded-md border border-[var(--border)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted sm:inline"
              title={
                backend === "supabase"
                  ? user
                    ? `Signed in as ${user.email ?? user.id}`
                    : "Cloud storage — sign in required"
                  : "Data stays in this browser (IndexedDB)"
              }
            >
              {backend === "supabase" ? "Cloud" : "Local"}
            </span>

            {configured && user ? (
              <div className="hidden items-center gap-2 md:flex">
                <span className="max-w-[10rem] truncate text-xs text-muted" title={user.email ?? undefined}>
                  {user.email}
                </span>
                <Button
                  variant="ghost"
                  className="px-2 py-1.5 text-xs"
                  onClick={() => {
                    void signOut().then(() => router.replace("/login"));
                  }}
                >
                  Sign out
                </Button>
              </div>
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

            {!isLogin ? (
              <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
                {NAV.map((item) => {
                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname === item.href || pathname.startsWith(`${item.href}/`);
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
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href ||
                    (item.href !== "/decks/new" && pathname.startsWith(`${item.href}/`));
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

      {configured && user ? (
        <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] right-3 z-30 md:hidden">
          <Button
            variant="secondary"
            className="rounded-full px-3 py-2 text-xs shadow-md"
            onClick={() => {
              void signOut().then(() => router.replace("/login"));
            }}
          >
            Sign out
          </Button>
        </div>
      ) : null}
    </div>
  );
}
