import { marqueePhotos } from "@/app/components/photoMarqueeData";
import { personJsonLd, site } from "./site";

export const consoleContent = {
  banner: [
    "+----------------------------------+",
    "|  peter@portfolio:~               |",
    "|  A little more beneath the hood. |",
    "+----------------------------------+",
  ].join("\n"),
  welcome:
    "Hey, I'm Peter. You found my little corner of the console!\nCheck out my research, some things I've built, and a few things off the clock.",
  about: [
    "Hello! I'm Zeyu (Peter) Yao 姚则禹. I grew up in Singapore.",
    "Currently serving National Service! Soon-to-be Class of 2032 @ Carnegie Mellon University.",
    "I use and build computational tools to understand complex biological systems: how they change, adapt, and sometimes break down.",
    "Alongside research, I enjoy building inclusive communities and helping people learn, create, and find opportunities through computing.",
  ],
  research: [
    ["Research portfolio", "https://research.zeyuyaoy.com"],
    ["Using computational tools", "https://research.zeyuyaoy.com/garcia"],
    ["Building new tools", "https://research.zeyuyaoy.com/orcid-162573947"],
    ["Understanding biological systems", "https://research.zeyuyaoy.com/biorsp-posters"],
  ],
  researchTopics: personJsonLd.knowsAbout,
  interests: ["Jazz guitar", "Running", "Swimming", "Photography"],
  contact: [
    ["Portfolio", site.url],
    ["GitHub", personJsonLd.sameAs[2]],
    ["Twitter / X", personJsonLd.sameAs[0]],
    ["Instagram", "https://www.instagram.com/zeyuyaoy/"],
    ["LinkedIn", personJsonLd.sameAs[1]],
    ["Email", "mailto:cytronicoder+hi@gmail.com"],
  ],
  github: personJsonLd.sameAs[2],
  photos: [
    ["Photo 1 from the marquee", marqueePhotos[0]],
    ["Photo 34 from the marquee", marqueePhotos[33]],
    ["Photo 66 from the marquee", marqueePhotos[65]],
  ],
  conan: "   .---.\n  /     \\\n  \\     /\n   '---'\\\n         \\",
  conanMessage: "Case closed. You found Conan.",
  motto: "Per aspera ad astra.",
} as const;

export const commandGuide = {
  about: ["Explore", "peter.about()", "Hello! Learn more about me."],
  projects: [
    "Explore",
    'peter.projects() · peter.projects("name")',
    "List my projects, or look up any project by its name",
  ],
  research: ["Explore", "peter.research()", "Research interests and links from the homepage"],
  interests: ["Explore", "peter.interests()", "A few things off the clock"],
  photos: ["Explore", "peter.photos()", "A few photographs from the page's photo marquee"],
  contact: ["Explore", "peter.contact()", "Public profiles and personal email"],
  themes: ["Make yourself at home", "peter.themes()", "Available presets and current appearance"],
  theme: [
    "Make yourself at home",
    'peter.theme("editorial")',
    "Apply an available preset. Cyberpunk selects dark mode; use peter.mode() to change mode afterwards.",
  ],
  mode: ["Make yourself at home", 'peter.mode("dark")', "Set light, dark, or system mode"],
  resetAppearance: [
    "Make yourself at home",
    "peter.resetAppearance()",
    "Reset appearance preferences, including photo speed, while keeping existing theme unlocks",
  ],
  hint: ["Discover", "peter.hint()", "A clue to the next personal discovery"],
  banner: ["Discover", "peter.banner()", "Redisplay the welcome card without clearing the console"],
  help: ["Discover", 'peter.help() · peter.help("projects")', "Show this guide!"],
} as const;
