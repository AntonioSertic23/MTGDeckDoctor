# MTG Deck Doctor

Diagnose Commander decks, surface concrete problems, suggest cuts and additions, and track shared physical cards across your lists.

> **Take care of your decks.**

When Supabase is configured, you **sign in with email/password** and decks sync to your account (`auth.uid()`). Without Supabase env vars, the app falls back to browser IndexedDB (Local badge, no login). Scryfall is only called from Next.js API routes.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Supabase (Postgres + email auth) with IndexedDB fallback
- Scryfall via a `CardProvider` service
- Vitest for domain unit tests
- Netlify for hosting

## How to use

1. Run `npm run dev` and open [http://localhost:3000](http://localhost:3000).
2. If Supabase is configured, create an account / sign in on `/login`.
3. Go to **Import** and paste a plain-text decklist (Archidekt / Moxfield export is fine).
4. Open the deck to see health, problems, cuts, additions, and card images.
5. Import a second deck, then open **Shared** for overlapping staples.
6. On a deck page: **Replace list** to update cards, **Export JSON** for a local backup.
7. Restore a backup from **Import → Restore from file**.

Header badge: **Cloud** = Supabase env present, **Local** = IndexedDB only.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. In **Authentication → Providers**, enable **Email** (password). You can disable Anonymous.
3. **Authentication → URL configuration**: set **Site URL** to your app (e.g. `http://localhost:3000` locally, or your Netlify URL in production). Add the same under Redirect URLs.
4. Optional but handy for local testing: **Authentication → Providers → Email → Confirm email** → off (otherwise new users must confirm by email first).
5. In **SQL Editor**, run the contents of [`supabase/schema.sql`](./supabase/schema.sql).
   If the project already existed, run the alters (or [`supabase/add-ready-play-counters.sql`](./supabase/add-ready-play-counters.sql)):

   ```sql
   alter table public.decks add column if not exists analysis_snapshot jsonb;
   alter table public.decks add column if not exists ready boolean not null default false;
   alter table public.decks add column if not exists times_brought integer not null default 0;
   alter table public.decks add column if not exists times_played integer not null default 0;
   ```
6. Copy Project URL and Publishable (or legacy anon) key from **Project Settings → API**.
7. Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Use the **Publishable** key (not the Secret key). Legacy `anon` JWT still works via `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

8. Restart `npm run dev`. Badge should show **Cloud**; you will be asked to sign in.

Without those env vars the app keeps using IndexedDB (Local).

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

## Deploy on Netlify

This repo includes `netlify.toml` and `@netlify/plugin-nextjs`.

1. Push the repo to GitHub
2. Create a new Netlify site from that repo
3. Build command: `npm run build` (already in `netlify.toml`)
4. In Netlify → **Site settings → Environment variables**, set **exactly**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
5. Trigger a **new deploy** after saving env vars (`NEXT_PUBLIC_*` are baked in at build time)
6. In Supabase Auth URL config, set Site URL / Redirect URLs to your Netlify domain (e.g. `https://your-site.netlify.app`)

If the badge still says **Local**, the env vars were missing at build time — fix them and redeploy.

## Install as an app (PWA)

The site is installable on phone/desktop when served over HTTPS (Netlify):

- **Android / Chrome:** browser menu → **Install app** / **Add to Home screen**
- **iPhone Safari:** Share → **Add to Home Screen**
- **Desktop Chrome/Edge:** install icon in the address bar

It uses a web app manifest + service worker (`public/sw.js`). Install works in production builds; local `next dev` does not register the worker.

## Product spec

See [MTG_Deck_Doctor_Product_Requirements.md](./MTG_Deck_Doctor_Product_Requirements.md).
