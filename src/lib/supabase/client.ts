import { createClient, type Session, type SupabaseClient, type User } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

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

export async function getSession(): Promise<Session | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  return session?.user ?? null;
}

/**
 * Returns the signed-in user's id. Does not create anonymous sessions —
 * the UI must sign the user in first.
 */
export async function requireSupabaseUserId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user?.id) {
    throw new Error("Sign in required to sync decks with your account.");
  }
  return user.id;
}

/** @deprecated Use requireSupabaseUserId — kept as alias for repository calls. */
export async function ensureSupabaseUserId(): Promise<string> {
  return requireSupabaseUserId();
}

export async function signInWithPassword(email: string, password: string): Promise<User> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  if (!data.user) throw new Error("Sign-in returned no user.");
  return data.user;
}

export async function signUpWithPassword(email: string, password: string): Promise<{
  user: User;
  needsEmailConfirmation: boolean;
}> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  if (!data.user) throw new Error("Sign-up returned no user.");
  return {
    user: data.user,
    needsEmailConfirmation: !data.session,
  };
}

export async function signOut(): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
