import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { DELETE, GET, POST } from "@/app/api/research/links/route";
import {
  DELETE as DELETE_COLLECTION,
  GET as GET_COLLECTIONS,
  POST as POST_COLLECTION,
} from "@/app/api/research/collections/route";
import { GET as GET_DIRECTORY } from "@/app/api/research/directory/route";
import { GET as GET_REDIRECT } from "@/app/research/[slug]/route";
import { GET as GET_STATS } from "@/app/api/research/stats/route";
import { invalidateDirectoryCache } from "@/lib/research/directory";
import { closeRedisClient, getRedisClient } from "@/lib/research/redis";

import { testRedisUrl } from "../../../scripts/research-data.mjs";

const enabled = Boolean(process.env.TEST_REDIS_URL);
if (enabled) {
  const url = testRedisUrl(process.env.TEST_REDIS_URL);
  process.env.RESEARCH_REDIS_URL = url;
  process.env.REDIS_URL = url;
}
const suite = enabled ? describe : describe.skip;

suite("Redis-backed project workflow", () => {
  const slug = "vitest-research-project";
  const temporarySlug = "vitest-temporary-project";
  const collectionId = "vitest-collection";
  const keys = [slug, temporarySlug].flatMap((value) => [
    `link:${value}`,
    `count:${value}`,
    `meta:${value}`,
  ]);
  const headers = { "x-admin-key": "integration-secret", "content-type": "application/json" };

  beforeAll(async () => {
    process.env.ADMIN_KEY = "integration-secret";
    process.env.REDIS_URL = process.env.TEST_REDIS_URL;
    const redis = await getRedisClient();
    await redis.del([...keys, `collection:${collectionId}`]);
    invalidateDirectoryCache();
  });
  afterAll(async () => {
    const redis = await getRedisClient();
    await redis.del([...keys, `collection:${collectionId}`]);
    invalidateDirectoryCache();
    await closeRedisClient();
  });

  it("creates, reads, and deletes a project", async () => {
    const created = await POST(
      new NextRequest("http://localhost/api/research/links", {
        method: "POST",
        headers,
        body: JSON.stringify({ slug, target: "https://example.org", tags: ["test"] }),
      }),
    );
    expect(created.status).toBe(201);
    const fetched = await GET(
      new NextRequest(`http://localhost/api/research/links?slug=${slug}`, { headers }),
    );
    expect(fetched.status).toBe(200);
    expect((await fetched.json()).metadata.title).toBe(slug);
    const deleted = await DELETE(
      new NextRequest(`http://localhost/api/research/links?slug=${slug}`, {
        method: "DELETE",
        headers,
      }),
    );
    expect(deleted.status).toBe(200);
  });

  it("keeps collections, redirects, analytics, and the public contract consistent", async () => {
    const permanent = await POST(
      new NextRequest("http://localhost/api/research/links", {
        method: "POST",
        headers,
        body: JSON.stringify({
          slug,
          target: "https://example.org/permanent",
          permanent: true,
          title: "Permanent study",
          tags: ["test"],
          researchAreas: ["Integration biology"],
          organizations: [{ name: "Test Institute", role: "Host", url: null }],
          artifacts: [
            {
              type: "dataset",
              title: "Test data",
              url: "https://example.org/data",
              date: "2025",
              venue: "Repository",
              featured: true,
            },
          ],
        }),
      }),
    );
    const temporary = await POST(
      new NextRequest("http://localhost/api/research/links", {
        method: "POST",
        headers,
        body: JSON.stringify({
          slug: temporarySlug,
          target: "https://example.org/temporary",
          title: "Temporary study",
        }),
      }),
    );
    expect([permanent.status, temporary.status]).toEqual([201, 201]);

    const orphan = await POST_COLLECTION(
      new NextRequest("http://localhost/api/research/collections", {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: collectionId,
          name: "Integration studies",
          projects: ["not-a-project"],
        }),
      }),
    );
    expect(orphan.status).toBe(400);

    const collection = await POST_COLLECTION(
      new NextRequest("http://localhost/api/research/collections", {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: collectionId,
          name: "Integration studies",
          projects: [slug, temporarySlug],
          tags: ["integration"],
        }),
      }),
    );
    expect(collection.status).toBe(201);

    const publicDirectory = await GET_DIRECTORY(
      new NextRequest("http://localhost/api/research/directory?limit=200"),
    );
    expect(publicDirectory.status).toBe(200);
    const publicProject = (
      (await publicDirectory.json()) as {
        links: Array<Record<string, unknown>>;
      }
    ).links.find((project) => project.slug === slug);
    expect(publicProject).toBeDefined();
    expect(publicProject).not.toHaveProperty("clicks");
    expect(publicProject).toMatchObject({
      researchAreas: ["Integration biology"],
      organizations: [{ name: "Test Institute", role: "Host", url: null }],
    });
    const oldPublicProject = (
      (await GET_DIRECTORY(
        new NextRequest("http://localhost/api/research/directory?limit=200"),
      ).then((response) => response.json())) as {
        links: Array<Record<string, unknown>>;
      }
    ).links.find((project) => project.slug === temporarySlug);
    expect(oldPublicProject).toMatchObject({
      researchAreas: [],
      organizations: [],
      artifacts: [],
    });

    const permanentRedirect = await GET_REDIRECT(new NextRequest(`http://localhost/${slug}`), {
      params: Promise.resolve({ slug }),
    });
    const temporaryRedirect = await GET_REDIRECT(
      new NextRequest(`http://localhost/${temporarySlug}`),
      { params: Promise.resolve({ slug: temporarySlug }) },
    );
    expect(permanentRedirect.status).toBe(308);
    expect(temporaryRedirect.status).toBe(307);
    expect(permanentRedirect.headers.get("cache-control")).toBe("no-store");

    const analytics = await GET_STATS(
      new NextRequest("http://localhost/api/research/stats", { headers }),
    );
    expect(analytics.status).toBe(200);
    const analyticsBody = (await analytics.json()) as {
      totalClicks: number;
      averageClicks: number;
    };
    expect(analyticsBody.totalClicks).toBeGreaterThanOrEqual(2);
    expect(analyticsBody.averageClicks).toBeTypeOf("number");

    const deleted = await DELETE(
      new NextRequest(`http://localhost/api/research/links?slug=${slug}`, {
        method: "DELETE",
        headers,
      }),
    );
    expect(deleted.status).toBe(200);
    const collections = await GET_COLLECTIONS(
      new NextRequest("http://localhost/api/research/collections", { headers }),
    );
    const savedCollection = (
      (await collections.json()) as {
        collections: Array<{ id: string; projects: string[] }>;
      }
    ).collections.find((entry) => entry.id === collectionId);
    expect(savedCollection?.projects).toEqual([temporarySlug]);

    expect(
      (
        await DELETE_COLLECTION(
          new NextRequest(`http://localhost/api/research/collections?id=${collectionId}`, {
            method: "DELETE",
            headers,
          }),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await DELETE(
          new NextRequest(`http://localhost/api/research/links?slug=${temporarySlug}`, {
            method: "DELETE",
            headers,
          }),
        )
      ).status,
    ).toBe(200);
  });
});
