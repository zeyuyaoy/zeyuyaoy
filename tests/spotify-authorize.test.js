import {afterEach, describe, expect, it} from "bun:test";
import {mkdtemp, readFile, rm, stat, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
import {
  addCalendarMonths,
  buildAuthorizationUrl,
  completeAuthorization,
  completionMessage,
  parseAuthorizationCallback,
  SPOTIFY_REDIRECT_URI,
  SPOTIFY_SCOPE,
  updateEnvContent,
} from "../scripts/spotify-authorize.mjs";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, {recursive: true, force: true})),
  );
});

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {"Content-Type": "application/json"},
  });
}

async function temporaryEnv(content) {
  const directory = await mkdtemp(join(tmpdir(), "spotify-authorize-test-"));
  temporaryDirectories.push(directory);
  const envPath = join(directory, ".env.local");
  await writeFile(envPath, content, "utf8");
  return envPath;
}

describe("Spotify authorization helpers", () => {
  it("loads local env through Node, preserves process values, and tolerates only missing files", async () => {
    const envPath = await temporaryEnv('CLEANUP_EXISTING=file\nCLEANUP_QUOTED="quoted # value"\n');
    const moduleUrl = new URL("../scripts/spotify-authorize.mjs", import.meta.url).href;
    const result = spawnSync(
      "node",
      [
        "--input-type=module",
        "-e",
        `
            import assert from "node:assert/strict";
            import {loadAuthorizationEnv} from ${JSON.stringify(moduleUrl)};
            loadAuthorizationEnv(process.argv[1]);
            assert.equal(process.env.CLEANUP_EXISTING, "process");
            assert.equal(process.env.CLEANUP_QUOTED, "quoted # value");
            loadAuthorizationEnv(process.argv[1] + ".missing");
            assert.equal(process.env.CLEANUP_EXISTING, "process");
            assert.throws(() => loadAuthorizationEnv(42), {code: "ERR_INVALID_ARG_TYPE"});
        `,
        envPath,
      ],
      {
        env: {PATH: process.env.PATH, CLEANUP_EXISTING: "process"},
        encoding: "utf8",
        timeout: 10_000,
      },
    );

    expect(result.error).toBeUndefined();
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });

  it("builds a least-privilege Authorization Code URL", () => {
    const url = new URL(buildAuthorizationUrl({clientId: "client", state: "state"}));

    expect(url.origin + url.pathname).toBe("https://accounts.spotify.com/authorize");
    expect(url.searchParams.get("client_id")).toBe("client");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("redirect_uri")).toBe(SPOTIFY_REDIRECT_URI);
    expect(url.searchParams.get("scope")).toBe(SPOTIFY_SCOPE);
    expect(url.searchParams.get("state")).toBe("state");
    expect(url.searchParams.get("show_dialog")).toBe("true");
  });

  it("validates callback state, denial, and authorization code", () => {
    expect(parseAuthorizationCallback("/callback?code=abc&state=expected", "expected")).toBe("abc");
    expect(() => parseAuthorizationCallback("/callback?code=abc&state=wrong", "expected")).toThrow(
      "state did not match",
    );
    expect(() =>
      parseAuthorizationCallback("/callback?error=access_denied&state=expected", "expected"),
    ).toThrow("denied or failed");
  });

  it("updates only requested environment variables", () => {
    const current = [
      "# existing settings",
      "SPOTIFY_REFRESH_TOKEN=old",
      "SPOTIFY_REFRESH_TOKEN=duplicate-old",
      "UNCHANGED=value",
      "",
    ].join("\r\n");
    const updated = updateEnvContent(current, {
      SPOTIFY_REFRESH_TOKEN: "new-token",
      SPOTIFY_REFRESH_TOKEN_ISSUED_AT: "2026-09-12T00:00:00.000Z",
    });

    expect(updated).toContain("# existing settings\r\n");
    expect(updated).toContain('SPOTIFY_REFRESH_TOKEN="new-token"\r\n');
    expect(updated.match(/SPOTIFY_REFRESH_TOKEN=/g)).toHaveLength(1);
    expect(updated).toContain("UNCHANGED=value\r\n");
    expect(updated).toContain('SPOTIFY_REFRESH_TOKEN_ISSUED_AT="2026-09-12T00:00:00.000Z"\r\n');
  });

  it("exchanges, verifies, and atomically writes credentials", async () => {
    const envPath = await temporaryEnv("UNCHANGED=value\nSPOTIFY_REFRESH_TOKEN=old\n");
    const responses = [
      jsonResponse({access_token: "access-secret", refresh_token: "refresh-secret"}),
      new Response(null, {status: 204}),
    ];
    const fetchImpl = async () => responses.shift();
    const issuedAt = new Date("2026-08-31T12:00:00.000Z");

    const result = await completeAuthorization({
      code: "authorization-code",
      clientId: "client",
      clientSecret: "secret",
      envPath,
      fetchImpl,
      issuedAt,
    });
    const content = await readFile(envPath, "utf8");
    const fileStat = await stat(envPath);

    expect(content).toContain("UNCHANGED=value");
    expect(content).toContain('SPOTIFY_REFRESH_TOKEN="refresh-secret"');
    expect(content).toContain('SPOTIFY_REFRESH_TOKEN_ISSUED_AT="2026-08-31T12:00:00.000Z"');
    expect(fileStat.mode & 0o777).toBe(0o600);
    expect(result.expiresAt.toISOString()).toBe("2027-02-28T12:00:00.000Z");
  });

  it("does not modify the environment file when verification fails", async () => {
    const original = "SPOTIFY_REFRESH_TOKEN=old\nUNCHANGED=value\n";
    const envPath = await temporaryEnv(original);
    const responses = [
      jsonResponse({access_token: "access-secret", refresh_token: "refresh-secret"}),
      new Response(null, {status: 403}),
    ];
    const fetchImpl = async () => responses.shift();

    await expect(
      completeAuthorization({
        code: "authorization-code",
        clientId: "client",
        clientSecret: "secret",
        envPath,
        fetchImpl,
      }),
    ).rejects.toThrow("verification was denied");
    expect(await readFile(envPath, "utf8")).toBe(original);
  });

  it("calculates calendar-month expiry and keeps completion output secret-free", () => {
    const issuedAt = new Date("2026-08-31T12:00:00.000Z");
    const expiresAt = addCalendarMonths(issuedAt, 6);
    const message = completionMessage({issuedAt, expiresAt, envPath: ".env.local"});

    expect(expiresAt.toISOString()).toBe("2027-02-28T12:00:00.000Z");
    expect(message).toContain("six calendar months");
    expect(message).not.toContain("refresh-secret");
  });
});
