export const site = {
  url: "https://zeyuyaoy.com",
  name: "Peter Yao",
  title: "Peter Yao | 姚则禹",
  description:
    "Hi, I'm Peter. I use and build computational tools to understand biology, and care about making science and tech more accessible and inclusive.",
};

export const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Peter Yao",
  alternateName: ["Zeyu Yao", "姚则禹"],
  url: site.url,
  image: `${site.url}/profile.jpg`,
  description: site.description,
  knowsAbout: [
    "Single-cell analytics",
    "Gene-expression dynamics",
    "AI-driven discovery",
    "STEM education",
  ],
  sameAs: [
    "https://twitter.com/zeyuyaoy",
    "https://www.linkedin.com/in/zeyuyaoy/",
    "https://github.com/zeyuyaoy",
    "https://www.instagram.com/zeyuyaoy/",
  ],
};

export const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: site.name,
  alternateName: ["Peter Yao", "姚则禹", "zeyuyaoy"],
  url: site.url,
};
