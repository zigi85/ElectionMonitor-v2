import { readFile } from "node:fs/promises";
import path from "node:path";
import type { EditorialData, GoogleTrendsData, MediaMentionsData, MomentumData, PollsData, PolymarketData, ManualPollsData, SocialData } from "./types";

async function readJson<T>(fileName: string): Promise<T> {
  const filePath = path.join(process.cwd(), "public", "data", fileName);
  const body = await readFile(filePath, "utf8");
  return JSON.parse(body) as T;
}

// Fetch live Polymarket data; falls back to static JSON on any failure
async function fetchPolymarket(): Promise<PolymarketData> {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    const res = await fetch(`${baseUrl}/api/polymarket`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) throw new Error(`API ${res.status}`);
    const live = (await res.json()) as PolymarketData & { is_live?: boolean };

    if (live.is_live && live.markets.length > 0) {
      return live;
    }
    throw new Error("No live markets");
  } catch {
    return readJson<PolymarketData>("polymarket.json");
  }
}

export async function getWidgetData() {
  const [polymarket, manualPolls, trends, mediaMentions, socialData] = await Promise.all([
    fetchPolymarket(),
    readJson<ManualPollsData>("polls_manual.json"),
    readJson<GoogleTrendsData>("google_trends.json").catch(() => ({
      generated_at: "",
      status: "error" as const,
      timeframe: "",
      geo: "",
      keywords: [],
    } as GoogleTrendsData)),
    readJson<MediaMentionsData>("media_mentions.json").catch(() => ({
      generated_at: "",
      period: "",
      period_label: "",
      source: "",
      leaders: [],
    } as MediaMentionsData)),
    readJson<SocialData>("social.json").catch(() => ({
      generated_at: "",
      headline_count: 0,
      hot_topics: [],
      leader_buzz: [],
    } as SocialData)),
  ]);

  return { polymarket, manualPolls, trends, mediaMentions, socialData };
}

// Keep legacy exports for any remaining references
export async function getLegacyData() {
  const [polls, trends, momentum, editorial] = await Promise.all([
    readJson<PollsData>("polls.json").catch(() => ({ generated_at: "", source_urls: [], raw_polls: [], weekly_averages: [] } as PollsData)),
    readJson<GoogleTrendsData>("google_trends.json").catch(() => ({ generated_at: "", available: false, keywords: [], series: [] } as GoogleTrendsData)),
    readJson<MomentumData>("momentum.json").catch(() => null),
    readJson<EditorialData>("editorial.json").catch(() => ({ updated_at: "", entries: [] } as EditorialData)),
  ]);
  return { polls, trends, momentum, editorial };
}
