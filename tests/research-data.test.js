import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import {
  captureResearch,
  restoreResearch,
  testRedisUrl,
  validateSnapshot,
} from "../scripts/research-data.mjs";

test.each([
  undefined,
  "redis://production.example/15",
  "redis://127.0.0.1:6398/0",
  "rediss://localhost/15",
])("research writes reject an unsafe test target: %s", (url) => {
  expect(() => testRedisUrl(url)).toThrow();
});

test("research tests accept only the reserved loopback database", () => {
  expect(testRedisUrl("redis://127.0.0.1:6398/15")).toBe("redis://127.0.0.1:6398/15");
});

test("the preservation fixture contains every project and ordered BioRSP membership", async () => {
  const data = validateSnapshot(
    JSON.parse(
      await readFile(new URL("./fixtures/research/baseline.json", import.meta.url), "utf8"),
    ),
  );
  expect(data.entries.filter((entry) => entry.key.startsWith("link:")).length).toBe(8);
  expect(data.entries.find((entry) => entry.key === "collection:biorsp").value.projects).toBe(
    "orcid-162573947,biorsp-abstracts,biorsp-posters,orcid-199324188",
  );
  expect(() => validateSnapshot({ version: 1, entries: [{ key: "other:key" }] })).toThrow();
  expect(() =>
    validateSnapshot({ version: 1, entries: [data.entries[0], data.entries[0]] }),
  ).toThrow();
});

test("snapshot capture detects disappearing records and restore refuses to overwrite data", async () => {
  const redis = {
    async *scanIterator({ MATCH }) {
      if (MATCH === "link:*") {
        yield ["link:study"];
      }
    },
    multi: () => ({ get() {}, pTTL() {}, exec: async () => [null, -2] }),
  };
  await expect(captureResearch(redis)).rejects.toThrow("changed during capture");
  redis.multi = () => ({ get() {}, pTTL() {}, exec: async () => ["https://example.org", -1] });
  await expect(restoreResearch(redis, { version: 1, entries: [] })).rejects.toThrow(
    "empty research test database",
  );
});
