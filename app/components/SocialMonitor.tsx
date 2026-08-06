interface Hashtag {
  rank: number;
  tag: string;
  count: string;
  active?: boolean;
}

interface Post {
  name: string;
  handle: string;
  profileUrl: string;
  initials: string;
  avatarBg: string;
  minsAgo: number;
  text: string;
  replies: number;
  retweets: number;
  likes: number;
  views: string;
}

const HASHTAGS: Hashtag[] = [
  { rank: 1, tag: "בחירות2026",      count: "128K", active: true },
  { rank: 2, tag: "נתניהו",           count: "85K" },
  { rank: 3, tag: "החלפת_השלטון",    count: "63K" },
  { rank: 4, tag: "יוקר_המחיה",      count: "42K" },
  { rank: 5, tag: "בנט_ראש_ממשלה",   count: "31K" },
  { rank: 6, tag: "גוש_השינוי",       count: "24K" },
  { rank: 7, tag: "ממשלת_אחדות",      count: "19K" },
  { rank: 8, tag: "חוק_הגיוס",        count: "14K" },
];

const POSTS: Post[] = [
  {
    name: "נפתלי בנט",
    handle: "@naftalibennett",
    profileUrl: "https://x.com/naftalibennett",
    initials: "נב",
    avatarBg: "#7c3aed",
    minsAgo: 9,
    text: "יחד הוכחנו שאפשר לגבש גוש חזק. האיחוד עם יש עתיד הוא הצעד הנכון לישראל. ביחד נשנה את פני המדינה.",
    replies: 38, retweets: 24, likes: 187, views: "4.8K",
  },
  {
    name: "בנימין נתניהו",
    handle: "@netanyahu",
    profileUrl: "https://x.com/netanyahu",
    initials: "בנ",
    avatarBg: "#1d4ed8",
    minsAgo: 12,
    text: "הליכוד ממשיך להיות עמוד השדרה של ישראל. נקים ממשלה יציבה שתשמור על ביטחוננו.",
    replies: 52, retweets: 31, likes: 213, views: "5.2K",
  },
  {
    name: "אביגדור ליברמן",
    handle: "@AvigdorLiberman",
    profileUrl: "https://x.com/AvigdorLiberman",
    initials: "אל",
    avatarBg: "#0369a1",
    minsAgo: 15,
    text: "ישראל ביתנו מציגה תוכנית כלכלית שתוריד את יוקר המחיה. 9 מנדטים, כוח ממשי בכנסת.",
    replies: 29, retweets: 18, likes: 142, views: "3.7K",
  },
  {
    name: "יאיר גולן",
    handle: "@YairGolan1",
    profileUrl: "https://x.com/YairGolan1",
    initials: "יג",
    avatarBg: "#c2410c",
    minsAgo: 21,
    text: "הדמוקרטים מייצגים את כל מי שרוצה ישראל דמוקרטית ושוויונית. 8 מנדטים ועוד לפנינו.",
    replies: 21, retweets: 14, likes: 98, views: "2.4K",
  },
  {
    name: "גדי איזנקוט",
    handle: "@gadi_eisenkot",
    profileUrl: "https://x.com/gadi_eisenkot",
    initials: "גא",
    avatarBg: "#0f766e",
    minsAgo: 34,
    text: "ישר ממשיך להציג מדיניות ביטחונית אחראית. רק ממשלה יציבה תוכל להתמודד עם האתגרים בפנינו.",
    replies: 17, retweets: 11, likes: 76, views: "1.9K",
  },
  {
    name: "איתמר בן גביר",
    handle: "@itamarbengvir",
    profileUrl: "https://x.com/itamarbengvir",
    initials: "בג",
    avatarBg: "#b45309",
    minsAgo: 47,
    text: "עוצמה יהודית תמשיך לשמור על ערכי הימין. 8 מנדטים בסקרים האחרונים מוכיחים שהציבור איתנו.",
    replies: 44, retweets: 27, likes: 231, views: "6.1K",
  },
];

function XIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="xpost-x-icon" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}

function ReplyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function RepostIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="17 1 21 5 17 9"/>
      <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
      <polyline points="7 23 3 19 7 15"/>
      <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  );
}

function ViewsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  );
}

function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export default function SocialMonitor() {
  return (
    <div className="card social-card fade-in">
      <div className="card-header">
        <span className="card-title"># מוניטור רשתות</span>
        <span className="card-subtitle">נושאים חמים עכשיו</span>
      </div>

      {/* Hashtag chips — horizontal scroll */}
      <div className="hashtag-scroll-wrap">
        <div className="hashtag-chips-row">
          {HASHTAGS.map((h) => (
            <a
              key={h.rank}
              className={`hashtag-chip${h.active ? " active" : ""}`}
              href={`https://x.com/search?q=%23${encodeURIComponent(h.tag)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`חפש #${h.tag} ב-X`}
            >
              <span className="hashtag-chip-rank">{h.rank}</span>
              <span className="hashtag-chip-tag">#{h.tag}</span>
              <span className="hashtag-chip-count">{h.count}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Posts subheader */}
      <div className="posts-subheader">
        <span className="posts-subheader-title">פוסטים נבחרים</span>
        <span className="posts-subheader-note">
          הפוסטים נבחרים אוטומטית לפי רלוונטיות ותפוצה
        </span>
      </div>

      {/* XPostCard-style cards */}
      <div className="xposts-wrap">
        <div className="xposts-grid">
          {POSTS.map((post) => (
            <div key={post.handle} className="xpost-card">
              {/* Header: avatar + names + X icon */}
              <div className="xpost-header">
                <div className="xpost-author-block">
                  <div className="xpost-avatar" style={{ background: post.avatarBg }} aria-hidden="true">
                    {post.initials}
                  </div>
                  <div className="xpost-names">
                    <div className="xpost-name">
                      {post.name}
                      <span className="xpost-verified" aria-label="מאומת" title="חשבון מאומת">✓</span>
                    </div>
                    <div className="xpost-handle">{post.handle} · {post.minsAgo} דק׳</div>
                  </div>
                </div>
                <XIcon />
              </div>

              {/* Text */}
              <p className="xpost-text">{post.text}</p>

              {/* Engagement row */}
              <div className="xpost-stats" aria-label="סטטיסטיקות פוסט">
                <span className="xpost-stat xpost-reply" title="תגובות">
                  <ReplyIcon />{fmt(post.replies)}
                </span>
                <span className="xpost-stat xpost-repost" title="שיתופים">
                  <RepostIcon />{fmt(post.retweets)}
                </span>
                <span className="xpost-stat xpost-like" title="לייקים">
                  <HeartIcon />{fmt(post.likes)}
                </span>
                <span className="xpost-stat xpost-views" title="צפיות">
                  <ViewsIcon />{post.views}
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="xposts-disclaimer">
          הפוסטים מוצגים בהדמיית מערכת מתוך נתוני בינה מלאכותית. הנתונים מתעדכנים אוטומטית.
        </p>
      </div>
    </div>
  );
}
