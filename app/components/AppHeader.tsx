import type { PollsData } from "@/lib/types";
import RefreshButton from "./RefreshButton";

interface AppHeaderProps {
  polls: PollsData;
  daysLeft: number;
}

function IHLogo() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg" aria-label="ישראל היום">
      <rect width="44" height="44" rx="8" fill="#093170"/>
      <clipPath id="logo-clip"><rect width="44" height="44" rx="8"/></clipPath>
      <g clipPath="url(#logo-clip)">
        <line x1="-2" y1="36" x2="32" y2="-4" stroke="white" strokeWidth="7" opacity="0.9"/>
        <line x1="10" y1="48" x2="46" y2="4"  stroke="white" strokeWidth="7" opacity="0.9"/>
        <line x1="22" y1="54" x2="58" y2="10" stroke="white" strokeWidth="7" opacity="0.9"/>
        <rect x="26" y="28" width="20" height="18" fill="#fe6969"/>
      </g>
    </svg>
  );
}

export default function AppHeader({ polls, daysLeft }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header-brand">
        <div className="app-header-title-group">
          <h1 className="app-header-title">מוניטור הבחירות</h1>
          <span className="app-header-days">{daysLeft} ימים לבחירות</span>
        </div>
        <IHLogo />
      </div>
      <RefreshButton generatedAt={polls.generated_at} />
    </header>
  );
}
