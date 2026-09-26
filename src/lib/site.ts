export const site = {
    url: "https://zeyuyaoy.com",
    title: "Zeyu (Peter) Yao | 姚则禹 — Research & Projects",
    description: "Zeyu (Peter) Yao’s portfolio: single-cell analytics, gene-expression dynamics, AI-driven discovery tools, and inclusive STEM education in Singapore.",
};

export const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Zeyu Yao",
    alternateName: ["Peter Yao", "姚则禹"],
    url: site.url,
    description: site.description,
    knowsAbout: ["Single-cell analytics", "Gene-expression dynamics", "AI-driven discovery", "STEM education"],
    sameAs: [
        "https://twitter.com/zeyuyaoy",
        "https://www.linkedin.com/in/zeyuyaoy/",
        "https://github.com/zeyuyaoy",
    ],
};
