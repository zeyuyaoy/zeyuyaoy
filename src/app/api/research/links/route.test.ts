import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { parseMetadata } from "@/lib/research/models";
import { POST, PUT } from "./route";
import { GET as directory } from "../directory/route";
import { GET as search } from "../search/route";
import { GET as exportProjects } from "../export/route";

const state = vi.hoisted(() => ({
  values: new Map<string, string>(),
  metadata: {} as Record<string, string>,
}));

vi.mock("@/lib/research/redis", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/research/redis")>()),
  getRedisClient: async () => ({
    exists: async (key: string) => Number(state.values.has(key)),
    get: async (key: string) => state.values.get(key) ?? null,
    hGetAll: async () => ({ ...state.metadata }),
    multi: () => {
      const operations: Array<() => void> = [];
      const transaction = {
        set: (key: string, value: string) => {
          operations.push(() => {
            state.values.set(key, value);
          });
          return transaction;
        },
        hSet: (_key: string, value: Record<string, string>) => {
          operations.push(() => {
            Object.assign(state.metadata, value);
          });
          return transaction;
        },
        exec: async () => operations.forEach((operation) => operation()),
      };
      return transaction;
    },
  }),
}));

vi.mock("@/lib/research/directory", () => ({
  invalidateDirectoryCache: vi.fn(),
  getDirectorySnapshot: async () => ({
    projects: state.values.has("link:study")
      ? [
          {
            slug: "study",
            target: state.values.get("link:study")!,
            source: "manual",
            clicks: 0,
            metadata: parseMetadata("study", state.metadata),
          },
        ]
      : [],
    collections: [],
  }),
}));

const headers = { "x-admin-key": "test-only-key", "content-type": "application/json" };
const request = (method: string, data: unknown) =>
  new NextRequest("http://localhost/api/research/links", {
    method,
    headers,
    body: JSON.stringify(data),
  });

beforeEach(() => {
  vi.stubEnv("ADMIN_KEY", "test-only-key");
  state.values.clear();
  state.metadata = {};
});
afterEach(() => vi.unstubAllEnvs());

describe("primary link type API contract", () => {
  it("validates overrides before writing, preserves omission, and accepts null to restore inference", async () => {
    const invalid = await POST(
      request("POST", {
        slug: "study",
        target: "https://example.org/study.pdf",
        targetType: "invalid",
      }),
    );
    expect(invalid.status).toBe(400);
    expect(state.values.size).toBe(0);
    const created = await POST(
      request("POST", {
        slug: "study",
        target: "https://example.org/study.pdf",
        targetType: "poster",
      }),
    );
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({
      short: "https://zeyuyaoy.com/research/study",
      metadata: { targetType: "poster" },
    });
    const updated = await PUT(request("PUT", { slug: "study", title: "Updated study" }));
    expect(await updated.json()).toMatchObject({
      short: "https://zeyuyaoy.com/research/study",
      metadata: { targetType: "poster" },
    });
    const cleared = await PUT(request("PUT", { slug: "study", targetType: null }));
    expect((await cleared.json()).metadata.targetType).toBeNull();
    const listing = await directory(new NextRequest("http://localhost/api/research/directory"));
    expect((await listing.json()).links[0].targetType).toBe("file");
  });

  it("returns resolved types through discovery and preserves the override in every export format", async () => {
    await POST(
      request("POST", {
        slug: "study",
        target: "https://example.org/opaque",
        targetType: "dataset",
      }),
    );
    const listing = await directory(new NextRequest("http://localhost/api/research/directory"));
    expect((await listing.json()).links[0].targetType).toBe("dataset");
    const results = await search(new NextRequest("http://localhost/api/research/search?q=study"));
    expect((await results.json()).results[0].targetType).toBe("dataset");
    const json = await exportProjects(
      new NextRequest("http://localhost/api/research/export?format=json", { headers }),
    );
    expect((await json.json()).export[0].targetType).toBe("dataset");
    const csv = await exportProjects(
      new NextRequest("http://localhost/api/research/export?format=csv", { headers }),
    );
    const [columns, row] = (await csv.text()).split("\n");
    expect(row.split(",")[columns.split(",").indexOf("targetType")]).toBe("dataset");
    const yaml = await exportProjects(
      new NextRequest("http://localhost/api/research/export?format=yaml", { headers }),
    );
    expect(await yaml.text()).toContain("targetType: dataset");
  });

  it("clears a repository attachment without changing its project, primary link, or other metadata", async () => {
    await POST(
      request("POST", {
        slug: "study",
        target: "https://youtu.be/working-video",
        title: "My study",
        githubRepo: "https://github.com/example/unavailable",
        tags: ["biology"],
      }),
    );
    const cleared = await PUT(request("PUT", { slug: "study", githubRepo: "" }));
    expect(cleared.status).toBe(200);
    expect(await cleared.json()).toMatchObject({
      target: "https://youtu.be/working-video",
      metadata: { title: "My study", githubRepo: null, tags: ["biology"] },
    });
    const listing = await directory(new NextRequest("http://localhost/api/research/directory"));
    expect((await listing.json()).links).toHaveLength(1);
  });
});
