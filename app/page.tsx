import { getWidgetData } from "@/lib/data";
import TopKnessetBar from "./components/TopKnessetBar";
import KnessetHemicycle from "./components/KnessetHemicycle";
import PredictionMarkets from "./components/PredictionMarkets";
import SocialMonitor from "./components/SocialMonitor";

export const revalidate = 300;

export default async function HomePage() {
  const { polymarket, manualPolls } = await getWidgetData();

  return (
    <div className="app-shell">
      <TopKnessetBar />

      <main className="app-content">
        <KnessetHemicycle manualPolls={manualPolls} />
        <PredictionMarkets polymarket={polymarket} />
        <SocialMonitor />

        <footer className="app-footer">
          <div className="app-footer-brand">
            <a href="/methodology" className="methodology-link">מתודולוגיה</a>
          </div>
        </footer>
      </main>
    </div>
  );
}
