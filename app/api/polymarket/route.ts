import { NextResponse } from "next/server";
import type { PolymarketData, PolymarketMarket, MarketOutcome } from "@/lib/types";

export const revalidate = 300; // 5 minutes

const GAMMA = "https://gamma-api.polymarket.com";

// Hebrew name mapping for Next PM candidates
const CANDIDATE_NAMES: Record<string, string> = {
  Netanyahu: "בנימין נתניהו",
  Bennett: "נפתלי בנט",
  Lapid: "יאיר לפיד",
  Lieberman: "אביגדור ליברמן",
  Gantz: "בני גנץ",
  Eizenkot: "גדי איזנקוט",
  Eisenkot: "גדי איזנקוט",
  Golan: "יאיר גולן",
  Dermer: "רון דרמר",
  Katz: "ישראל כץ",
  Saar: "גדעון סער",
};

function extractCandidateName(question: string): string {
  for (const [en, he] of Object.entries(CANDIDATE_NAMES)) {
    if (question.includes(en)) return he;
  }
  // Fallback: word after "Will "
  const m = question.match(/Will\s+(\S+)/);
  return m ? m[1] : question;
}

// Market configs: key -> list of slugs to try
const MARKET_CONFIGS: Array<{
  key: PolymarketMarket["key"];
  title: string;
  slugs: string[];
}> = [
  {
    key: "next_pm",
    title: "ראש הממשלה הבא",
    slugs: ["who-will-be-the-next-prime-minister-of-israel-after-the-next-election"],
  },
  {
    key: "hung_parliament",
    title: "האם הבחירות יסתיימו ללא רוב לאף אחד מהגושים?",
    slugs: ["israeli-election-results-in-a-hung-parliament"],
  },
  {
    key: "likud_seats",
    title: "ליכוד — כמה מנדטים?",
    slugs: ["israel-election-likud-of-seats"],
  },
];

async function fetchEvent(slug: string): Promise<unknown[] | null> {
  try {
    const res = await fetch(`${GAMMA}/events?slug=${slug}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) && data.length > 0 ? data : null;
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseOutcomes(event: any): MarketOutcome[] {
  try {
    const market = event.markets?.[0];
    if (!market) return [];
    const names: string[] = JSON.parse(market.outcomes ?? "[]");
    const prices: string[] = JSON.parse(market.outcomePrices ?? "[]");
    return names.map((name, i) => ({
      name,
      probability: parseFloat(prices[i] ?? "0"),
    }));
  } catch {
    return [];
  }
}

// For next_pm: each market in the event is a binary Yes/No for one candidate.
// outcomePrices[0] = Yes price = candidate probability.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseNextPmOutcomes(event: any): MarketOutcome[] {
  try {
    const markets = event.markets;
    if (!Array.isArray(markets) || markets.length === 0) return [];
    const outcomes: MarketOutcome[] = [];
    for (const m of markets) {
      const prices: string[] = JSON.parse(m.outcomePrices ?? "[]");
      const yesP = parseFloat(prices[0] ?? "0");
      if (yesP > 0) {
        const question: string = m.question ?? m.title ?? "";
        outcomes.push({ name: extractCandidateName(question), probability: yesP });
      }
    }
    return outcomes.sort((a, b) => b.probability - a.probability);
  } catch {
    return [];
  }
}

const LIKUD_RANGE_LABELS: Record<string, string> = {
  "fewer than 20": "פחות מ-20",
  "20-24": "20-24",
  "25-29": "25-29",
  "30-34": "30-34",
  "35 or more": "35+",
};

function extractLikudRange(question: string): string {
  for (const [en, he] of Object.entries(LIKUD_RANGE_LABELS)) {
    if (question.toLowerCase().includes(en.toLowerCase())) return he;
  }
  const m = question.match(/(\d[\d\-\+]*\s*(?:or more)?)\s*seats/i);
  return m ? m[1] : question;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseLikudSeatsOutcomes(event: any): MarketOutcome[] {
  try {
    const markets = event.markets;
    if (!Array.isArray(markets) || markets.length === 0) return [];
    const outcomes: MarketOutcome[] = [];
    for (const m of markets) {
      const prices: string[] = JSON.parse(m.outcomePrices ?? "[]");
      const yesP = parseFloat(prices[0] ?? "0");
      const question: string = m.question ?? m.title ?? "";
      outcomes.push({ name: extractLikudRange(question), probability: yesP });
    }
    return outcomes.sort((a, b) => b.probability - a.probability);
  } catch {
    return [];
  }
}

export async function GET() {
  const now = new Date().toISOString();
  const markets: PolymarketMarket[] = [];

  for (const config of MARKET_CONFIGS) {
    let found = false;
    for (const slug of config.slugs) {
      const events = await fetchEvent(slug);
      if (!events) continue;
      const outcomes = config.key === "next_pm"
        ? parseNextPmOutcomes(events[0])
        : config.key === "likud_seats"
        ? parseLikudSeatsOutcomes(events[0])
        : parseOutcomes(events[0]);
      if (outcomes.length === 0) continue;
      markets.push({
        key: config.key,
        title: config.title,
        slug,
        url: `https://polymarket.com/event/${slug}`,
        updated_at: now,
        outcomes,
      });
      found = true;
      break;
    }
    if (!found) {
      // Push null market — caller will fall back to JSON
    }
  }

  const data: PolymarketData & { is_live: boolean } = {
    generated_at: now,
    is_live: markets.length > 0,
    markets,
  };

  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
  });
}
