export type BlocKey = "coalition" | "opposition" | "unaligned";

// ─── Manual polls (polls_manual.json) ────────────────────────────────────────
export interface ManualPartyMeta {
  name_he: string;
  leader: string;
  color: string;
  bloc: "coalition" | "opposition" | "unaligned";
  order: number;
  note?: string;
}

export interface ManualPoll {
  outlet: string;
  outlet_id: string;
  parties: Record<string, number>;
  total: number;
  below_threshold_pcts?: Record<string, number>;
}

export interface ManualTimestamp {
  id: string;
  label: string;
  polls: ManualPoll[];
}

export interface ManualOutletMeta {
  name: string;
  order: number;
  note?: string;
}

export interface ManualPollsData {
  last_updated: string;
  timestamps: ManualTimestamp[];
  party_metadata: Record<string, ManualPartyMeta>;
  outlet_metadata: Record<string, ManualOutletMeta>;
}

export type PartyKey =
  | "likud"
  | "religious_zionism"
  | "otzma_yehudit"
  | "shas"
  | "utj"
  | "together"
  | "yisrael_beiteinu"
  | "democrats"
  | "yashar"
  | "raam"
  | "hadash_taal"
  | "balad"
  | "joint_list"
  | "reservists"
  | "bennett_2026"
  | "yesh_atid"
  | "blue_and_white";

export type MomentumDirection = "gaining" | "stable" | "losing";

export interface PartyMeta {
  key: PartyKey;
  name: string;
  leader?: string;
  leaderFull?: string;
  color: string;
  bloc: BlocKey;
}

export interface EditorialEntry {
  id: string;
  reporter: string;
  role: string;
  initials: string;
  avatar_color: string;
  quote: string;
  article_url: string;
  article_title: string;
  published_at: string;
}

export interface EditorialData {
  updated_at: string;
  entries: EditorialEntry[];
}

export interface RawPoll {
  id: string;
  date: string;
  iso_week: string;
  firm: string;
  publisher?: string;
  source_url: string;
  excluded_from_avg: boolean;
  exclusion_reason?: string;
  seats: Partial<Record<PartyKey, number | null>>;
}

export interface WeeklyAverage {
  iso_week: string;
  week_start: string;
  week_end: string;
  sparse: boolean;
  included_firms: string[];
  seats: Partial<Record<PartyKey, number>>;
  blocs: Record<BlocKey, number>;
}

export interface PollsData {
  generated_at: string;
  source_urls: string[];
  raw_polls: RawPoll[];
  weekly_averages: WeeklyAverage[];
}

export interface MarketOutcome {
  name: string;
  probability: number;
  previous_probability?: number;
  delta?: number;
}

export interface PolymarketMarket {
  key: "next_pm" | "hung_parliament" | "likud_seats";
  title: string;
  slug: string;
  url?: string;
  updated_at: string;
  outcomes: MarketOutcome[];
}

export interface PolymarketData {
  generated_at: string;
  is_live?: boolean;
  markets: PolymarketMarket[];
}

export interface TrendsSeriesPoint {
  date: string;
  values: Record<string, number>;
}

export interface TrendsWeeklyPoint {
  date: string;
  value: number;
}

export interface TrendsKeywordResult {
  keyword: string;
  keyword_en: string;
  current_interest: number | null;
  previous_interest: number | null;
  change_pct: number | null;
  direction: "rising" | "falling" | "stable";
  weekly_data: TrendsWeeklyPoint[];
  error?: string;
}

export interface GoogleTrendsData {
  generated_at: string;
  status: "ok" | "partial" | "error";
  timeframe: string;
  geo: string;
  keywords: TrendsKeywordResult[];
  error_message?: string;
  available?: boolean;
  series?: TrendsSeriesPoint[];
}

// ─── Media mentions (media_mentions.json) ───────────────────────────────────
export interface MediaHeadline {
  title: string;
  source: string;
  published_at: string;
  url?: string;
  fallback?: boolean;
}

export interface MediaLeader {
  key: string;
  name_he: string;
  role: string;
  party: string;
  mention_count: number;
  headlines: MediaHeadline[];
}

export interface MediaMentionsData {
  generated_at: string;
  period: string;
  period_label: string;
  source: string;
  leaders: MediaLeader[];
}

// ─── Social monitor (social.json) ───────────────────────────────────────────
export interface SocialHotTopic {
  id: string;
  label: string;
  mention_count: number;
  sample_headline?: string;
  sample_source?: string;
}

export interface SocialLeaderBuzz {
  key: string;
  name_he: string;
  views_7d: number;
  prev_views_7d: number;
  change_pct: number;
  direction: "rising" | "falling" | "stable";
}

export interface SocialYouTubeVideo {
  leader_key: string;
  name_he: string;
  title: string;
  published_at: string;
  url: string;
  thumbnail: string;
}

export interface TelegramPost {
  text: string;
  views: number;
  views_str: string;
  date: string;
}

export interface TelegramChannel {
  key: string;
  name_he: string;
  username: string;
  type: "politician" | "news";
  post_count: number;
  avg_views: number;
  avg_views_str: string;
  top_post?: TelegramPost;
}

export interface ViralVideo {
  video_id: string;
  title: string;
  channel: string;
  views: number;
  views_str: string;
  duration: string;
  published_text?: string;
  thumbnail: string;
  url: string;
}

export interface SocialData {
  generated_at: string;
  headline_count: number;
  hot_topics: SocialHotTopic[];
  leader_buzz: SocialLeaderBuzz[];
  youtube_videos?: SocialYouTubeVideo[];
  viral_videos?: ViralVideo[];
  telegram_channels?: TelegramChannel[];
}

export interface PartyMomentum {
  party: PartyKey;
  direction: MomentumDirection;
  score: number;
  signals: {
    polls?: number;
    polymarket?: number;
    google_trends?: number;
  };
  label: string;
}

export interface MomentumData {
  generated_at: string;
  weights: {
    polls: number;
    polymarket: number;
    google_trends: number;
  };
  degraded_sources: string[];
  parties: PartyMomentum[];
  blocs: Record<
    BlocKey,
    {
      seats: number;
      delta: number;
      direction: MomentumDirection;
    }
  >;
}
