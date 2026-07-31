import type { Problem, Severity } from "@/domain/types";
import { cn } from "@/lib/utils";

const SEVERITY_STYLES: Record<Severity, string> = {
  critical: "border-rose-500/30 bg-rose-500/8 text-rose-700 dark:text-rose-300",
  warning: "border-amber-500/30 bg-amber-500/8 text-amber-800 dark:text-amber-300",
  notice: "border-sky-500/30 bg-sky-500/8 text-sky-800 dark:text-sky-300",
};

const SEVERITY_DOT: Record<Severity, string> = {
  critical: "bg-rose-500",
  warning: "bg-amber-500",
  notice: "bg-sky-500",
};

export function ProblemList({ problems }: { problems: Problem[] }) {
  if (problems.length === 0) {
    return (
      <p className="text-sm text-muted">
        No major problems detected from the current heuristics. Keep tuning and re-check after changes.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {problems.map((problem) => (
        <li
          key={problem.type}
          className={cn("rounded-2xl border px-4 py-3", SEVERITY_STYLES[problem.severity])}
        >
          <div className="flex items-start gap-2.5">
            <span
              className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", SEVERITY_DOT[problem.severity])}
              aria-hidden
            />
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <h3 className="font-semibold text-ink">{problem.title}</h3>
                <span className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
                  {problem.severity}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-ink/85">{problem.description}</p>
              {problem.suggestedFix ? (
                <p className="text-sm text-ink/70">
                  <span className="font-medium">Treatment:</span> {problem.suggestedFix}
                </p>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
