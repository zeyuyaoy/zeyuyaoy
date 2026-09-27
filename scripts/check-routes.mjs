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
  "Hi, I'm Peter. I’m interested in computational biology and making science and tech more accessible. Visit my personal website to explore my research and projects.",
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
      "og:image:alt": "A person on a terrace overlooking the Singapore skyline",
      "twitter:card": "summary_large_image",
      "twitter:creator": "@zeyuyaoy",
      "twitter:title": site.title,
      "twitter:description": site.description,
      "twitter:image": `${site.url}/og-image.jpg`,
      "twitter:image:alt": "A person on a terrace overlooking the Singapore skyline",
    })) {
      const matches = meta.filter((tag) => (tag.name ?? tag.property) === key);
      assert.equal(matches.length, 1, `One ${key} tag`);
      assert.equal(matches[0].content, value, key);
    }
    assert.equal(tags(text, "link").find((tag) => tag.rel === "canonical")?.href, site.url);
    const structuredData = [
      ...text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
    ].flatMap(([, json]) => JSON.parse(json));
    assert.deepEqual(
      structuredData.find((entry) => entry["@type"] === "Person"),
      personJsonLd,
    );
    assert.deepEqual(
      structuredData.find((entry) => entry["@type"] === "WebSite"),
      websiteJsonLd,
    );
    assert.ok(text.includes('id="research-heading"'), "Research heading in initial HTML");
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
