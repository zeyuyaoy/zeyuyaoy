import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const [candidate, baseline, sampleCount = "5", profile = "both"] = process.argv.slice(2);
const samples = Number(sampleCount);
assert.ok(
  candidate,
  "Usage: node scripts/benchmark-portfolio.mjs candidate [baseline] [samples] [desktop|mobile|both]",
);
assert.ok(Number.isSafeInteger(samples) && samples > 0, "samples must be a positive integer");
assert.ok(["desktop", "mobile", "both"].includes(profile), "unknown browser profile");

const origins = [candidate, baseline].filter(Boolean).map((input) => {
  const url = new URL(input);
  assert.equal(url.hostname, "127.0.0.1", "run against isolated loopback fixtures");
  return url.origin;
});

async function openResearch(page) {
  await page.evaluate(() => {
    window.researchTiming = new Promise((resolve) => {
      document.addEventListener(
        "click",
        () => {
          const start = performance.now();
          let feedback;
          const observer = new MutationObserver(() => {
            if (feedback === undefined && document.querySelector("dialog[open]")) {
              requestAnimationFrame(() => {
                feedback ??= performance.now() - start;
              });
            }
            if (
              !document.querySelector(".research-popup input[type=search]")?.getClientRects().length
            ) {
              return;
            }
            observer.disconnect();
            requestAnimationFrame(() =>
              requestAnimationFrame(() =>
                resolve({
                  start,
                  feedback,
                  ready: performance.now() - start,
                }),
              ),
            );
          });
          observer.observe(document.body, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ["open"],
          });
        },
        { capture: true, once: true },
      );
    });
  });
  await page.getByRole("button", { name: "Research", exact: true }).click();
  await page.getByRole("searchbox").waitFor({ timeout: 10_000 });
  const timing = await page.evaluate(() =>
    Promise.race([window.researchTiming, new Promise((resolve) => setTimeout(resolve, 5_000))]),
  );
  assert.ok(timing, "Research painted without a timing marker");
  return timing;
}

async function sample(browser, origin, mobile) {
  const context = await browser.newContext(
    mobile
      ? {
          viewport: { width: 390, height: 844 },
          deviceScaleFactor: 2,
          isMobile: true,
          hasTouch: true,
        }
      : { viewport: { width: 1440, height: 900 } },
  );
  try {
    const page = await context.newPage();
    if (mobile) {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 150,
        downloadThroughput: 200_000,
        uploadThroughput: 93_750,
      });
    }
    await page.addInitScript(() => {
      window.largestPaint = 0;
      new PerformanceObserver((entries) => {
        window.largestPaint = entries.getEntries().at(-1).startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
    });
    let presentations = 0;
    let spotify = 0;
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      presentations += Number(path === "/api/research/presentation");
      spotify += Number(path === "/api/spotify");
    });
    const response = await page.goto(origin, { waitUntil: "load" });
    assert.ok(response.ok(), `homepage returned ${response.status()}`);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    });
    assert.equal(presentations, 0, "idle homepage requested Research");
    assert.equal(spotify, 0, "idle homepage requested Spotify");
    const landing = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      const assets = performance.getEntriesByType("resource");
      const bytes = (matches) =>
        assets.filter(matches).reduce((sum, entry) => sum + entry.encodedBodySize, 0);
      return {
        ttfb: nav.responseStart,
        fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0,
        lcp: window.largestPaint,
        landingJsBytes: bytes((entry) => new URL(entry.name).pathname.endsWith(".js")),
        marqueeBytes: bytes((entry) => /(?:\/|%2F)marquee(?:\/|%2F)photo-/.test(entry.name)),
      };
    });
    const first = await openResearch(page);
    assert.equal(presentations, 1, "first Research open should issue one request");
    const api = await page.evaluate((start) => {
      const entry = performance
        .getEntriesByType("resource")
        .find((resource) => new URL(resource.name).pathname === "/api/research/presentation");
      return {
        apiBytes: entry.encodedBodySize,
        apiStartAfterClick: entry.startTime - start,
        apiTtfb: entry.responseStart - entry.requestStart,
        apiDuration: entry.duration,
      };
    }, first.start);
    await page.keyboard.press("Escape");
    await page.getByRole("searchbox").waitFor({ state: "hidden" });
    const repeat = await openResearch(page);
    assert.equal(presentations, 2, "reopening Research should issue a fresh request");
    return {
      ...landing,
      ...api,
      firstResearchFeedback: first.feedback,
      firstResearchPaint: first.ready,
      repeatResearchPaint: repeat.ready,
    };
  } finally {
    await context.close();
  }
}

function summarize(rows) {
  return Object.fromEntries(
    Object.keys(rows[0]).map((key) => {
      const values = rows
        .map((row) => row[key])
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      const at = (p) => Math.round(values[Math.ceil(values.length * p) - 1] * 10) / 10;
      return [
        key,
        {
          median: at(0.5),
          ...(values.length >= 30 && { p95: at(0.95) }),
          min: at(1 / values.length),
          max: at(1),
        },
      ];
    }),
  );
}

const browser = await chromium.launch();
try {
  console.log(
    JSON.stringify({
      samples,
      chromium: browser.version(),
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    }),
  );
  for (const device of profile === "both" ? ["desktop", "mobile"] : [profile]) {
    const results = origins.map(() => []);
    for (let run = 0; run < samples; run++) {
      const order = run % 2 === 0 ? origins.keys() : [...origins.keys()].reverse();
      for (const index of order) {
        results[index].push(await sample(browser, origins[index], device === "mobile"));
      }
      if ((run + 1) % 5 === 0) {
        console.error(`${device}: ${run + 1}/${samples} samples per build`);
      }
    }
    for (const [index, rows] of results.entries()) {
      console.log(
        JSON.stringify({
          device,
          variant: index === 0 ? "candidate" : "baseline",
          metrics: summarize(rows),
        }),
      );
    }
  }
} finally {
  await browser.close();
}
