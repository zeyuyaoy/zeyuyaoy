import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function testRedisUrl(value) {
  const url = new URL(value || "redis://invalid");
  if (
    url.protocol !== "redis:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.pathname !== "/15"
  ) {
    throw new Error("Research tests require a loopback Redis URL using database /15");
  }
  return url.href;
}

const keyPattern = /^(link|meta|count|collection):[a-z0-9][a-z0-9_-]*$/;

export function validateSnapshot(snapshot) {
  if (snapshot?.version !== 1 || !Array.isArray(snapshot.entries)) {
    throw new Error("Invalid research snapshot");
  }
  const seen = new Set();
  for (const entry of snapshot.entries) {
    const hash = /^(meta|collection):/.test(entry.key);
    if (
      !keyPattern.test(entry.key) ||
      seen.has(entry.key) ||
      entry.type !== (hash ? "hash" : "string") ||
      !Number.isInteger(entry.ttl) ||
      entry.ttl < -1 ||
      (hash
        ? !entry.value ||
          typeof entry.value !== "object" ||
          Array.isArray(entry.value) ||
          !Object.values(entry.value).every((value) => typeof value === "string")
        : typeof entry.value !== "string")
    ) {
      throw new Error("Invalid research snapshot entry");
    }
    seen.add(entry.key);
  }
  return snapshot;
}

export async function captureResearch(redis) {
  const keys = [];
  for (const prefix of ["link", "meta", "count", "collection"]) {
    for await (const batch of redis.scanIterator({ MATCH: `${prefix}:*`, COUNT: 100 })) {
      keys.push(...(Array.isArray(batch) ? batch : [batch]));
    }
  }
  const entries = [];
  const reads = redis.multi();
  keys.sort().forEach((key) => {
    if (/^(meta|collection):/.test(key)) {
      reads.hGetAll(key);
    } else {
      reads.get(key);
    }
    reads.pTTL(key);
  });
  const values = keys.length ? await reads.exec() : [];
  keys.forEach((key, index) => {
    const ttl = Number(values[index * 2 + 1]);
    if (ttl === -2) {
      throw new Error("Research data changed during capture; retry the snapshot");
    }
    entries.push({
      key,
      type: /^(meta|collection):/.test(key) ? "hash" : "string",
      value: values[index * 2],
      ttl,
    });
  });
  return validateSnapshot({ version: 1, capturedAt: new Date().toISOString(), entries });
}

export async function restoreResearch(redis, snapshot) {
  validateSnapshot(snapshot);
  const existing = await captureResearch(redis);
  if (existing.entries.length) {
    throw new Error("Restore requires an empty research test database");
  }
  const writes = redis.multi();
  for (const entry of snapshot.entries) {
    if (entry.type === "hash") {
      writes.hSet(entry.key, entry.value);
    } else {
      writes.set(entry.key, entry.value);
    }
    if (entry.ttl >= 0) {
      writes.pExpire(entry.key, Math.max(1, entry.ttl));
    }
  }
  if (snapshot.entries.length) {
    await writes.exec();
  }
}

async function main() {
  const [action, file] = process.argv.slice(2);
  if (!["snapshot", "restore"].includes(action) || !file) {
    throw new Error("Usage: node scripts/research-data.mjs <snapshot|restore> <file.json>");
  }
  const { createClient } = await import("redis");
  const url =
    action === "restore"
      ? testRedisUrl(process.env.TEST_REDIS_URL)
      : process.env.RESEARCH_REDIS_URL || process.env.REDIS_URL;
  if (!url) {
    throw new Error("Research Redis is not configured");
  }
  const redis = createClient({ url, socket: { connectTimeout: 5000, reconnectStrategy: false } });
  redis.on("error", () => {});
  try {
    await redis.connect();
    if (action === "snapshot") {
      const snapshot = await captureResearch(redis);
      await writeFile(file, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600, flag: "wx" });
      console.log(`Saved ${snapshot.entries.length} research records to ${file}`);
    } else {
      const snapshot = validateSnapshot(JSON.parse(await readFile(file, "utf8")));
      await restoreResearch(redis, snapshot);
      console.log(`Restored ${snapshot.entries.length} records to the isolated test database`);
    }
  } finally {
    if (redis.isOpen) {
      await redis.quit();
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Research data operation failed");
    process.exitCode = 1;
  });
}
