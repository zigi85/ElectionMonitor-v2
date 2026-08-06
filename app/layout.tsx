import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "מוניטור הבחירות — ישראל היום | Elections Monitor",
  description:
    "מוניטור הבחירות של ישראל היום — ממוצע סקרים שבועי, שוקי ניבוי, ומדד מומנטום לבחירות 2026",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
  other: {
    // Allow indexing only when embedded on the Israel Hayom elections page
    robots: "indexifembedded",
  },
};

const schemaOrg = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "מוניטור הבחירות — ישראל היום",
  description:
    "ממוצע סקרים שבועי, שוקי ניבוי (Polymarket), ומדד מומנטום לבחירות לכנסת ה-26 (אוקטובר 2026)",
  creator: { "@type": "Organization", name: "ישראל היום" },
  license: "https://www.israelhayom.co.il",
  inLanguage: "he",
  temporalCoverage: "2026",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="indexifembedded" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrg) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
