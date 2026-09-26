import type {Metadata} from "next";
import type {ReactNode} from "react";
import {SpeedInsights} from "@vercel/speed-insights/next";
import {Comic_Neue, Nunito} from "next/font/google";
import {personJsonLd, site} from "@/lib/site";
import "./globals.css";
import "./appearance.css";
import {appearanceBootstrapScript} from "@/lib/appearance";
import AppearanceRuntime from "./components/AppearanceRuntime";
import CmuReferralAnalytics from "./components/CmuReferralAnalytics";

const nunito = Nunito({subsets: ["latin"], variable: "--font-nunito"});

const comic = Comic_Neue({
    subsets: ["latin"],
    weight: ["400", "700"],
    variable: "--font-comic",
    display: "swap",
    preload: false
});

export const metadata: Metadata = {
    metadataBase: new URL(site.url),
    alternates: {canonical: "/"},
    title: site.title,
    description: site.description,
    authors: [{name: "Zeyu Yao", url: site.url}],
    robots: {index: true, follow: true},
    icons: {icon: "/favicon.ico", shortcut: "/favicon-32x32.png", apple: "/apple-touch-icon.png"},
    openGraph: {
        type: "website",
        locale: "en_US",
        url: site.url,
        title: site.title,
        description: site.description,
        siteName: "Zeyu Yao",
        images: [{
            url: "/og-image.png", width: 1920, height: 1080,
            alt: "Cytronicoder emblem over a sunset landscape",
        }],
    },
    twitter: {
        card: "summary_large_image",
        title: site.title,
        description: site.description,
        creator: "@zeyuyaoy",
        images: [{url: "/og-image.png", alt: "Cytronicoder emblem over a sunset landscape"}],
    },
};

export default function RootLayout({children}: { children: ReactNode }) {
    return (
        <html lang="en" className={`${nunito.variable} ${comic.variable}`} suppressHydrationWarning>
        <head>
            <script dangerouslySetInnerHTML={{__html: appearanceBootstrapScript()}}/>
        </head>
        <body>
        <AppearanceRuntime/>
        <script type="application/ld+json" dangerouslySetInnerHTML={{
            __html: JSON.stringify(personJsonLd).replace(/</g, "\\u003c"),
        }}/>
        {children}
        <CmuReferralAnalytics/>
        <SpeedInsights/>
        </body>
        </html>
    );
}
