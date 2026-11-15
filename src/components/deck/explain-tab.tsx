import type { DeckExplanation } from "@/domain/types";
import { Panel, SectionTitle } from "@/components/ui";

export function ExplainTab({ explanation }: { explanation: DeckExplanation }) {
  const { profile, narrative } = explanation;
  return (
    <Panel className="space-y-4">
      <SectionTitle>Explain my deck</SectionTitle>
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent-strong">
          {profile.primaryArchetype}
        </span>
        {profile.secondaryArchetype ? (
          <span className="rounded-full bg-black/5 px-3 py-1 text-sm font-medium text-muted dark:bg-white/10">
            {profile.secondaryArchetype}
          </span>
        ) : null}
      </div>
      <p className="text-base leading-relaxed text-ink">{narrative}</p>
      {profile.keyMechanics.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-ink">Key mechanics</h3>
          <p className="mt-1 text-sm text-muted">{profile.keyMechanics.join(" · ")}</p>
        </div>
      ) : null}
    </Panel>
  );
}
