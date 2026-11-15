"use client";

import { useState } from "react";
import { manaSymbolFile, manaSymbolLabel, parseManaCost } from "@/domain/cards/mana-cost";
import { cn } from "@/lib/utils";

const SYMBOL_BASE = "https://svgs.scryfall.io/card-symbols";

/** Renders `{2}{R}` as mana symbol icons; falls back to the raw text. */
export function ManaCost({
  cost,
  className,
  size = "sm",
}: {
  cost: string | null | undefined;
  className?: string;
  size?: "sm" | "md";
}) {
  const tokens = parseManaCost(cost);
  if (tokens.length === 0) return <span className={cn("text-muted", className)}>—</span>;

  const label = tokens
    .map((token) => (token.kind === "face-break" ? "//" : manaSymbolLabel(token.symbol)))
    .join(", ");

  return (
    <span
      className={cn("inline-flex flex-wrap items-center gap-0.5 align-middle", className)}
      role="img"
      aria-label={`Mana cost: ${label}`}
      title={cost ?? undefined}
    >
      {tokens.map((token, index) =>
        token.kind === "face-break" ? (
          <span key={index} className="px-0.5 text-xs text-muted" aria-hidden>
            {"//"}
          </span>
        ) : (
          <ManaSymbol key={index} symbol={token.symbol} size={size} />
        ),
      )}
    </span>
  );
}

function ManaSymbol({ symbol, size }: { symbol: string; size: "sm" | "md" }) {
  const [failed, setFailed] = useState(false);
  const dimension = size === "md" ? 18 : 15;

  if (failed) {
    return (
      <span className="text-xs tabular-nums text-ink-muted" aria-hidden>
        {`{${symbol}}`}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${SYMBOL_BASE}/${manaSymbolFile(symbol)}.svg`}
      crossOrigin="anonymous"
      alt=""
      aria-hidden
      width={dimension}
      height={dimension}
      loading="lazy"
      className="inline-block shrink-0 rounded-full shadow-[0_1px_0_rgba(0,0,0,0.35)]"
      onError={() => setFailed(true)}
    />
  );
}
