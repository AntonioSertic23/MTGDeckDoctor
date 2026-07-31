"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useTransition } from "react";
import { importAndSaveDeck, replaceDeckList } from "@/lib/decks/import-and-save";
import { importDecksFromFile } from "@/lib/decks/file-io";
import { Button, PageHeader, Panel } from "@/components/ui";

const SAMPLE = `1x Access Tunnel (pw26) 9 [Land]
1x Arcane Signet (ltc) 273 [Ramp]
1x Sol Ring (c21) 263 [Ramp]
1x Command Tower (c21) 284 [Land]
`;

const ARCHIDEKT_HINT =
  "Archidekt / Moxfield plain text works: `1x Card Name (set) 123 [Category]`.";

function ImportDeckForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const replaceId = searchParams.get("replace");

  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setWarning(null);

    startTransition(async () => {
      try {
        const result = replaceId
          ? await replaceDeckList(replaceId, text, { name: name || undefined })
          : await importAndSaveDeck(text, { name: name || undefined });

        if (result.unresolved.length > 0) {
          setWarning(
            `Imported ${result.cards.length} cards. Could not resolve: ${result.unresolved.slice(0, 8).join(", ")}${result.unresolved.length > 8 ? "…" : ""}`,
          );
        }
        router.push(`/decks/${result.deck.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed.");
      }
    });
  }

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    startTransition(async () => {
      try {
        const { imported } = await importDecksFromFile(file);
        router.push(imported === 1 ? "/decks" : "/");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not read that file.");
      } finally {
        event.target.value = "";
      }
    });
  }

  return (
    <div>
      <PageHeader
        eyebrow={replaceId ? "Update" : "Check-in"}
        title={replaceId ? "Replace deck list" : "Import a deck"}
        description={
          replaceId
            ? `Paste a new list to overwrite the cards in this deck. ${ARCHIDEKT_HINT}`
            : `Paste a plain-text list, or restore a JSON backup. ${ARCHIDEKT_HINT}`
        }
      />

      <Panel>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Deck name (optional)</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={replaceId ? "Leave blank to keep the current name" : "Defaults to the commander name"}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm outline-none ring-accent focus:ring-2"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Decklist</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
              rows={16}
              spellCheck={false}
              placeholder={SAMPLE}
              className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-3 font-mono text-sm leading-relaxed outline-none ring-accent focus:ring-2"
            />
          </label>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {warning ? <p className="text-sm text-amber-700 dark:text-amber-300">{warning}</p> : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending || text.trim().length === 0}>
              {pending ? "Resolving cards…" : replaceId ? "Replace & diagnose" : "Import & diagnose"}
            </Button>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => setText(SAMPLE)}>
              Paste sample
            </Button>
          </div>
        </form>
      </Panel>

      {!replaceId ? (
        <Panel className="mt-4 space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
            Restore from file
          </h2>
          <p className="text-sm text-ink-muted">
            Load a JSON backup previously exported from MTG Deck Doctor (local file on your device).
          </p>
          <label className="inline-flex cursor-pointer">
            <span className="sr-only">Choose backup file</span>
            <input type="file" accept="application/json,.json" onChange={onFile} disabled={pending} className="text-sm" />
          </label>
        </Panel>
      ) : null}
    </div>
  );
}

export default function ImportDeckPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <ImportDeckForm />
    </Suspense>
  );
}
