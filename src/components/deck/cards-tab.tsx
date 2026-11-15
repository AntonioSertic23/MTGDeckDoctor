"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  CARD_SORT_OPTIONS,
  groupEntriesByType,
  isCardSort,
  sortDeckEntries,
  type CardSort,
} from "@/domain/decks/sort-entries";
import { deckValue } from "@/domain/decks/value";
import type { CardRole, ResolvedDeckEntry } from "@/domain/types";
import { CARD_ROLE_LABELS } from "@/domain/types";
import { CardArt } from "@/components/card-art";
import { ManaCost } from "@/components/mana-cost";
import { inputClassName, Panel, SectionTitle, Select, Skeleton } from "@/components/ui";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import { cn, formatCardPrices, formatEur } from "@/lib/utils";

const CARD_SORT_KEY = "mtg-deck-doctor:deck-cards-sort";
const CARD_GROUP_KEY = "mtg-deck-doctor:deck-cards-group";

type GroupMode = "none" | "type";

function isGroupMode(value: string): value is GroupMode {
  return value === "none" || value === "type";
}

export function CardsTab({
  entries,
  totalCards,
  pending,
}: {
  entries: ResolvedDeckEntry[];
  totalCards: number;
  pending: boolean;
}) {
  const [sort, setSort] = usePersistedState<CardSort>(CARD_SORT_KEY, "name", isCardSort);
  const [group, setGroup] = usePersistedState<GroupMode>(CARD_GROUP_KEY, "none", isGroupMode);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<CardRole | "all">("all");

  // Only offer roles that actually occur in this list.
  const roleOptions = useMemo(() => {
    const present = new Set(entries.flatMap((entry) => entry.roles));
    return (Object.keys(CARD_ROLE_LABELS) as CardRole[]).filter((r) => present.has(r));
  }, [entries]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = entries.filter((entry) => {
      if (role !== "all" && !entry.roles.includes(role)) return false;
      if (!needle) return true;
      return (
        entry.card.name.toLowerCase().includes(needle) ||
        entry.card.typeLine.toLowerCase().includes(needle)
      );
    });
    return sortDeckEntries(filtered, sort);
  }, [entries, query, role, sort]);

  const groups = useMemo(
    () =>
      group === "type"
        ? groupEntriesByType(visible)
        : [{ id: "all", label: "", entries: visible }],
    [group, visible],
  );

  const value = useMemo(() => deckValue(entries), [entries]);
  const filtering = query.trim() !== "" || role !== "all";

  return (
    <Panel>
      <div className="mb-4 space-y-3">
        <SectionTitle
          description={
            pending
              ? "Loading cards…"
              : `${entries.length} unique · ${totalCards} total · ${formatEur(value.totalEur)}`
          }
        >
          Cards
        </SectionTitle>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_repeat(3,minmax(0,10rem))]">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted">Search</span>
            <span className="relative block">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name or type…"
                className={cn(inputClassName, "pl-9")}
              />
            </span>
          </label>
          <Select
            label="Role"
            value={role}
            onChange={(event) => setRole(event.target.value as CardRole | "all")}
          >
            <option value="all">All roles</option>
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {CARD_ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
          <Select label="Sort" value={sort} onChange={(event) => setSort(event.target.value as CardSort)}>
            {CARD_SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <Select
            label="Group"
            value={group}
            onChange={(event) => setGroup(event.target.value as GroupMode)}
          >
            <option value="none">No grouping</option>
            <option value="type">By card type</option>
          </Select>
        </div>

        {filtering ? (
          <p className="text-xs text-muted">
            Showing {visible.length} of {entries.length}.{" "}
            <button
              type="button"
              className="font-medium text-accent-strong hover:underline"
              onClick={() => {
                setQuery("");
                setRole("all");
              }}
            >
              Clear filters
            </button>
          </p>
        ) : null}
      </div>

      {pending ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <li key={index} className="flex gap-3 rounded-2xl border border-[var(--border)] p-3">
              <Skeleton className="h-[154px] w-[110px] shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </li>
          ))}
        </ul>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted">No cards match these filters.</p>
      ) : (
        <div className="space-y-6">
          {groups.map((section) => (
            <section key={section.id}>
              {section.label ? (
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  {section.label}{" "}
                  <span className="tabular-nums">
                    ({section.entries.reduce((sum, e) => sum + e.quantity, 0)})
                  </span>
                </h3>
              ) : null}
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {section.entries.map((entry) => (
                  <CardRow key={entry.card.oracleId} entry={entry} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Panel>
  );
}

function CardRow({ entry }: { entry: ResolvedDeckEntry }) {
  const price = formatCardPrices(entry.card.prices);
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] p-3 sm:flex-row">
      <div className="mx-auto shrink-0 sm:mx-0">
        <CardArt
          name={entry.card.name}
          imageUri={entry.card.imageUri}
          prices={entry.card.prices}
          size="lg"
        />
      </div>
      <div className="min-w-0 flex-1 py-0.5 text-center sm:text-left">
        <p className="font-medium leading-snug text-ink">
          {entry.quantity > 1 ? `${entry.quantity}× ` : null}
          {entry.card.name}
          {entry.isCommander ? (
            <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-accent-strong">
              Cmdr
            </span>
          ) : null}
        </p>
        <p className="mt-1 text-xs text-muted">{entry.card.typeLine}</p>
        <p className="mt-1 text-xs text-muted">
          {entry.roles
            .slice(0, 3)
            .map((r) => CARD_ROLE_LABELS[r])
            .join(" · ") || "—"}
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm tabular-nums text-ink-muted sm:justify-start">
          <ManaCost cost={entry.card.manaCost} />
          {price ? <span>{price}</span> : null}
        </div>
      </div>
    </li>
  );
}
