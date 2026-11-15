"use client";

import { useMemo } from "react";
import { filterAdditionsByBudget } from "@/domain/decks/value";
import type { AdditionCandidate } from "@/domain/types";
import { AdditionList } from "@/components/recommendation-lists";
import { Panel, SectionTitle, Select } from "@/components/ui";
import { ADDITIONS_SHOWN } from "@/lib/decks/analyze-local";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";

const BUDGET_KEY = "mtg-deck-doctor:adds-budget";

const BUDGET_OPTIONS = [
  { value: "any", label: "Any price" },
  { value: "1", label: "Up to €1" },
  { value: "3", label: "Up to €3" },
  { value: "5", label: "Up to €5" },
  { value: "10", label: "Up to €10" },
  { value: "25", label: "Up to €25" },
] as const;

type Budget = (typeof BUDGET_OPTIONS)[number]["value"];

function isBudget(value: string): value is Budget {
  return BUDGET_OPTIONS.some((option) => option.value === value);
}

export function AdditionsTab({ additions }: { additions: AdditionCandidate[] }) {
  const [budget, setBudget] = usePersistedState<Budget>(BUDGET_KEY, "any", isBudget);
  const maxEur = budget === "any" ? null : Number(budget);

  const affordable = useMemo(
    () => filterAdditionsByBudget(additions, maxEur),
    [additions, maxEur],
  );
  const shown = affordable.slice(0, ADDITIONS_SHOWN);
  const hidden = additions.length - affordable.length;

  return (
    <Panel>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <SectionTitle description="Ranked from role gaps and theme fit. Cards you already own are listed first.">
          Suggested additions
        </SectionTitle>
        <Select
          label="Budget per card"
          wrapperClassName="sm:w-44"
          value={budget}
          onChange={(event) => setBudget(event.target.value as Budget)}
        >
          {BUDGET_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
      {maxEur !== null ? (
        <p className="mb-3 text-xs text-muted">
          {hidden > 0
            ? `${hidden} pricier suggestion${hidden === 1 ? "" : "s"} hidden. `
            : "Every suggestion fits this budget. "}
          Owned cards and cards without a price are always shown.
        </p>
      ) : null}
      <AdditionList additions={shown} />
    </Panel>
  );
}
