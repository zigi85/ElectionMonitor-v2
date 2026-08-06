function IHLogo() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg" aria-label="ישראל היום" className="knesset-bar-logo">
      <rect width="44" height="44" rx="8" fill="#071B4D"/>
      <clipPath id="kbar-clip"><rect width="44" height="44" rx="8"/></clipPath>
      <g clipPath="url(#kbar-clip)">
        <line x1="-2" y1="36" x2="32" y2="-4" stroke="white" strokeWidth="7" opacity="0.9"/>
        <line x1="10" y1="48" x2="46" y2="4"  stroke="white" strokeWidth="7" opacity="0.9"/>
        <line x1="22" y1="54" x2="58" y2="10" stroke="white" strokeWidth="7" opacity="0.9"/>
        <rect x="26" y="28" width="20" height="18" fill="#E21B2D"/>
      </g>
    </svg>
  );
}

export default function TopKnessetBar() {
  return (
    <div className="knesset-bar" role="banner" aria-label="כותרת מוניטור הבחירות">
      <div className="knesset-bar-inner">
        <div className="knesset-bar-brand">
          <IHLogo />
          <div className="knesset-bar-title-group">
            <h1 className="knesset-bar-h1">מוניטור הבחירות</h1>
          </div>
        </div>
      </div>
    </div>
  );
}
