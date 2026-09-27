import {randomBytes, timingSafeEqual} from "node:crypto";
import {chmod, readFile, rename, rm, writeFile} from "node:fs/promises";
import {createServer} from "node:http";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {loadEnvFile} from "node:process";

export const SPOTIFY_REDIRECT_URI = "http://127.0.0.1:8888/callback";
export const SPOTIFY_SCOPE = "user-read-currently-playing";

const AUTHORIZE_ENDPOINT = "https://accounts.spotify.com/authorize";
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const NOW_PLAYING_ENDPOINT = "https://api.spotify.com/v1/me/player/currently-playing";

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left ?? "");
  const rightBuffer = Buffer.from(right ?? "");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function buildAuthorizationUrl({clientId, state}) {
  const url = new URL(AUTHORIZE_ENDPOINT);
  url.search = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: SPOTIFY_REDIRECT_URI,
    scope: SPOTIFY_SCOPE,
    state,
    show_dialog: "true",
  });
  return url.toString();
}

export function parseAuthorizationCallback(requestUrl, expectedState) {
  const url = new URL(requestUrl, SPOTIFY_REDIRECT_URI);

  if (url.pathname !== "/callback") {
    throw new Error("Unexpected Spotify callback path.");
  }

  if (!safeEqual(url.searchParams.get("state"), expectedState)) {
    throw new Error("Spotify authorization state did not match.");
  }

  if (url.searchParams.has("error")) {
    throw new Error("Spotify authorization was denied or failed.");
  }

  const code = url.searchParams.get("code");
  if (!code) {
    throw new Error("Spotify authorization did not return a code.");
  }

  return code;
}

