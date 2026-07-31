# MTG Deck Doctor

Diagnose Commander decks, surface concrete problems, suggest cuts and additions, and track shared physical cards across your lists.

> **Take care of your decks.**

v1 has **no accounts**. Decks, card cache, and inventory live in the browser (IndexedDB). Scryfall is only called from Next.js API routes.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- IndexedDB (`idb`) for local persistence
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

Data stays in this browser (IndexedDB) until you export it.

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
3. Store the deck locally
4. Run deterministic analysis (health, problems, cuts, additions, explanation)
5. See shared cards across multiple decks

## Deploy on Netlify

This repo includes `netlify.toml` and `@netlify/plugin-nextjs`.

1. Push the repo to GitHub
2. Create a new Netlify site from that repo
3. Build command: `npm run build` (already in `netlify.toml`)
4. Deploy

No environment variables are required for v1.

## Product spec

See [MTG_Deck_Doctor_Product_Requirements.md](./MTG_Deck_Doctor_Product_Requirements.md).
