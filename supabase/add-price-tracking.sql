-- MTG Deck Doctor — price tracking (foil prices, foil copies, purchase price).
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- Until it runs, the app keeps working: foil prices and purchase totals are
-- simply not stored.

alter table public.cards
  add column if not exists price_eur_foil text;

alter table public.inventory_items
  add column if not exists foil_quantity integer not null default 0 check (foil_quantity >= 0);

alter table public.inventory_items
  add column if not exists purchase_eur numeric(12, 2) check (purchase_eur is null or purchase_eur >= 0);

-- Make PostgREST pick up the new columns right away.
notify pgrst, 'reload schema';
