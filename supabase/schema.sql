-- MTG Deck Doctor — Supabase schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query).
-- Also enable Anonymous sign-ins: Authentication → Providers → Anonymous → Enable.

create extension if not exists "pgcrypto";

-- Shared Scryfall card cache (readable/writable by any signed-in user, including anonymous).
create table if not exists public.cards (
  oracle_id text primary key,
  scryfall_id text not null,
  name text not null,
  mana_cost text,
  mana_value double precision not null default 0,
  type_line text not null default '',
  oracle_text text not null default '',
  colors text[] not null default '{}',
  color_identity text[] not null default '{}',
  keywords text[] not null default '{}',
  produced_mana text[] not null default '{}',
  power text,
  toughness text,
  image_uri text,
  set_code text not null default '',
  rarity text not null default '',
  price_usd text,
  price_eur text,
  legalities jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  format text not null default 'commander',
  commander_oracle_ids text[] not null default '{}',
  description text,
  analysis_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Existing projects created before analysis caching:
alter table public.decks add column if not exists analysis_snapshot jsonb;

create index if not exists decks_user_id_idx on public.decks (user_id);

create table if not exists public.deck_cards (
  deck_id uuid not null references public.decks (id) on delete cascade,
  oracle_id text not null,
  quantity integer not null check (quantity > 0),
  primary key (deck_id, oracle_id)
);

create index if not exists deck_cards_oracle_id_idx on public.deck_cards (oracle_id);

create table if not exists public.inventory_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  oracle_id text not null,
  quantity integer not null check (quantity > 0),
  primary key (user_id, oracle_id)
);

create table if not exists public.card_allocations (
  user_id uuid not null references auth.users (id) on delete cascade,
  deck_id uuid not null references public.decks (id) on delete cascade,
  oracle_id text not null,
  quantity integer not null check (quantity > 0),
  primary key (user_id, deck_id, oracle_id)
);

alter table public.cards enable row level security;
alter table public.decks enable row level security;
alter table public.deck_cards enable row level security;
alter table public.inventory_items enable row level security;
alter table public.card_allocations enable row level security;

-- Cards cache: any authenticated user can read/upsert.
drop policy if exists "cards_select_authenticated" on public.cards;
create policy "cards_select_authenticated"
  on public.cards for select to authenticated using (true);

drop policy if exists "cards_insert_authenticated" on public.cards;
create policy "cards_insert_authenticated"
  on public.cards for insert to authenticated with check (true);

drop policy if exists "cards_update_authenticated" on public.cards;
create policy "cards_update_authenticated"
  on public.cards for update to authenticated using (true) with check (true);

-- Decks: owner only.
drop policy if exists "decks_owner_all" on public.decks;
create policy "decks_owner_all"
  on public.decks for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Deck cards: via owning the parent deck.
drop policy if exists "deck_cards_owner_all" on public.deck_cards;
create policy "deck_cards_owner_all"
  on public.deck_cards for all to authenticated
  using (exists (
    select 1 from public.decks d where d.id = deck_id and d.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.decks d where d.id = deck_id and d.user_id = auth.uid()
  ));

drop policy if exists "inventory_owner_all" on public.inventory_items;
create policy "inventory_owner_all"
  on public.inventory_items for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "allocations_owner_all" on public.card_allocations;
create policy "allocations_owner_all"
  on public.card_allocations for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
