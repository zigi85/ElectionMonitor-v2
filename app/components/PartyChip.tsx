import type { PartyKey, MomentumDirection } from "@/lib/types";
import { parties } from "@/lib/parties";

interface PartyChipProps {
  partyKey: PartyKey;
  direction: MomentumDirection;
  score?: number;
}

const ARROWS: Record<MomentumDirection, string> = {
  gaining: "↑",
  losing: "↓",
  stable: "→",
};

export default function PartyChip({ partyKey, direction }: PartyChipProps) {
  const meta = parties[partyKey];
  if (!meta) return null;

  const chipClass =
    direction === "gaining"
      ? "party-chip party-chip--gaining"
      : direction === "losing"
      ? "party-chip party-chip--losing"
      : "party-chip";

  const arrowClass = `party-chip-arrow party-chip-arrow--${direction}`;

  return (
    <span className={chipClass}>
      <span
        className="party-chip-dot"
        style={{ background: meta.color }}
        aria-hidden="true"
      />
      <span className="party-chip-name">{meta.name}</span>
      <span className={arrowClass} aria-label={direction}>
        {ARROWS[direction]}
      </span>
    </span>
  );
}
