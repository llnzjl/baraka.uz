import EntryGate from "@/components/EntryGate";
/* eslint-disable @next/next/no-page-custom-font */
import "./globals.css";
import "./silk-road.css";
import "./booking.css";
import "./orders.css";
import type { Metadata } from "next";
import { restaurant } from "@/data/restaurant";

export const metadata: Metadata = {
  title: "BARAKA · Uzbek Kitchen in Cheongju | 우즈벡할랄식당",
  description: "A taste of Uzbekistan in Cheongju. Explore the menu, meet Chef Asr, and find 우즈벡할랄식당 at 178 Sinyul-ro, Bokdae-dong. Call 043-268-8329.",
  icons: { icon: "/brand-icon.svg", apple: "/brand-icon.svg" },
  openGraph: {
    title: "BARAKA · A Taste of Uzbekistan, in the Heart of Korea.",
    description: "Good food. A warm welcome. Explore our Uzbek kitchen and meet Chef Asr.",
    type: "website", locale: "ko_KR", alternateLocale: "en_US",
  },

};

export const viewport = { themeColor: "#102C3C" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const structuredData = {
    "@context": "https://schema.org", "@type": "Restaurant",
    name: restaurant.name, alternateName: restaurant.koreanName,
    telephone: "+82-43-268-8329", servesCuisine: ["Uzbek", "Central Asian"],
    address: { "@type": "PostalAddress", streetAddress: "신율로 178", addressLocality: "청주시 흥덕구", addressRegion: "충청북도", addressCountry: "KR" },
    geo: { "@type": "GeoCoordinates", latitude: restaurant.latitude, longitude: restaurant.longitude },
    hasMap: restaurant.naverMap,
  };
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display:ital@0;1&family=Noto+Sans+KR:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      </head>
      <body><EntryGate>{children}</EntryGate></body>
    </html>
  );
}
