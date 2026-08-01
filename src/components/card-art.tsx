"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { X } from "lucide-react";
import type { CardPrices } from "@/domain/types";
import { cn, formatCardPrices } from "@/lib/utils";

type ArtSize = "sm" | "md" | "lg";

const SIZE: Record<ArtSize, { className: string; width: number; height: number }> = {
  sm: { className: "h-[112px] w-[80px]", width: 80, height: 112 },
  md: { className: "h-[154px] w-[110px]", width: 110, height: 154 },
  lg: { className: "h-[220px] w-[157px]", width: 157, height: 220 },
};

/** Swallow the click that would otherwise hit a Link under a just-closed overlay. */
function blockClickThrough() {
  const blocker = (event: MouseEvent | PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    document.removeEventListener("click", blocker, true);
    document.removeEventListener("pointerup", blocker, true);
  };
  document.addEventListener("click", blocker, true);
  document.addEventListener("pointerup", blocker, true);
  window.setTimeout(() => {
    document.removeEventListener("click", blocker, true);
    document.removeEventListener("pointerup", blocker, true);
  }, 150);
}

/** Card thumbnail with click-to-enlarge lightbox. */
export function CardArt({
  name,
  imageUri,
  prices,
  size = "md",
  className,
}: {
  name: string;
  imageUri?: string | null;
  prices?: CardPrices | null;
  size?: ArtSize;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const dim = SIZE[size];
  const priceLabel = formatCardPrices(prices);

  const close = useCallback(() => {
    setOpen(false);
    blockClickThrough();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  if (!imageUri) {
    return (
      <div
        className={cn(
          dim.className,
          "flex shrink-0 items-center justify-center rounded-lg bg-black/5 text-[10px] text-muted dark:bg-white/10",
          className,
        )}
        aria-hidden
      >
        No art
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          "group shrink-0 rounded-lg p-0 text-left transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          className,
        )}
        aria-label={`Enlarge ${name}${priceLabel ? `, ${priceLabel}` : ""}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUri}
          alt={name}
          width={dim.width}
          height={dim.height}
          loading="lazy"
          className={cn(
            dim.className,
            "rounded-lg object-cover shadow-md transition group-hover:shadow-lg group-hover:ring-2 group-hover:ring-accent/40",
          )}
        />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            close();
          }}
        >
          <div
            className="relative flex max-h-full w-full max-w-md flex-col items-center gap-3"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex w-full items-start justify-between gap-3">
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className="truncate font-[family-name:var(--font-display)] text-lg font-semibold text-white"
                >
                  {name}
                </h2>
                <p className="mt-1 text-base font-medium tabular-nums text-white/90">
                  {priceLabel ?? "Price unavailable"}
                </p>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  close();
                }}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUri}
              alt={name}
              className="max-h-[min(80vh,720px)] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
            />
            <p className="text-xs text-white/70">Click outside or press Esc to close</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
