import { getWidgetData } from "@/lib/data";
import TopKnessetBar from "./components/TopKnessetBar";
import KnessetHemicycle from "./components/KnessetHemicycle";
import PredictionMarkets from "./components/PredictionMarkets";
import GoogleTrends from "./components/GoogleTrends";
import MediaMentions from "./components/MediaMentions";
import ElectionCountdown from "./components/ElectionCountdown";
import SocialMonitor from "./components/SocialMonitor";
import WikipediaBuzz from "./components/WikipediaBuzz";
import DailyDigest from "./components/DailyDigest";

export const revalidate = 300;

export default async function HomePage() {
  const { polymarket, manualPolls, trends, mediaMentions, socialData, dailyDigest } = await getWidgetData();

  return (
    <div className="app-shell">
      <TopKnessetBar />

      <main className="app-content">
        <ElectionCountdown />
        <KnessetHemicycle manualPolls={manualPolls} />
        <DailyDigest dailyDigest={dailyDigest} />
        <PredictionMarkets polymarket={polymarket} />
        <GoogleTrends trends={trends} />
        <MediaMentions mediaMentions={mediaMentions} />
        <WikipediaBuzz leaderBuzz={socialData.leader_buzz} />
        <SocialMonitor socialData={socialData} />

        <footer className="app-footer">
          <div className="app-footer-brand">
            <a href="https://election-ideas-hub.lovable.app/methodology" className="methodology-link" target="_blank" rel="noopener noreferrer">איך זה עובד?</a>
            <span className="footer-sep">|</span>
            <a href="https://election-ideas-hub.lovable.app/" className="methodology-link" target="_blank" rel="noopener noreferrer">דברו איתנו</a>
          </div>
        </footer>
      </main>
    </div>
  );
}
