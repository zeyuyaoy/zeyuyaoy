import assert from "node:assert/strict";
import {parseSpotifyStatus} from "../src/lib/spotify-contract.ts";
import {site} from "../src/lib/site.ts";

const base = process.argv[2] ?? "http://127.0.0.1:3000";
const results = [];

for (const path of [
  "/",
  "/robots.txt",
  "/sitemap.xml",
  "/api/spotify",
  "/audit-route-that-does-not-exist",
]) {
  const response = await fetch(new URL(path, base), {signal: AbortSignal.timeout(45_000)});
  const text = await response.text();
  assert.equal(response.status, path.includes("does-not-exist") ? 404 : 200, path);

  const cache = response.headers.get("cache-control");

  if (path === "/") {
    assert.ok(text.includes(site.description), "Current description in initial HTML");
    assert.ok(text.includes(`rel="canonical" href="${site.url}"`), "Canonical URL");
    assert.ok(text.includes('id="research-heading"'), "Research heading in initial HTML");
    assert.ok(text.includes('id="projects-heading"'), "Project heading in initial HTML");
    assert.ok(!response.headers.get("x-robots-tag")?.includes("noindex"), "No blanket noindex");

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
  results.push({path, status: response.status, cache});
}
console.log(JSON.stringify(results, null, 2));
