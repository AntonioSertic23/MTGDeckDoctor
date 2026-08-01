"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import { Button, PageHeader, Panel } from "@/components/ui";

export default function LoginPage() {
  const { configured, user, loading, signIn, signUp } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, user, router]);

  if (!configured) {
    return (
      <div>
        <PageHeader
          eyebrow="Account"
          title="Sign in unavailable"
          description="Supabase is not configured on this deploy. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in Netlify, then redeploy."
        />
        <Link href="/" className="text-sm font-medium text-accent-strong hover:underline">
          Back home
        </Link>
      </div>
    );
  }

  if (!loading && user) {
    return <p className="text-sm text-muted">Already signed in — redirecting…</p>;
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    startTransition(async () => {
      try {
        if (mode === "signin") {
          await signIn(email, password);
          router.replace("/");
          return;
        }
        const result = await signUp(email, password);
        if (result.needsEmailConfirmation) {
          setInfo("Check your email to confirm the account, then sign in.");
          setMode("signin");
          return;
        }
        router.replace("/");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Authentication failed.");
      }
    });
  }

  return (
    <div className="mx-auto max-w-md">
      <PageHeader
        eyebrow="Account"
        title={mode === "signin" ? "Sign in" : "Create account"}
        description="Your decks sync to this Supabase account on every device — including Netlify."
      />

      <Panel>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm outline-none ring-accent focus:ring-2"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Password</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm outline-none ring-accent focus:ring-2"
            />
          </label>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {info ? <p className="text-sm text-accent-strong">{info}</p> : null}

          <Button type="submit" disabled={pending || loading} className="w-full">
            {pending ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          {mode === "signin" ? (
            <>
              No account yet?{" "}
              <button
                type="button"
                className="font-medium text-accent-strong hover:underline"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                  setInfo(null);
                }}
              >
                Create one
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                className="font-medium text-accent-strong hover:underline"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setInfo(null);
                }}
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </Panel>
    </div>
  );
}
