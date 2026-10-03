import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const allowed = new Set(["playing", "long-title", "stale", "malformed", "unavailable", "timeout"]);
const track = {
  isPlaying: true,
  title: "Browser fixture track",
  artist: "Test artist",
  songUrl: "https://open.spotify.com/track/test",
  albumImageUrl: null,
  durationMs: 240_000,
  progressMs: 42_000,
};

function normalizeFixturePath(raw) {
  if (typeof raw !== "string" || !raw.startsWith("/") || /[\\#\u0000-\u0020\u007f]/u.test(raw)) {
    throw new Error("Invalid request target");
  }

  const pathname = raw.split("?", 1)[0];
  if (pathname.includes("//")) {
    throw new Error("Invalid request path");
  }

  return pathname
    .split("/")
    .map((segment) => {
      const decoded = decodeURIComponent(segment);
      if (decoded === "." || decoded === ".." || /[/\\%?#\u0000-\u001f\u007f]/u.test(decoded)) {
        throw new Error("Invalid request segment");
      }
      return encodeURIComponent(decoded);
    })
    .join("/");
}

export function createBrowserFixtureServer(upstreamAddress = "http://127.0.0.1:3004") {
  const upstream = new URL(upstreamAddress);
  if (
    !["http:", "https:"].includes(upstream.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(upstream.hostname) ||
    upstream.username ||
    upstream.password
  ) {
    throw new Error("Use a local production server");
  }

  return createServer(async (request, response) => {
    if (!["GET", "HEAD"].includes(request.method)) {
      response.writeHead(405).end();
      return;
    }

    let pathname;
    let url;
    try {
      pathname = normalizeFixturePath(request.url);
      url = new URL(request.url, "http://127.0.0.1:3005");
    } catch {
      response.writeHead(400).end("Invalid request target");
      return;
    }

    const selected = url.searchParams.get("fixture");
    const scenario =
      selected ?? request.headers.cookie?.match(/(?:^|;\s*)portfolio-fixture=([^;]+)/)?.[1];

    if (selected && allowed.has(selected)) {
      response.setHeader(
        "Set-Cookie",
        `portfolio-fixture=${selected}; Path=/; HttpOnly; SameSite=Strict`,
      );
    }

    if (url.pathname === "/api/spotify" && allowed.has(scenario)) {
      response.setHeader("Content-Type", "application/json");
      response.setHeader("Cache-Control", "no-store");
      if (scenario === "timeout") {
        const timer = setTimeout(() => response.end(JSON.stringify({ isPlaying: false })), 45_000);
        response.on("close", () => clearTimeout(timer));
        return;
      }

      if (scenario === "unavailable") {
        response.writeHead(503).end("Unavailable");
        return;
      }

      response.end(
        JSON.stringify(
          scenario === "malformed"
            ? { isPlaying: true, title: { invalid: true } }
            : {
                ...track,
                ...(scenario === "long-title"
                  ? {
                      title:
                        "A deliberately long song title to exercise the complete scrolling cassette label",
                      artist:
                        "A fixture artist with a long name for responsive spacing verification",
                    }
                  : {}),
                progressCapturedAt: Date.now(),
                ...(scenario === "stale"
                  ? {
                      stale: true,
                      reason: "stale",
                    }
                  : {}),
              },
        ),
      );
      return;
    }

    try {
      const target = new URL(upstream.origin);
      target.pathname = pathname;
      const query = new URLSearchParams(
        pathname === "/_next/image"
          ? [...url.searchParams].filter(([name]) => ["url", "w", "q"].includes(name))
          : [],
      );
      const destination = query.size ? `${target.href}?${query}` : target.href;
      const result = await fetch(destination, {
        signal: AbortSignal.timeout(10_000),
        redirect: "manual",
      });
      response.statusCode = result.status;
      for (const name of [
        "content-type",
        "content-security-policy",
        "cache-control",
        "location",
        "x-content-type-options",
      ]) {
        const value = result.headers.get(name);
        if (value) {
          response.setHeader(name, value);
        }
      }

      response.end(Buffer.from(await result.arrayBuffer()));
    } catch {
      response.writeHead(502).end("Local production server unavailable");
    }
  });
}

const isEntrypoint = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isEntrypoint) {
  createBrowserFixtureServer(process.argv[2]).listen(3005, "127.0.0.1", () =>
    console.log("Local browser fixtures: http://127.0.0.1:3005/?fixture=playing"),
  );
}
