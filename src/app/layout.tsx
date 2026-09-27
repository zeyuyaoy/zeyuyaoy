import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Comic_Neue, Nunito } from "next/font/google";
import { personJsonLd, site, websiteJsonLd } from "@/lib/site";
import "./globals.css";
import "./appearance.css";
import { appearanceBootstrapScript } from "@/lib/appearance";
import AppearanceRuntime from "./components/AppearanceRuntime";
import KonamiRuntime from "./components/KonamiRuntime";
import CmuReferralAnalytics from "./components/CmuReferralAnalytics";

const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito" });

const comic = Comic_Neue({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-comic",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  alternates: { canonical: "/" },
  title: site.title,
  description: site.description,
  authors: [{ name: "Zeyu Yao", url: site.url }],
  robots: { index: true, follow: true },
  icons: { icon: "/favicon.ico", shortcut: "/favicon-32x32.png", apple: "/apple-touch-icon.png" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: site.url,
    title: site.title,
    description: site.description,
    siteName: site.name,
    images: [
      {
        url: "/og-image.jpg",
        width: 1080,
        height: 607,
        alt: "Peter in Singapore",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: site.title,
    description: site.description,
    creator: "@zeyuyaoy",
    images: [{ url: "/og-image.jpg", alt: "Peter in Singapore" }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${nunito.variable} ${comic.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceBootstrapScript() }} />
      </head>
      <body>
        <AppearanceRuntime />
        <KonamiRuntime />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([personJsonLd, websiteJsonLd]).replace(/</g, "\\u003c"),
          }}
        />
        {children}
        <CmuReferralAnalytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
