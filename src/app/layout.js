import { Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
});

export const metadata = {
  title: "Zeyu Yao | 姚则禹",
  description:
    "I build projects in @hackclub and @aimed-lab! Previously at @buildingblocs, @saishackclub, and @geekcampsg. I'm a student in Singapore passionate about innovative tech and digital design.",
  keywords: [
    "Zeyu Yao",
    "Yao Zeyu",
    "姚则禹",
    "Hack Club",
    "AI.MED Lab",
    "AIMED Lab",
    "BuildingBloCS",
    "SAIS Hack Club",
    "Geekcamp SG",
    "Singapore student",
    "tech projects",
    "software development",
    "full-stack developer",
    "frontend development",
    "backend development",
    "web development",
    "JavaScript",
    "TypeScript",
    "React.js",
    "Next.js",
    "Node.js",
    "Python",
    "Machine Learning",
    "AI development",
    "computer science",
    "open-source contributions",
    "digital design",
    "UI/UX design",
    "creative coding",
    "visual computing",
    "Singapore tech community",
    "Hackathons in Singapore",
    "student developer Singapore",
    "startup ecosystem Singapore",
    "cytronicoder",
    "cytronical",
    "Zeyu Yao portfolio",
    "Zeyu Yao projects",
    "Zeyu Yao website",
    "Zeyu Yao GitHub",
    "Zeyu Yao LinkedIn",
    "Zeyu Yao resume",
    "student entrepreneur",
    "hackathon organizer",
    "technology evangelist",
    "coding mentor",
    "tech innovation"
  ].join(", "),
  authors: [{ name: "Zeyu Yao", url: "https://cytronicoder.com" }],
  robots: { index: true, follow: true },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-32x32.png",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://cytronicoder.com",
    title: "Zeyu Yao | 姚则禹",
    description:
      "I build projects in @hackclub and @aimed-lab! Previously at @buildingblocs, @saishackclub, and @geekcampsg. I'm a student in Singapore passionate about innovative tech and digital design.",
    siteName: "Zeyu Yao",
    images: [
      {
        url: "https://cytronicoder.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "Zeyu Yao | 姚则禹",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Zeyu Yao | 姚则禹",
    description:
      "I build projects in @hackclub and @aimed-lab! Previously at @buildingblocs, @saishackclub, and @geekcampsg. I'm a student in Singapore passionate about innovative tech and digital design.",
    creator: "@cytronicoder",
    images: ["https://cytronicoder.com/og-image.png"],
  },
  alternatesJSONLD: {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Zeyu Yao",
    alternateName: "姚则禹",
    url: "https://cytronicoder.com",
    sameAs: [
      "https://twitter.com/cytronicoder",
      "https://www.linkedin.com/in/cytronicoder/",
      "https://github.com/cytronicoder"
    ],
    jobTitle: "Student",
    description:
      "I build projects in @hackclub and @aimed-lab! Previously at @buildingblocs, @saishackclub, and @geekcampsg. I'm a student in Singapore passionate about innovative tech and digital design."
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(metadata.alternatesJSONLD),
          }}
        />
      </head>
      <body className={`${nunito.className} ${nunito.variable}`}>
        {children}
      </body>
    </html>
  );
}
