import {marqueePhotos} from "@/app/components/photoMarqueeData";
import {personJsonLd, site} from "./site";

export const consoleContent = {
  banner: [
    "╭──────────────────────────────────╮",
    "│  peter@portfolio:~               │",
    "│  A little more beneath the hood. │",
    "╰──────────────────────────────────╯",
  ].join("\n"),
  welcome:
    "Hey, I'm Peter. You found my little corner of the console.\nResearch, things I've built, and a few things off the clock.",
  about: [
    "Hello! I'm Zeyu (Peter) Yao 姚则禹. I grew up in Singapore.",
    "Currently serving National Service! Soon-to-be Class of 2032 @ Carnegie Mellon.",
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
  about: ["Explore", "peter.about()", "Meet Zeyu / Peter: Singapore, research, and community."],
  projects: [
    "Explore",
    'peter.projects() · peter.projects("name")',
    "List eight projects, or look up any project by its exact name (case-insensitive).",
  ],
  research: ["Explore", "peter.research()", "Research interests and links from the homepage."],
  interests: ["Explore", "peter.interests()", "A few things off the clock."],
  photos: ["Explore", "peter.photos()", "Three photographs from the page's photo marquee."],
  contact: ["Explore", "peter.contact()", "Public profiles and personal email."],
  themes: ["Make yourself at home", "peter.themes()", "Available presets and current appearance."],
  theme: [
    "Make yourself at home",
    'peter.theme("editorial")',
    "Apply an available preset; keeps text size, motion, and photo speed. Cyberpunk selects dark mode; other presets keep the current mode.",
  ],
  mode: ["Make yourself at home", 'peter.mode("dark")', "Set light, dark, or system mode."],
  resetAppearance: [
    "Make yourself at home",
    "peter.resetAppearance()",
    "Reset all appearance preferences, including photo speed; keep any existing Cyberpunk unlock.",
  ],
  hint: ["Discover", "peter.hint()", "A clue to the next personal discovery."],
  banner: [
    "Discover",
    "peter.banner()",
    "Redisplay the welcome card without clearing the console.",
  ],
  help: [
    "Discover",
    'peter.help() · peter.help("projects")',
    "Show this guide, or get help with one command.",
  ],
} as const;
