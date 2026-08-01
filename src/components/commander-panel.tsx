"use client";

import type { Card, ResolvedDeckEntry } from "@/domain/types";
import { CardArt } from "@/components/card-art";
import { Button, Panel } from "@/components/ui";

const MAX_COMMANDERS = 2;

export function CommanderPanel({
  commanders,
  candidates,
  missing,
  pending,
  onSetCommanders,
}: {
  commanders: Card[];
  candidates: ResolvedDeckEntry[];
  missing: boolean;
  pending?: boolean;
  onSetCommanders: (oracleIds: string[]) => void;
}) {
  const legendaries = candidates
    .filter(
      (e) =>
        /legendary/i.test(e.card.typeLine) &&
        /creature|planeswalker|background/i.test(e.card.typeLine),
    )
    .sort((a, b) => a.card.name.localeCompare(b.card.name));
  const others = candidates
    .filter((e) => !legendaries.some((l) => l.card.oracleId === e.card.oracleId))
    .sort((a, b) => a.card.name.localeCompare(b.card.name));

  function setAt(index: number, oracleId: string) {
    const next = commanders.map((c) => c.oracleId);
    next[index] = oracleId;
    onSetCommanders([...new Set(next.filter(Boolean))].slice(0, MAX_COMMANDERS));
  }

  function clearAt(index: number) {
    onSetCommanders(commanders.filter((_, i) => i !== index).map((c) => c.oracleId));
  }

  function addPartner(oracleId: string) {
    if (!oracleId || commanders.length >= MAX_COMMANDERS) return;
    onSetCommanders([...commanders.map((c) => c.oracleId), oracleId].slice(0, MAX_COMMANDERS));
  }

  const showSlots = missing ? [null] : commanders;

  return (
    <Panel className={missing ? "border-amber-500/40 bg-amber-500/5" : undefined}>
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-strong">
            Commander{commanders.length === 2 ? "s" : ""}
          </p>
          <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-ink">
            {commanders.length > 0
              ? commanders.map((c) => c.name).join(" / ")
              : "Not set"}
          </h2>
          {missing ? (
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
              Cuts, synergy, and color identity need a commander. Pick one below. Partner decks can
              add a second commander after the first is set.
            </p>
          ) : null}
        </div>

        <div className={`grid gap-4 ${showSlots.length > 1 ? "sm:grid-cols-2" : ""}`}>
          {(missing ? [null] : commanders).map((card, index) => (
            <CommanderSlot
              key={card?.oracleId ?? `empty-${index}`}
              card={card}
              index={index}
              label={index === 0 ? "Commander" : "Partner"}
              legendaries={legendaries}
              others={others}
              takenIds={commanders.map((c) => c.oracleId)}
              pending={pending}
              onSelect={(oracleId) => (missing ? onSetCommanders([oracleId]) : setAt(index, oracleId))}
              onClear={commanders.length > 0 ? () => clearAt(index) : undefined}
            />
          ))}
        </div>

        {commanders.length === 1 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] p-3">
            <p className="mb-2 text-sm font-medium text-ink">Add a partner / second commander</p>
            <select
              defaultValue=""
              disabled={pending}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm outline-none ring-accent focus:ring-2"
              onChange={(event) => {
                if (event.target.value) {
                  addPartner(event.target.value);
                  event.target.value = "";
                }
              }}
            >
              <option value="">Optional — select only for Partner / Background decks…</option>
              {legendaries
                .filter((e) => e.card.oracleId !== commanders[0]?.oracleId)
                .map((entry) => (
                  <option key={entry.card.oracleId} value={entry.card.oracleId}>
                    {entry.card.name}
                  </option>
                ))}
              {others
                .filter((e) => e.card.oracleId !== commanders[0]?.oracleId)
                .map((entry) => (
                  <option key={entry.card.oracleId} value={entry.card.oracleId}>
                    {entry.card.name}
                  </option>
                ))}
            </select>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function CommanderSlot({
  card,
  index,
  label,
  legendaries,
  others,
  takenIds,
  pending,
  onSelect,
  onClear,
}: {
  card: Card | null;
  index: number;
  label: string;
  legendaries: ResolvedDeckEntry[];
  others: ResolvedDeckEntry[];
  takenIds: string[];
  pending?: boolean;
  onSelect: (oracleId: string) => void;
  onClear?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-3 sm:flex-row sm:items-start">
      <div className="mx-auto shrink-0 sm:mx-0">
        <CardArt name={card?.name ?? label} imageUri={card?.imageUri} size="lg" />
      </div>

      <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
          <p className="mt-1 text-lg font-semibold text-ink">{card?.name ?? "—"}</p>
          {card ? <p className="text-xs text-muted">{card.typeLine}</p> : null}
        </div>

        <label className="block space-y-1.5">
          <span className="sr-only">{card ? `Change ${label}` : `Set ${label}`}</span>
          <select
            key={card?.oracleId ?? `empty-${index}`}
            defaultValue={card?.oracleId ?? ""}
            disabled={pending}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none ring-accent focus:ring-2"
            onChange={(event) => {
              if (event.target.value) onSelect(event.target.value);
            }}
          >
            <option value="" disabled>
              Select a card…
            </option>
            {legendaries.length > 0 ? (
              <optgroup label="Legendary / Background">
                {legendaries.map((entry) => (
                  <option
                    key={entry.card.oracleId}
                    value={entry.card.oracleId}
                    disabled={takenIds.includes(entry.card.oracleId) && entry.card.oracleId !== card?.oracleId}
                  >
                    {entry.card.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
            <optgroup label="All cards">
              {others.map((entry) => (
                <option
                  key={entry.card.oracleId}
                  value={entry.card.oracleId}
                  disabled={takenIds.includes(entry.card.oracleId) && entry.card.oracleId !== card?.oracleId}
                >
                  {entry.card.name}
                </option>
              ))}
            </optgroup>
          </select>
        </label>

        {card && onClear ? (
          <Button type="button" variant="ghost" disabled={pending} onClick={onClear}>
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}
