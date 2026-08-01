import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
let sessionPromise: Promise<string> | null = null;

/** Publishable (`sb_publishable_…`) or legacy anon JWT — both are safe for the browser. */
export function getSupabaseAnonKey(): string | undefined {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return key || undefined;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && getSupabaseAnonKey());
}

export function getSupabaseBrowserClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = getSupabaseAnonKey();

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
  }

  client ??= createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return client;
}

/**
 * Ensures an anonymous Supabase session so RLS can scope decks to this browser
 * without a visible login screen.
 */
export async function ensureSupabaseUserId(): Promise<string> {
  sessionPromise ??= (async () => {
    const supabase = getSupabaseBrowserClient();
    const { data: existing, error: existingError } = await supabase.auth.getSession();
    if (existingError) throw existingError;
    if (existing.session?.user?.id) return existing.session.user.id;

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      throw new Error(
        `Supabase anonymous sign-in failed: ${error.message}. Enable Anonymous provider in Authentication → Providers.`,
      );
    }
    if (!data.user?.id) throw new Error("Supabase anonymous sign-in returned no user.");
    return data.user.id;
  })();

  try {
    return await sessionPromise;
  } catch (error) {
    sessionPromise = null;
    throw error;
  }
}
