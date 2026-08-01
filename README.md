# MTG Deck Doctor

Diagnose Commander decks, surface concrete problems, suggest cuts and additions, and track shared physical cards across your lists.

> **Take care of your decks.**

v1 has **no login UI**. When Supabase is configured, the app signs in anonymously and stores decks in your project (scoped by `auth.uid()`). Without Supabase env vars, it falls back to browser IndexedDB. Scryfall is only called from Next.js API routes.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Supabase (Postgres + anonymous auth) with IndexedDB fallback
- Scryfall via a `CardProvider` service
- Vitest for domain unit tests
- Netlify for hosting

## How to use

1. Run `npm run dev` and open [http://localhost:3000](http://localhost:3000).
2. Go to **Import** and paste a plain-text decklist (Archidekt / Moxfield export is fine).
3. Open the deck to see health, problems, cuts, additions, and card images.
4. Import a second deck, then open **Shared** for overlapping staples.
5. On a deck page: **Replace list** to update cards, **Export JSON** for a local backup.
6. Restore a backup from **Import → Restore from file**.

Header badge: **Cloud** = Supabase, **Local** = IndexedDB.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. In **Authentication → Providers**, enable **Anonymous**.
3. In **SQL Editor**, run the contents of [`supabase/schema.sql`](./supabase/schema.sql) (includes `analysis_snapshot` on `decks`).
   If the project already existed, at least run:

   ```sql
   alter table public.decks add column if not exists analysis_snapshot jsonb;
   ```
4. Copy Project URL and anon key from **Project Settings → API**.
5. Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Use the **Publishable** key from **Project Settings → API Keys** (not the Secret key). Legacy `anon` JWT still works via `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

6. Restart `npm run dev`. The header should show **Cloud**.

Without those env vars the app keeps using IndexedDB (no accounts, data stays in the browser).

## Develop

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm test
npm run build
```

## First vertical slice

1. Import a plain-text decklist
2. Resolve cards through `/api/cards/resolve`
3. Store the deck (Supabase or IndexedDB)
4. Run deterministic analysis (health, problems, cuts, additions, explanation)
5. See shared cards across multiple decks

## Deploy on Netlify

This repo includes `netlify.toml` and `@netlify/plugin-nextjs`.

1. Push the repo to GitHub
2. Create a new Netlify site from that repo
3. Build command: `npm run build` (already in `netlify.toml`)
4. In Netlify → Site settings → Environment variables, set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
5. Deploy

Omit the env vars to deploy with IndexedDB-only storage.

## Product spec

See [MTG_Deck_Doctor_Product_Requirements.md](./MTG_Deck_Doctor_Product_Requirements.md).
