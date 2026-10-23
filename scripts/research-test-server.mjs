import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { createClient } from "redis";
import { captureResearch, restoreResearch, testRedisUrl } from "./research-data.mjs";

const url = testRedisUrl(process.env.TEST_REDIS_URL);
const redis = createClient({ url, socket: { reconnectStrategy: false } });
redis.on("error", () => {});

try {
  await redis.connect();
  const baseline = JSON.parse(
    await readFile(new URL("../tests/fixtures/research/baseline.json", import.meta.url), "utf8"),
  );
  const rich = JSON.parse(
    await readFile(
      new URL("../tests/fixtures/research/rich-project.json", import.meta.url),
      "utf8",
    ),
  );
  const current = await captureResearch(redis);
  if (!current.entries.length) {
    await restoreResearch(redis, baseline);
  } else {
    const allowedKeys = new Set([...baseline.entries, ...rich.entries].map((entry) => entry.key));
    if (current.entries.some((entry) => !allowedKeys.has(entry.key))) {
      throw new Error("E2E server refuses a database containing non-fixture research records");
    }
    for (const entry of baseline.entries.filter((item) => !item.key.startsWith("count:"))) {
      if (
        !isDeepStrictEqual(
          current.entries.find((item) => item.key === entry.key)?.value,
          entry.value,
        )
      ) {
        throw new Error("E2E server requires an empty database or the unchanged research fixture");
      }
    }
  }
  const existing = current.entries.filter((entry) => entry.key.endsWith(":migration-rich-project"));
  if (
    existing.length &&
    (existing.length !== rich.entries.length ||
      rich.entries.some((entry) => {
        const stored = existing.find((item) => item.key === entry.key);
        return (
          stored?.type !== entry.type ||
          (!entry.key.startsWith("count:") && !isDeepStrictEqual(stored?.value, entry.value))
        );
      }))
  ) {
    throw new Error("E2E server refuses a modified or incomplete rich project fixture");
  }
  if (!existing.length) {
    const writes = redis.multi();
    for (const entry of rich.entries) {
      if (entry.type === "hash") {
        writes.hSet(entry.key, entry.value);
      } else {
        writes.set(entry.key, entry.value);
      }
    }
    await writes.exec();
  }
} finally {
  if (redis.isOpen) {
    await redis.quit();
  }
}

const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    process.env.PORT || "3117",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      RESEARCH_REDIS_URL: url,
      REDIS_URL: url,
      ADMIN_KEY: "research-e2e-local-key",
      ORCID_ID: "",
      SPOTIFY_CLIENT_ID: "",
      SPOTIFY_CLIENT_SECRET: "",
      SPOTIFY_REFRESH_TOKEN: "",
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}
server.on("exit", (code) => {
  process.exitCode = code || 0;
});
