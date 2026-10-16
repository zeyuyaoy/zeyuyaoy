import assert from "node:assert/strict";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { parseSpotifyStatus } from "../src/lib/spotify-contract.ts";
import { personJsonLd, site, websiteJsonLd } from "../src/lib/site.ts";

const base = process.argv[2] ?? "http://127.0.0.1:3000";
const results = [];

function decodeHtml(value) {
  const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  return value.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi, (_, entity) =>
    entity.startsWith("#")
      ? String.fromCodePoint(
          entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1)),
        )
      : entities[entity.toLowerCase()],
  );
}

function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "g"))].map(([tag]) =>
    Object.fromEntries(
      [...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, decodeHtml(value)]),
    ),
  );
}

assert.equal(decodeHtml("&amp;&lt;&gt;&quot;&apos;&#39;&#x27;"), "&<>\"'''");

const cmu = await readFile(new URL("../cmu.html", import.meta.url), "utf8");
assert.equal(
  tags(cmu, "meta").find((tag) => tag.name === "description")?.content,
  "Hi, I'm Peter. I'm interested in computational biology and making science and tech more accessible. Visit my personal website to explore my research and projects.",
  "CMU description",
);
assert.equal(tags(cmu, "link").find((tag) => tag.rel === "canonical")?.href, site.url);
assert.equal(
  tags(cmu, "meta").find((tag) => tag["http-equiv"] === "refresh")?.content,
  `2; url=${site.url}/?utm_source=cmu&utm_medium=referral&utm_campaign=andrew_userweb`,
  "CMU redirect retains referral tracking",
);

