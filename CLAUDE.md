# Israel Hayom Elections Monitor Widget

This workspace contains an embeddable, mobile-first, RTL Hebrew widget called **מוניטור הבחירות** for Israel Hayom's elections page.

Israeli legislative elections are scheduled for **27.10.2026**. The widget aggregates polling data, prediction market signals, and Google Trends momentum into a single glanceable view.

## Scope

- Momentum Index hero
- Weekly polling aggregation
- Polymarket prediction market cards
- Static JSON demo data under `public/data`
- Python data scripts under `scripts`

## Editorial Rules

- Direct Polls are included in raw polling data but excluded from weekly averages.
- Weeks with fewer than 3 included polling firms are marked `sparse: true`.
- Momentum is directional only. It is not an election prediction.
- Google Trends is a pluggable signal and must never crash momentum calculation if unavailable.

## Tech Notes

- Next.js App Router
- Hebrew only, `dir="rtl"`, `lang="he"`
- Mobile-first at 360px minimum
- CSS-only charts and sparklines
- Static JSON can be replaced by API endpoints in production
