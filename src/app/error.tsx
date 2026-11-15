"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonClassName, Panel } from "@/components/ui";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Panel className="mx-auto max-w-lg space-y-3 py-8 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
        Something went wrong
      </h1>
      <p className="text-sm text-muted">
        This page hit an unexpected error. Your decks are safe — try again, or go back to the shelf.
      </p>
      {error.message ? (
        <p className="break-words rounded-lg bg-black/5 px-3 py-2 font-mono text-xs text-muted dark:bg-white/5">
          {error.message}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-center gap-2 pt-1">
        <Button onClick={() => unstable_retry()}>Try again</Button>
        <Link href="/decks" className={buttonClassName("secondary")}>
          Back to decks
        </Link>
      </div>
    </Panel>
  );
}
