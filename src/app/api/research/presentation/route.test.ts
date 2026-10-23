import { beforeEach, expect, it, vi } from "vitest";
import { getDirectorySnapshot } from "@/lib/research/directory";
import { getRedisUrl } from "@/lib/research/redis";
import { getOrcidWorks } from "@/lib/research/orcid";
import { parseMetadata } from "@/lib/research/models";
import { GET } from "./route";

const { after } = vi.hoisted(() => ({ after: vi.fn() }));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after,
}));
vi.mock("@/lib/research/directory", () => ({ getDirectorySnapshot: vi.fn() }));
vi.mock("@/lib/research/redis", () => ({ getRedisUrl: vi.fn() }));
vi.mock("@/lib/research/orcid", () => ({ getOrcidWorks: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getRedisUrl).mockReturnValue("redis://isolated");
  vi.stubEnv("ORCID_ID", "");
});
it("returns public details, summaries, collections and galleries without private fields", async () => {
  const project = {
    slug: "garcia",
    target: "https://example.org/paper",
    source: "manual" as const,
    clicks: 42,
    metadata: parseMetadata("garcia", {
      title: "Garcia",
      description: "Research",
      longDescription: "Full research details",
    }),
  };
  vi.mocked(getDirectorySnapshot).mockResolvedValue({ projects: [project], collections: [] });
  const response = await GET();
  const data = await response.json();
  expect(response.status).toBe(200);
  expect(data.availability).toBe("ready");
  expect(data.projects[0].summary.detailUrl).toBe("/?panel=research&project=garcia");
  expect(data.projects[0].detail.longDescription).toBe("Full research details");
  expect(data.projects[0].detail.shortUrl).toBe("/research/garcia");
  expect(data.projects[0].detail).not.toHaveProperty("clicks");
  expect(data.projects[0].detail).not.toHaveProperty("metadata");
});
it("represents an empty configured directory as ready", async () => {
  vi.mocked(getDirectorySnapshot).mockResolvedValue({ projects: [], collections: [] });
  expect(await (await GET()).json()).toEqual({
    availability: "ready",
    projects: [],
    collections: [],
  });
});
it("does not connect when research is unconfigured", async () => {
  vi.mocked(getRedisUrl).mockReturnValue(null);
  expect(await (await GET()).json()).toEqual({
    availability: "unconfigured",
    projects: [],
    collections: [],
  });
  expect(getDirectorySnapshot).not.toHaveBeenCalled();
});
it("returns a retryable 503 without caching or leaking service errors", async () => {
  vi.mocked(getDirectorySnapshot).mockRejectedValue(new Error("private connection details"));
  const response = await GET();
  expect(response.status).toBe(503);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({
    availability: "unavailable",
    projects: [],
    collections: [],
  });
});
it("preserves deferred ORCID refresh only when configured", async () => {
  vi.stubEnv("ORCID_ID", "test-orcid");
  vi.mocked(getDirectorySnapshot).mockResolvedValue({ projects: [], collections: [] });
  await GET();
  expect(after).toHaveBeenCalledOnce();
  expect(getOrcidWorks).not.toHaveBeenCalled();
  await after.mock.calls[0][0]();
  expect(getOrcidWorks).toHaveBeenCalledWith("test-orcid");
  vi.unstubAllEnvs();
});