for (const path of [
  "/",
  "/og-image.jpg",
  "/robots.txt",
  "/sitemap.xml",
  "/api/spotify",
  "/audit-route-that-does-not-exist",
]) {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(45_000) });
  if (path === "/og-image.jpg") {
    assert.equal(response.status, 200, path);
    assert.ok(response.headers.get("content-type")?.includes("image/jpeg"), path);
    const image = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(image).metadata();
    assert.equal(metadata.format, "jpeg", "Social image format");
    assert.equal(metadata.width, 1080, "Social image width");
    assert.equal(metadata.height, 607, "Social image height");
    results.push({ path, status: response.status });
    continue;
  }
  const text = await response.text();
  assert.equal(response.status, path.includes("does-not-exist") ? 404 : 200, path);

  const cache = response.headers.get("cache-control");

  if (path === "/") {
    assert.equal(decodeHtml(text.match(/<title>([^<]*)<\/title>/)?.[1] ?? ""), site.title);
    const meta = tags(text, "meta");
    for (const [key, value] of Object.entries({
      description: site.description,
      "og:title": site.title,
      "og:description": site.description,
      "og:url": site.url,
      "og:type": "website",
      "og:site_name": site.name,
      "og:image": `${site.url}/og-image.jpg`,
      "og:image:width": "1080",
      "og:image:height": "607",
      "og:image:alt": "Peter in Singapore",
      "twitter:card": "summary_large_image",
      "twitter:creator": "@zeyuyaoy",
      "twitter:title": site.title,
      "twitter:description": site.description,
      "twitter:image": `${site.url}/og-image.jpg`,
      "twitter:image:alt": "Peter in Singapore",
    })) {
      const matches = meta.filter((tag) => (tag.name ?? tag.property) === key);
      assert.equal(matches.length, 1, `One ${key} tag`);
      assert.equal(matches[0].content, value, key);
    }
    assert.equal(tags(text, "link").find((tag) => tag.rel === "canonical")?.href, site.url);
    const structuredData = [
      ...text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
    ].map(([, json]) => JSON.parse(json));
    assert.equal(structuredData.length, 2, "Two separate JSON-LD scripts");
    for (const entry of structuredData) {
      assert.ok(entry && typeof entry === "object" && !Array.isArray(entry), "JSON-LD object");
      assert.equal(entry["@context"], "https://schema.org", "JSON-LD string context");
    }
    assert.deepEqual(structuredData, [personJsonLd, websiteJsonLd], "Complete JSON-LD metadata");
    const images = tags(text, "img");
    const marquee = images.filter((image) =>
      new URL(image.src, base).pathname.startsWith("/marquee/"),
    );
    assert.equal(marquee.length, 264, "All mounted marquee images bypass optimization");
    for (const image of marquee) {
      assert.equal(image.srcSet ?? image.srcset, undefined, "No marquee transformation candidates");
      assert.equal(image.sizes, undefined, "No marquee responsive sizing hint");
    }
    const photoPaths = [
      ...new Set(marquee.map((image) => new URL(image.src, base).pathname)),
    ].sort();
    assert.deepEqual(
      photoPaths,
      Array.from(
        { length: 104 },
        (_, index) => `/marquee/photo-${String(index + 1).padStart(3, "0")}.webp`,
      ),
      "All 104 direct marquee assets",
    );
    for (const photoPath of photoPaths) {
      const photo = await fetch(new URL(photoPath, base), { signal: AbortSignal.timeout(10_000) });
      assert.equal(photo.status, 200, photoPath);
      const metadata = await sharp(Buffer.from(await photo.arrayBuffer())).metadata();
      assert.equal(metadata.format, "webp", photoPath);
      assert.equal(metadata.width, 960, photoPath);
      assert.equal(metadata.height, 540, photoPath);
    }
    const optimized = images.filter(
      (image) => new URL(image.src, base).pathname === "/_next/image",
    );
    assert.equal(optimized.length, 2, "Only the two profile images are initially optimized");
    for (const image of optimized) {
      const candidates = (image.srcSet ?? image.srcset)
        .split(", ")
        .map((candidate) => new URL(candidate.split(" ")[0], base));
      assert.deepEqual(
        candidates.map((candidate) => Number(candidate.searchParams.get("w"))),
        [64, 96, 128, 256, 384, 640],
        "Six profile resize candidates",
      );
      assert.equal(image.sizes, "(max-width: 560px) 120px, (max-width: 960px) 144px, 125px");
      for (const candidate of candidates) {
        assert.match(
          candidate.searchParams.get("url"),
          /^\/_next\/static\/(?:immutable\/)?media\/(?:profile|conan)\.[^/]+\.jpg$/,
        );
        assert.equal(candidate.searchParams.get("q"), "90", "Profile quality is preserved");
      }
      const photo = await fetch(new URL(image.src, base), {
        headers: { Accept: "image/avif,image/webp" },
        signal: AbortSignal.timeout(10_000),
      });
      assert.equal(photo.status, 200, image.src);
      assert.ok(photo.headers.get("content-type")?.includes("image/webp"));
      await photo.arrayBuffer();
    }
    const profileSource = new URL(optimized[0].src, base).searchParams.get("url");
    for (const query of [
      { url: "/marquee/photo-001.webp", w: "640", q: "75" },
      { url: "/profile.jpg", w: "640", q: "90" },
      { url: "/og-image.jpg", w: "640", q: "75" },
      { url: "/bucket-webring.png", w: "64", q: "75" },
      { url: `${profileSource}?v=1`, w: "640", q: "90" },
      { url: profileSource, w: "3840", q: "90" },
      { url: profileSource, w: "640", q: "80" },
      { url: "https://example.com/image/cover", w: "64", q: "75" },
      { url: "https://i.scdn.co/other/cover", w: "64", q: "75" },
      { url: "https://i.scdn.co/image/cover?v=1", w: "64", q: "75" },
    ]) {
      const rejected = await fetch(new URL(`/_next/image?${new URLSearchParams(query)}`, base), {
        signal: AbortSignal.timeout(10_000),
      });
      assert.equal(rejected.status, 400, `Disallowed transformation: ${JSON.stringify(query)}`);
      await rejected.text();
    }
    assert.equal(
      tags(text, "section").filter((tag) => tag["aria-label"] === "Profile").length,
      1,
      "One Profile section in initial HTML",
    );
    const tabs = tags(text, "button").filter((tag) => tag.role === "tab");
    const panels = tags(text, "div").filter((tag) => tag.role === "tabpanel");
    assert.equal(tabs.length, 3, "Three profile tabs in initial HTML");
    assert.equal(panels.length, 3, "Three profile panels in initial HTML");
    assert.equal(new Set(tabs.map((tab) => tab.id)).size, 3, "Unique tab IDs");
    assert.equal(new Set(panels.map((panel) => panel.id)).size, 3, "Unique panel IDs");
    for (const [index, name] of ["about", "experience", "education"].entries()) {
      const tab = tabs[index];
      assert.ok(tab.id?.endsWith(`-tab-${name}`), `${name} tab ID`);
      const panel = panels.find((item) => item.id === tab["aria-controls"]);
      assert.ok(panel, `${name} tab controls its panel`);
      assert.equal(panel["aria-labelledby"], tab.id, `${name} panel references its tab`);
      assert.equal(tab["aria-selected"], String(index === 0), "About Me starts selected");
      assert.equal(panel["aria-hidden"], String(index !== 0), `${name} panel visibility`);
    }
    assert.ok(text.includes('id="projects-heading"'), "Project heading in initial HTML");
    assert.ok(!response.headers.get("x-robots-tag")?.includes("noindex"), "No blanket noindex");
    assert.ok(!meta.find((tag) => tag.name === "robots")?.content.includes("noindex"));

    const csp = response.headers.get("content-security-policy");
    for (const directive of [
      "base-uri 'none'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "script-src-attr 'none'",
    ]) {
      assert.ok(csp?.includes(directive), directive);
    }
  } else if (path === "/robots.txt") {
    assert.ok(text.includes(`Sitemap: ${site.url}/sitemap.xml`));
    assert.ok(text.includes("Disallow: /api/"));
  } else if (path === "/sitemap.xml") {
    assert.ok(text.includes(`<loc>${site.url}</loc>`));
  } else if (path === "/api/spotify") {
    assert.ok(response.headers.get("content-type")?.includes("application/json"), path);

    const data = JSON.parse(text);
    if (data.fallback || data.stale) {
      assert.equal(cache, "no-store", `${path}: degraded data must not be cached`);
    }

    parseSpotifyStatus(data);

    results.push({
      path,
      status: response.status,
      cache,
      fallback: Boolean(data.fallback),
      stale: Boolean(data.stale),
    });
    continue;
  }
  results.push({ path, status: response.status, cache });
}
console.log(JSON.stringify(results, null, 2));
