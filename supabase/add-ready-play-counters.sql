-- Add ready + play counters to decks (run in Supabase SQL Editor if schema already exists).
alter table public.decks add column if not exists ready boolean not null default false;
alter table public.decks add column if not exists times_brought integer not null default 0;
alter table public.decks add column if not exists times_played integer not null default 0;
