import type { MomentumData, PartyKey, PartyMomentum } from "@/lib/types";
import BlocCard from "./BlocCard";
import PartyChip from "./PartyChip";

interface MomentumHeroProps {
  momentum: MomentumData;
}

// Parties to show chips for (ordered by importance)
const CHIP_PARTIES: PartyKey[] = [
  "together",
  "likud",
  "shas",
  "otzma_yehudit",
  "yisrael_beiteinu",
  "democrats",
  "yashar",
  "reservists",
  "utj",
];

export default function MomentumHero({ momentum }: MomentumHeroProps) {
  const { blocs, parties: partyMomentumList, weights, degraded_sources } = momentum;

  // Build quick-access map
  const partyMap = Object.fromEntries(
    partyMomentumList.map((p: PartyMomentum) => [p.party, p])
  ) as Record<string, PartyMomentum>;

  // Determine headline based on bloc directions
  const coalitionDir = blocs.coalition.direction;
  const oppositionDir = blocs.opposition.direction;

  const headline = buildHeadline(
    blocs.coalition,
    blocs.opposition,
    partyMap["together"]?.direction ?? "stable"
  );

  return (
    <section className="momentum-hero fade-in" aria-label="מדד מומנטום">
      {/* ─ Headline ─────────────────────────────────────────────────── */}
      <p className="hero-headline">{headline}</p>

      {/* ─ Bloc cards ───────────────────────────────────────────────── */}
      <div className="hero-blocs">
        <BlocCard
          label="גוש האופוזיציה"
          seats={blocs.opposition.seats}
          delta={blocs.opposition.delta}
          direction={blocs.opposition.direction}
        />
        <BlocCard
          label="גוש הקואליציה"
          seats={blocs.coalition.seats}
          delta={blocs.coalition.delta}
          direction={blocs.coalition.direction}
        />
      </div>

      {/* ─ Party chips ──────────────────────────────────────────────── */}
      <div className="party-chips">
        {CHIP_PARTIES.map((key) => {
          const pm = partyMap[key];
          if (!pm) return null;
          return (
            <PartyChip
              key={key}
              partyKey={key}
              direction={pm.direction}
              score={pm.score}
            />
          );
        })}
      </div>

      {/* ─ Degraded signal notice ───────────────────────────────────── */}
      {degraded_sources.length > 0 && (
        <p
          className="sparse-badge"
          style={{ marginTop: 12, display: "inline-flex" }}
        >
          ⚠ {degraded_sources.join(", ")} לא זמין — מומנטום מבוסס על{" "}
          {Math.round(weights.polls * 100)}% סקרים
        </p>
      )}
    </section>
  );
}

function buildHeadline(
  coalition: { seats: number; delta: number; direction: string },
  opposition: { seats: number; delta: number; direction: string },
  togetherDir: string
): React.ReactNode {
  const oppGap = (61 - opposition.seats).toFixed(1);
  const govGap = (61 - coalition.seats).toFixed(1);

  if (opposition.direction === "gaining" && coalition.direction !== "gaining") {
    return (
      <>
        <span className="highlight">גוש האופוזיציה צובר מומנטום</span>
        {" — "}{oppGap} מנדטים מרוב. הממשלה {govGap} מנדטים מרוב
      </>
    );
  }

  if (coalition.direction === "gaining" && opposition.direction !== "gaining") {
    return (
      <>
        <span className="highlight">גוש הקואליציה צובר מומנטום</span>
        {" — "}{govGap} מנדטים מרוב. האופוזיציה {oppGap} מנדטים מרוב
      </>
    );
  }

  if (togetherDir === "gaining") {
    return (
      <>
        <span className="highlight">יחד</span> מובילה לראשונה —{" "}
        {(opposition.seats - coalition.seats).toFixed(1)} מנדטים מעל הקואליציה
      </>
    );
  }

  return (
    <>
      שני הגושים ב<span className="highlight">פרלמנט תלוי</span> —
      ממשלה {govGap} מרוב · אופוזיציה {oppGap} מרוב
    </>
  );
}
