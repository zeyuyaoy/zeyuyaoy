import {createServer} from "node:http";

const upstream = new URL(process.argv[2] ?? "http://127.0.0.1:3004");
if (!["127.0.0.1", "localhost", "[::1]"].includes(upstream.hostname)) {
    throw new Error("Use a local production server");
}

const allowed = new Set(["playing", "stale", "malformed", "unavailable", "timeout"]);
const track = {
    isPlaying: true, title: "Browser fixture track", artist: "Test artist",
    songUrl: "https://open.spotify.com/track/test", albumImageUrl: null,
    durationMs: 240_000, progressMs: 42_000,
};

const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1:3005");
    const selected = url.searchParams.get("fixture");
    const scenario = selected ?? request.headers.cookie?.match(/(?:^|;\s*)portfolio-fixture=([^;]+)/)?.[1];
    if (!["GET", "HEAD"].includes(request.method)) {
        response.writeHead(405).end();
        return;
    }

    if (selected && allowed.has(selected)) {
        response.setHeader("Set-Cookie", `portfolio-fixture=${selected}; Path=/; HttpOnly; SameSite=Strict`);
    }

    if (url.pathname === "/api/profile-pic" || (url.pathname === "/api/spotify" && allowed.has(scenario))) {
        response.setHeader("Content-Type", "application/json");
        response.setHeader("Cache-Control", "no-store");
        if (url.pathname === "/api/profile-pic") {
            response.end(JSON.stringify({imageUrl: "javascript:alert(1)"}));
            return;
        }

        if (scenario === "timeout") {
            const timer = setTimeout(() => response.end(JSON.stringify({isPlaying: false})), 45_000);
            response.on("close", () => clearTimeout(timer));
            return;
        }

        if (scenario === "unavailable") {
            response.writeHead(503).end("Unavailable");
            return;
        }

        response.end(JSON.stringify(scenario === "malformed" ? {isPlaying: true, title: {invalid: true}}
            : {
                ...track, progressCapturedAt: Date.now(), ...(scenario === "stale" ? {
                    stale: true,
                    reason: "stale"
                } : {})
            }));
        return;
    }

    try {
        const target = new URL(url.pathname + url.search, upstream);
        const result = await fetch(target, {signal: AbortSignal.timeout(10_000), redirect: "manual"});
        response.statusCode = result.status;
        for (const name of ["content-type", "content-security-policy", "cache-control", "location", "x-content-type-options"]) {
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

server.listen(3005, "127.0.0.1", () => console.log("Local browser fixtures: http://127.0.0.1:3005/?fixture=playing"));
