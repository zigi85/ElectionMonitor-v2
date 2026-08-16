export default function TopKnessetBar() {
  return (
    <div className="knesset-bar" role="banner" aria-label="כותרת מוניטור הבחירות">
      <div className="knesset-bar-inner">
        <div className="hero-politicians">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/politicians-rope.png"
            alt="פוליטיקאים ישראליים"
            className="hero-politicians-img"
          />
        </div>
        <div className="hero-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logo-monitor.png"
            alt="מוניטור בחירות '26"
            className="hero-logo-img"
          />
          <p className="hero-tagline">עקוב אחר תוצאות הבחירות בזמן אמת</p>
        </div>
      </div>
    </div>
  );
}
