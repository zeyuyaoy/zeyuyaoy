import { NextRequest, NextResponse } from "next/server";
import {
  authorizeAdmin,
  jsonError,
  PRIVATE_HEADERS,
  readJson,
  routeError,
} from "@/lib/research/api";
import { getDirectorySnapshot, invalidateDirectoryCache } from "@/lib/research/directory";
import { isValidSlug, normalizeSlug, normalizeTags } from "@/lib/research/models";
import { getRedisClient } from "@/lib/research/redis";

export async function GET(req: NextRequest) {
  const auth = authorizeAdmin(req);
  if (auth) {
    return auth;
  }
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    if (action !== "stats" && action !== "suggest") {
      return jsonError("action must be stats or suggest", 400);
    }
    const { projects } = await getDirectorySnapshot();
    const counts = new Map<string, number>();
    for (const project of projects) {
      for (const tag of project.metadata.tags) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    if (action === "suggest") {
      const prefix = (searchParams.get("prefix") || "").trim().toLowerCase();
      if (prefix.length > 80) {
        return jsonError("prefix must be at most 80 characters", 400);
      }
      return NextResponse.json(
        {
          suggestions: [...counts.keys()]
            .filter((tag) => tag.toLowerCase().startsWith(prefix))
            .sort()
            .slice(0, 10),
        },
        { headers: PRIVATE_HEADERS },
      );
    }
    const sources = projects.reduce(
      (result, project) => ({
        ...result,
        [project.source]: result[project.source] + 1,
      }),
      { manual: 0, orcid: 0 },
    );
    return NextResponse.json(
      {
        totalLinks: projects.length,
        totalClicks: projects.reduce((sum, project) => sum + project.clicks, 0),
        sources,
        topTags: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20),
        uniqueTags: counts.size,
      },
      { headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    return routeError(error, "GET /api/research/tags");
  }
}

async function existingSlugs(raw: unknown): Promise<{ slugs: string[]; error?: NextResponse }> {
  if (!Array.isArray(raw)) {
    return { slugs: [], error: jsonError("slugs must be an array", 400) };
  }
  const slugs = raw
    .filter((value): value is string => typeof value === "string")
    .map(normalizeSlug);
  if (slugs.length === 0 || slugs.some((slug) => !isValidSlug(slug))) {
    return {
      slugs: [],
      error: jsonError("slugs contains an invalid slug", 400),
    };
  }
  const { projects } = await getDirectorySnapshot({ fresh: true });
  const known = new Set(projects.map((project) => project.slug));
  const missing = slugs.filter((slug) => !known.has(slug));
  if (missing.length > 0) {
    return { slugs: [], error: jsonError("project not found", 404, missing) };
  }
  return { slugs };
}

async function updateProjectTags(slugs: string[], update: (tags: string[]) => string[]) {
  const redis = await getRedisClient();
  const reads = redis.multi();
  slugs.forEach((slug) => reads.hGetAll(`meta:${slug}`));
  const metas = await reads.exec();
  const writes = redis.multi();
  slugs.forEach((slug, index) => {
    const meta = metas[index] as unknown as Record<string, string>;
    writes.hSet(`meta:${slug}`, {
      tags: update(normalizeTags(meta?.tags)).join(","),
      updatedAt: new Date().toISOString(),
    });
  });
  await writes.exec();
  invalidateDirectoryCache();
}

export async function POST(req: NextRequest) {
  const auth = authorizeAdmin(req);
  if (auth) {
    return auth;
  }
  try {
    const body = await readJson(req);
    if (!body || typeof body !== "object") {
      return jsonError("invalid request body", 400);
    }
    const raw = body as Record<string, unknown>;
    const checked = await existingSlugs(raw.slugs);
    if (checked.error) {
      return checked.error;
    }
    const tags = normalizeTags(raw.tags);
    if (tags.length === 0) {
      return jsonError("tags must contain at least one tag", 400);
    }
    await updateProjectTags(checked.slugs, (existing) =>
      Array.from(new Set([...existing, ...tags])),
    );
    return NextResponse.json({ updated: checked.slugs.length, tags }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return routeError(error, "POST /api/research/tags");
  }
}

export async function PATCH(req: NextRequest) {
  const auth = authorizeAdmin(req);
  if (auth) {
    return auth;
  }
  try {
    const body = await readJson(req);
    if (!body || typeof body !== "object") {
      return jsonError("invalid request body", 400);
    }
    const raw = body as Record<string, unknown>;
    const { projects } = await getDirectorySnapshot({ fresh: true });
    if (typeof raw.oldTag === "string" && typeof raw.newTag === "string") {
      const oldTag = raw.oldTag.trim();
      const newTag = normalizeTags([raw.newTag])[0];
      if (!oldTag || !newTag) {
        return jsonError("oldTag and newTag are required", 400);
      }
      const affected = projects
        .filter((project) => project.metadata.tags.includes(oldTag))
        .map((project) => project.slug);
      await updateProjectTags(affected, (tags) =>
        Array.from(new Set(tags.map((tag) => (tag === oldTag ? newTag : tag)))),
      );
      return NextResponse.json({ updated: affected.length }, { headers: PRIVATE_HEADERS });
    }
    const checked = await existingSlugs(raw.slugs);
    if (checked.error) {
      return checked.error;
    }
    const remove = new Set(normalizeTags(raw.tags));
    if (remove.size === 0) {
      return jsonError("tags must contain at least one tag", 400);
    }
    await updateProjectTags(checked.slugs, (tags) => tags.filter((tag) => !remove.has(tag)));
    return NextResponse.json({ updated: checked.slugs.length }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return routeError(error, "PATCH /api/research/tags");
  }
}

export async function DELETE(req: NextRequest) {
  const auth = authorizeAdmin(req);
  if (auth) {
    return auth;
  }
  try {
    const body = await readJson(req);
    const tag =
      body && typeof body === "object" && typeof (body as Record<string, unknown>).tag === "string"
        ? (body as Record<string, string>).tag.trim()
        : "";
    if (!tag) {
      return jsonError("tag is required", 400);
    }
    const { projects } = await getDirectorySnapshot({ fresh: true });
    const affected = projects
      .filter((project) => project.metadata.tags.includes(tag))
      .map((project) => project.slug);
    await updateProjectTags(affected, (tags) => tags.filter((value) => value !== tag));
    return NextResponse.json({ updated: affected.length }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return routeError(error, "DELETE /api/research/tags");
  }
}
