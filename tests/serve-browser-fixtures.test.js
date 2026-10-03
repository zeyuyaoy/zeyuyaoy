import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { once } from "node:events";
import { createServer, request } from "node:http";
import { fileURLToPath } from "node:url";
import { createBrowserFixtureServer } from "../scripts/serve-browser-fixtures.mjs";

if (process.versions.bun) {
  const { test } = await import("bun:test");

  test("browser fixture server security and compatibility under Node", () => {
    const result = spawnSync("node", ["--test", fileURLToPath(import.meta.url)], {
      encoding: "utf8",
      timeout: 30_000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  }, 35_000);
} else {
  const { after, before, describe, it } = await import("node:test");
  const servers = [];
  const upstreamRequests = [];
  const canaryRequests = [];
  let upstreamOrigin;
  let canaryOrigin;
  let fixtureServer;
  let fixturePort;

  async function listen(server) {
    servers.push(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    return server.address().port;
  }

  function send(path, { method = "GET", headers = {}, port = fixturePort } = {}) {
    return new Promise((resolve, reject) => {
      const outgoing = request(
        { hostname: "127.0.0.1", port, path, method, headers, agent: false },
        (response) => {
          const chunks = [];
          response.on("data", (chunk) => chunks.push(chunk));
          response.on("error", reject);
          response.on("end", () =>
            resolve({
              status: response.statusCode,
              headers: response.headers,
              body: Buffer.concat(chunks),
            }),
          );
        },
      );
      outgoing.on("error", reject);
      outgoing.end();
    });
  }

  before(async () => {
    const canaryPort = await listen(
      createServer((incoming, response) => {
        canaryRequests.push(incoming.url);
        response.end("unconfigured destination");
      }),
    );
    canaryOrigin = `http://127.0.0.1:${canaryPort}`;

    const upstreamPort = await listen(
      createServer((incoming, response) => {
        const entry = {
          path: incoming.url,
          method: incoming.method,
          host: incoming.headers.host,
        };
        upstreamRequests.push(entry);
        if (incoming.url === "/redirect") {
          response.writeHead(307, { Location: `${canaryOrigin}/redirected` }).end();
          return;
        }
        if (incoming.url === "/disconnect") {
          incoming.socket.destroy();
          return;
        }
        if (incoming.url === "/slow-body") {
          response.writeHead(200, { "Content-Type": "text/plain" });
          response.write("unfinished");
          return;
        }
        if (incoming.url === "/binary") {
          response.writeHead(200, {
            "Content-Type": "application/octet-stream",
            "Content-Security-Policy": "default-src 'none'",
            "Cache-Control": "public, max-age=60",
            "X-Content-Type-Options": "nosniff",
            "Set-Cookie": "upstream-cookie=hidden",
          });
          response.end(Buffer.from([0, 127, 128, 255]));
          return;
        }
        response.writeHead(incoming.url === "/missing-page" ? 404 : 200, {
          "Content-Type": "application/json",
        });
        response.end(JSON.stringify(entry));
      }),
    );
    upstreamOrigin = `http://127.0.0.1:${upstreamPort}`;
    fixtureServer = createBrowserFixtureServer(upstreamOrigin);
    fixturePort = await listen(fixtureServer);
  });

  after(async () => {
    await Promise.all(
      servers.map(
        (server) =>
          new Promise((resolve) => {
            server.close(resolve);
            server.closeAllConnections();
          }),
      ),
    );
  });

  describe("configured upstream", () => {
    for (const address of [
      "http://127.0.0.1:43210",
      "http://localhost:43210",
      "https://[::1]:43210",
    ]) {
      it(`accepts ${address}`, () => {
        assert.doesNotThrow(() => createBrowserFixtureServer(address));
      });
    }

    for (const address of [
      "http://example.com",
      "http://127.0.0.1.example.com",
      "http://0.0.0.0:3004",
      "ftp://127.0.0.1:3004",
      "file://127.0.0.1/a",
      "http://user@localhost:3004",
      "http://user:password@[::1]:3004",
      "http://[invalid",
    ]) {
      it(`rejects ${address}`, () => {
        assert.throws(() => createBrowserFixtureServer(address));
      });
    }

    it("uses only the configured origin, including its port", async () => {
      const port = await listen(
        createBrowserFixtureServer(`${upstreamOrigin}/ignored?ignored=yes#ignored`),
      );
      const response = await send("/robots.txt", { port });
      assert.deepEqual(JSON.parse(response.body), {
        path: "/robots.txt",
        method: "GET",
        host: new URL(upstreamOrigin).host,
      });
    });
  });

  describe("request boundary", () => {
    it("rejects an authority escape to an unconfigured local port", async () => {
      const upstreamCount = upstreamRequests.length;
      const canaryCount = canaryRequests.length;
      const response = await send(`//ignored//${new URL(canaryOrigin).host}/probe`);
      assert.equal(response.status, 400);
      assert.equal(upstreamRequests.length, upstreamCount);
      assert.equal(canaryRequests.length, canaryCount);
    });

    for (const path of [
      "//host/a",
      "//ignored//host/a",
      "/.//host/a",
      "/a/..//host/a",
      "/%2e//host/a",
      "/%2E%2e//host/a",
      "/.%2e/a",
      "/a/../b",
      "/a/./b",
      "/a/..\\/host/a",
      "/%2f%2Fhost/a",
      "/%5c%5Chost/a",
      "/%2e%2e%2fsecret",
      "/%252f%252fhost/a",
      "/%252e%252e/a",
      "/%255chost/a",
      "http://example.com/a",
      "https://ignored//host/a",
      "custom:https://example.com/a",
      "http://[invalid",
      "/%",
      "/%zz",
      "/%C0%AF",
      "/%E0%A4%A",
      "/a%00b",
      "/a%0db",
      "/a%7fb",
      "/a%3fb",
      "/a%23b",
      "/a#fragment",
      "/a//b?fixture=playing",
    ]) {
      it(`rejects ${JSON.stringify(path)} without fetching or setting cookies`, async () => {
        const upstreamCount = upstreamRequests.length;
        const canaryCount = canaryRequests.length;
        const response = await send(path);
        assert.equal(response.status, 400);
        assert.equal(response.headers["set-cookie"], undefined);
        assert.equal(upstreamRequests.length, upstreamCount);
        assert.equal(canaryRequests.length, canaryCount);
      });
    }

    it("rejects unsupported methods before parsing or selecting a fixture", async () => {
      const upstreamCount = upstreamRequests.length;
      const response = await send("/%?fixture=playing", { method: "POST" });
      assert.equal(response.status, 405);
      assert.equal(response.headers["set-cookie"], undefined);
      assert.equal(upstreamRequests.length, upstreamCount);
    });
  });

  describe("forwarding compatibility", () => {
    for (const path of [
      "/",
      "/api/spotify",
      "/_next/static/chunks/example.js",
      "/_next/static/chunks/example.css",
      "/_next/static/media/example.woff2",
      "/marquee/photo-001.webp",
      "/favicon.ico",
      "/og-image.jpg",
      "/robots.txt",
      "/sitemap.xml",
      "/missing-page",
      "/a%20file.txt",
      "/caf%C3%A9.png",
    ]) {
      it(`forwards ${path} to the configured upstream`, async () => {
        const response = await send(path);
        assert.equal(response.status, path === "/missing-page" ? 404 : 200);
        assert.deepEqual(JSON.parse(response.body), {
          path,
          method: "GET",
          host: new URL(upstreamOrigin).host,
        });
      });
    }

    it("forwards only image query keys, preserving order and duplicates", async () => {
      const response = await send(
        "/_next/image?url=%2Fmarquee%2Fphoto-001.webp&w=640&q=75&w=1280&fixture=playing&ignored=yes",
      );
      assert.equal(
        JSON.parse(response.body).path,
        "/_next/image?url=%2Fmarquee%2Fphoto-001.webp&w=640&q=75&w=1280",
      );
      assert.deepEqual(response.headers["set-cookie"], [
        "portfolio-fixture=playing; Path=/; HttpOnly; SameSite=Strict",
      ]);
    });

    it("keeps URL-shaped query values inside the image query", async () => {
      const canaryCount = canaryRequests.length;
      const query = new URLSearchParams({ url: `${canaryOrigin}/probe`, w: "640", q: "75" });
      const response = await send(`/_next/image?${query}`);
      assert.equal(JSON.parse(response.body).path, `/_next/image?${query}`);
      assert.equal(JSON.parse(response.body).host, new URL(upstreamOrigin).host);
      assert.equal(canaryRequests.length, canaryCount);
    });

    it("consumes the homepage fixture selection locally and strips other queries", async () => {
      const response = await send("/?fixture=playing&utm_source=cmu&ignored=yes");
      assert.equal(JSON.parse(response.body).path, "/");
      assert.deepEqual(response.headers["set-cookie"], [
        "portfolio-fixture=playing; Path=/; HttpOnly; SameSite=Strict",
      ]);
    });

    it("preserves HEAD handling and upstream GET behavior", async () => {
      const response = await send("/robots.txt", { method: "HEAD" });
      assert.equal(response.status, 200);
      assert.equal(response.body.length, 0);
      assert.equal(upstreamRequests.at(-1).method, "GET");
    });

    it("preserves binary bodies and the response header allowlist", async () => {
      const response = await send("/binary");
      assert.deepEqual(response.body, Buffer.from([0, 127, 128, 255]));
      assert.equal(response.headers["content-type"], "application/octet-stream");
      assert.equal(response.headers["content-security-policy"], "default-src 'none'");
      assert.equal(response.headers["cache-control"], "public, max-age=60");
      assert.equal(response.headers["x-content-type-options"], "nosniff");
      assert.equal(response.headers["set-cookie"], undefined);
    });

    it("returns redirects without contacting their destination", async () => {
      const canaryCount = canaryRequests.length;
      const response = await send("/redirect");
      assert.equal(response.status, 307);
      assert.equal(response.headers.location, `${canaryOrigin}/redirected`);
      assert.equal(canaryRequests.length, canaryCount);
    });

    it("returns 502 when the upstream disconnects", async () => {
      const response = await send("/disconnect");
      assert.equal(response.status, 502);
      assert.equal(response.body.toString(), "Local production server unavailable");
    });

    it("applies the ten-second deadline to upstream body reads", async (context) => {
      const timeout = AbortSignal.timeout;
      context.mock.method(AbortSignal, "timeout", (duration) => {
        assert.equal(duration, 10_000);
        return timeout(50);
      });
      const response = await send("/slow-body");
      assert.equal(response.status, 502);
    });
  });

  describe("Spotify fixtures", () => {
    for (const path of ["/api/%73potify", "/%61pi/sp%6Ftify", "/%61%70%69/%73%70%6f%74%69%66%79"]) {
      it(`serves query and cookie fixtures for encoded route ${path}`, async () => {
        const upstreamCount = upstreamRequests.length;
        const fromQuery = await send(`${path}?fixture=playing`);
        assert.equal(upstreamRequests.length, upstreamCount);
        assert.equal(fromQuery.status, 200);
        assert.equal(fromQuery.headers["cache-control"], "no-store");
        assert.equal(JSON.parse(fromQuery.body).title, "Browser fixture track");
        assert.deepEqual(fromQuery.headers["set-cookie"], [
          "portfolio-fixture=playing; Path=/; HttpOnly; SameSite=Strict",
        ]);

        const fromCookie = await send(path, {
          headers: { cookie: "portfolio-fixture=stale" },
        });
        assert.equal(upstreamRequests.length, upstreamCount);
        assert.equal(fromCookie.status, 200);
        assert.equal(fromCookie.headers["cache-control"], "no-store");
        assert.equal(fromCookie.headers["set-cookie"], undefined);
        assert.equal(JSON.parse(fromCookie.body).stale, true);
      });
    }

    for (const scenario of ["playing", "long-title", "stale", "malformed", "unavailable"]) {
      it(`preserves ${scenario}`, async () => {
        const upstreamCount = upstreamRequests.length;
        const response = await send(`/api/spotify?fixture=${scenario}`);
        assert.equal(response.status, scenario === "unavailable" ? 503 : 200);
        assert.equal(response.headers["cache-control"], "no-store");
        assert.equal(response.headers["content-type"], "application/json");
        assert.equal(upstreamRequests.length, upstreamCount);
        if (scenario === "unavailable") {
          assert.equal(response.body.toString(), "Unavailable");
        } else if (scenario === "malformed") {
          assert.deepEqual(JSON.parse(response.body), {
            isPlaying: true,
            title: { invalid: true },
          });
        } else {
          const data = JSON.parse(response.body);
          assert.equal(data.isPlaying, true);
          assert.equal(data.stale, scenario === "stale" ? true : undefined);
          assert.equal(data.reason, scenario === "stale" ? "stale" : undefined);
          assert.equal(data.albumImageUrl, null);
          assert.equal(data.durationMs, 240_000);
          assert.equal(data.progressMs, 42_000);
          assert.equal(typeof data.progressCapturedAt, "number");
          assert.equal(data.title.length > 50, scenario === "long-title");
        }
      });
    }

    it("uses the cookie only when no fixture query is present", async () => {
      const headers = { cookie: "other=value; portfolio-fixture=stale" };
      const fromCookie = await send("/api/spotify", { headers });
      assert.equal(JSON.parse(fromCookie.body).stale, true);
      assert.equal(fromCookie.headers["set-cookie"], undefined);
      const fromQuery = await send("/api/spotify?fixture=playing", { headers });
      assert.equal(JSON.parse(fromQuery.body).stale, undefined);
      for (const selection of ["", "invalid"]) {
        const response = await send(`/api/spotify?fixture=${selection}`, { headers });
        assert.equal(JSON.parse(response.body).path, "/api/spotify");
        assert.equal(response.headers["set-cookie"], undefined);
      }
      const invalidCookie = await send("/api/spotify", {
        headers: { cookie: "portfolio-fixture=invalid" },
      });
      assert.equal(JSON.parse(invalidCookie.body).path, "/api/spotify");
    });

    it("delays the timeout fixture for 45 seconds", async (context) => {
      context.mock.timers.enable({ apis: ["setTimeout"] });
      const incoming = once(fixtureServer, "request");
      let completed = false;
      const pending = send("/api/spotify?fixture=timeout").then((response) => {
        completed = true;
        return response;
      });
      await incoming;
      context.mock.timers.tick(44_999);
      assert.equal(completed, false);
      context.mock.timers.tick(1);
      const response = await pending;
      assert.equal(response.status, 200);
      assert.equal(response.headers["cache-control"], "no-store");
      assert.deepEqual(JSON.parse(response.body), { isPlaying: false });
    });

    it("cancels the timeout fixture timer when the client disconnects", async (context) => {
      const setTimer = context.mock.method(globalThis, "setTimeout");
      const clearTimer = context.mock.method(globalThis, "clearTimeout");
      const incoming = once(fixtureServer, "request");
      const outgoing = request({
        hostname: "127.0.0.1",
        port: fixturePort,
        path: "/api/spotify?fixture=timeout",
        agent: false,
      });
      outgoing.on("error", () => {});
      outgoing.end();
      const [, response] = await incoming;
      const scheduled = setTimer.mock.calls.find(({ arguments: args }) => args[1] === 45_000);
      assert.ok(scheduled);
      const closed = once(response, "close");
      outgoing.destroy();
      await closed;
      assert.ok(clearTimer.mock.calls.some(({ arguments: args }) => args[0] === scheduled.result));
    });
  });
}
