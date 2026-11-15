"use client";

import { useState } from "react";
import { useDialog } from "@/components/dialog";
import { Button, Panel, SectionTitle } from "@/components/ui";

/**
 * Render with `key={deckId + savedNotes}` so the draft resets when the deck
 * changes or a save lands.
 */
export function NotesTab({
  savedNotes,
  disabled,
  onSave,
}: {
  savedNotes: string;
  disabled: boolean;
  /** Persists the notes; empty string clears them. */
  onSave: (notes: string) => Promise<void>;
}) {
  const dialog = useDialog();
  const [draft, setDraft] = useState(savedNotes);

  const dirty = draft !== savedNotes;

  async function clear() {
    if (!savedNotes && !draft.trim()) return;
    const ok = await dialog.confirm({
      title: "Clear notes?",
      description: "The notes for this deck will be removed.",
      confirmLabel: "Clear notes",
      danger: true,
    });
    if (!ok) return;
    setDraft("");
    await onSave("");
  }

  return (
    <Panel className="space-y-3">
      <SectionTitle
        size="lg"
        description="Strategy, upgrades, playtest reminders — anything useful for this list."
      >
        Notes
      </SectionTitle>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={16}
        placeholder="Add notes for this deck…"
        disabled={disabled}
        className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm leading-relaxed outline-none ring-accent focus:ring-2 disabled:opacity-60"
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={disabled || !dirty} onClick={() => void onSave(draft.trim())}>
          Save notes
        </Button>
        <Button
          variant="secondary"
          disabled={disabled || (!savedNotes && !draft.trim())}
          onClick={() => void clear()}
        >
          Clear
        </Button>
      </div>
    </Panel>
  );
}
