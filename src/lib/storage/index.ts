import type { DeckRepository } from "@/lib/storage/repository";
import { idbRepository } from "@/lib/storage/idb-repository";
import { supabaseRepository } from "@/lib/storage/supabase-repository";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export type StorageBackend = "supabase" | "indexeddb";

export function getStorageBackend(): StorageBackend {
  return isSupabaseConfigured() ? "supabase" : "indexeddb";
}

/**
 * Active persistence implementation.
 * Prefer Supabase when env vars are present; otherwise keep local IndexedDB.
 */
export function getRepository(): DeckRepository {
  return getStorageBackend() === "supabase" ? supabaseRepository : idbRepository;
}
