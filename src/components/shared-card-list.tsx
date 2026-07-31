import Link from "next/link";
import type { Card, SharedCardUsage } from "@/domain/types";
import { formatEur } from "@/lib/utils";

export function SharedCardList({
  items,
  cards,
}: {
  items: SharedCardUsage[];
  cards?: Map<string, Card>;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted">
        No overlapping cards match the current filters.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const card = cards?.get(item.oracleId);
        const eur = parseFloat(card?.prices.eur ?? "");
        return (
          <li
            key={item.oracleId}
            className="flex gap-3 rounded-2xl border border-[var(--border)] p-3"
          >
            {card?.imageUri ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card.imageUri}
                alt={item.name}
                width={63}
                height={88}
                loading="lazy"
                className="h-[88px] w-[63px] shrink-0 rounded-md object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-[88px] w-[63px] shrink-0 items-center justify-center rounded-md bg-black/5 text-[10px] text-muted dark:bg-white/10">
                No art
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-ink">{item.name}</h3>
                  <p className="mt-1 text-sm text-muted">
                    Used in{" "}
                    {item.deckIds.map((deckId, i) => (
                      <span key={deckId}>
                        {i > 0 ? ", " : null}
                        <Link
                          href={`/decks/${deckId}`}
                          className="text-accent-strong underline-offset-2 hover:underline"
                        >
                          {item.deckNames[i]}
                        </Link>
                      </span>
                    ))}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {Number.isFinite(eur) ? formatEur(eur) : "No EUR price"}
                    {card?.setCode ? ` · ${card.setCode.toUpperCase()}` : null}
                    {item.copiesOwned > 0
                      ? ` · Owned ${item.copiesOwned} / need ${item.copiesRequired}`
                      : null}
                  </p>
                </div>
                {item.conflict ? (
                  <span className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:text-amber-300">
                    Conflict
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-black/5 px-2.5 py-1 text-xs font-semibold text-muted dark:bg-white/10">
                    {item.deckIds.length} decks
                  </span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