export async function exchangeAuthorizationCode({
                                                  code,
                                                  clientId,
                                                  clientSecret,
                                                  fetchImpl = globalThis.fetch,
                                                }) {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetchImpl(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      redirect_uri: SPOTIFY_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  const body = await readJson(response);

  if (!response.ok) {
    const reason = typeof body?.error === "string" ? body.error : "unknown_error";
    throw new Error(`Spotify token exchange failed (${response.status}: ${reason}).`);
  }

  if (typeof body?.access_token !== "string" || typeof body?.refresh_token !== "string") {
    throw new Error("Spotify token exchange returned incomplete credentials.");
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
  };
}

export async function verifyAccessToken(accessToken, fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(NOW_PLAYING_ENDPOINT, {
    headers: {Authorization: `Bearer ${accessToken}`},
  });

  if (response.status === 200 || response.status === 204) {
    return;
  }

  if (response.status === 403) {
    throw new Error(
      "Spotify verification was denied. Check Premium status, app allowlisting, and the requested scope.",
    );
  }

  throw new Error(`Spotify verification failed with status ${response.status}.`);
}

function quoteEnvValue(value) {
  return JSON.stringify(String(value));
}

export function updateEnvContent(content, updates) {
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const hadTrailingNewline = content.endsWith("\n");
  const lines = content.length === 0 ? [] : content.split(/\r?\n/);
  if (hadTrailingNewline) {
    lines.pop();
  }

  const replacements = new Map(Object.entries(updates));
  const replaced = new Set();
  const updatedLines = lines
    .map((line) => {
      const match = line.match(/^(\s*(?:export\s+)?)([A-Za-z_][A-Za-z0-9_]*)\s*=.*$/);
      if (!match || !replacements.has(match[2])) {
        return line;
      }

      if (replaced.has(match[2])) {
        return null;
      }

      const value = replacements.get(match[2]);
      replaced.add(match[2]);
      return `${match[1]}${match[2]}=${quoteEnvValue(value)}`;
    })
    .filter((line) => line !== null);

  for (const [key, value] of replacements) {
    if (!replaced.has(key)) {
      updatedLines.push(`${key}=${quoteEnvValue(value)}`);
    }
  }

  return `${updatedLines.join(newline)}${newline}`;
}

export async function updateEnvFile(envPath, updates) {
  let current = "";
  try {
    current = await readFile(envPath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  const updated = updateEnvContent(current, updates);
  const temporaryPath = `${envPath}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;

  try {
    await writeFile(temporaryPath, updated, {encoding: "utf8", mode: 0o600, flag: "wx"});
    await rename(temporaryPath, envPath);
    await chmod(envPath, 0o600);
  } catch (error) {
    await rm(temporaryPath, {force: true});
    throw error;
  }
}

export function addCalendarMonths(date, months) {
  const result = new Date(date);
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDay));
  return result;
}

export function completionMessage({issuedAt, expiresAt, envPath}) {
  return [
    `Updated ${envPath} without printing the new refresh token.`,
    `Authorized at: ${issuedAt.toISOString()}`,
    `Reauthorize by: ${expiresAt.toISOString()} (six calendar months)`,
    "Next: update SPOTIFY_REFRESH_TOKEN and SPOTIFY_REFRESH_TOKEN_ISSUED_AT in Vercel, then redeploy.",
  ].join("\n");
}

export async function completeAuthorization({
                                              code,
                                              clientId,
                                              clientSecret,
                                              envPath,
                                              fetchImpl = globalThis.fetch,
                                              issuedAt = new Date(),
                                            }) {
  const tokens = await exchangeAuthorizationCode({
    code,
    clientId,
    clientSecret,
    fetchImpl,
  });
  await verifyAccessToken(tokens.accessToken, fetchImpl);

  const expiresAt = addCalendarMonths(issuedAt, 6);
  await updateEnvFile(envPath, {
    SPOTIFY_REFRESH_TOKEN: tokens.refreshToken,
    SPOTIFY_REFRESH_TOKEN_ISSUED_AT: issuedAt.toISOString(),
  });

  return {issuedAt, expiresAt};
}

function waitForAuthorizationCode({state, authorizationUrl, timeoutMs = 5 * 60 * 1000}) {
  return new Promise((resolvePromise, rejectPromise) => {
    let settled = false;
    const server = createServer((request, response) => {
      if (!request.url?.startsWith("/callback")) {
        response.writeHead(404, {"Content-Type": "text/plain; charset=utf-8"});
        response.end("Not found");
        return;
      }

      try {
        const code = parseAuthorizationCallback(request.url, state);
        response.writeHead(200, {"Content-Type": "text/plain; charset=utf-8"});
        response.end("Spotify authorization received. You can return to the terminal.");
        finish(null, code);
      } catch (error) {
        response.writeHead(400, {"Content-Type": "text/plain; charset=utf-8"});
        response.end("Spotify authorization failed. Return to the terminal for details.");
        finish(error);
      }
    });

    const timeoutId = setTimeout(() => {
      finish(new Error("Spotify authorization timed out after five minutes."));
    }, timeoutMs);

    const finish = (error, code) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutId);
      if (server.listening) {
        server.close();
      }
      if (error) {
        rejectPromise(error);
      } else {
        resolvePromise(code);
      }
    };

    server.on("error", (error) => {
      const message =
        error.code === "EADDRINUSE"
          ? "Port 8888 is already in use. Stop the conflicting process and try again."
          : `Could not start the local Spotify callback server: ${error.message}`;
      finish(new Error(message));
    });

    server.listen(8888, "127.0.0.1", () => {
      console.log("Open this URL in your browser to authorize Spotify:\n");
      console.log(authorizationUrl);
      console.log("\nWaiting up to five minutes for Spotify to redirect back...");
    });
  });
}

export function loadAuthorizationEnv(envPath) {
  try {
    loadEnvFile(envPath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function main() {
  const envPath = resolve(process.cwd(), ".env.local");
  loadAuthorizationEnv(envPath);

  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET are required in .env.local.");
  }

  const state = randomBytes(32).toString("hex");
  const authorizationUrl = buildAuthorizationUrl({clientId, state});
  const code = await waitForAuthorizationCode({state, authorizationUrl});
  const result = await completeAuthorization({
    code,
    clientId,
    clientSecret,
    envPath,
  });

  console.log(`\n${completionMessage({...result, envPath})}`);
}

const isEntrypoint = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isEntrypoint) {
  main().catch((error) => {
    console.error(`Spotify authorization failed: ${error.message}`);
    process.exitCode = 1;
  });
}
