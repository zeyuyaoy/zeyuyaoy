import { NextRequest, NextResponse } from "next/server";
import {
  authorizeAdmin,
  jsonError,
  PRIVATE_HEADERS,
  readJson,
  routeError,
} from "@/lib/research/api";
import {
  getDirectorySnapshot,
  getProject,
  invalidateDirectoryCache,
} from "@/lib/research/directory";
import {
  isValidSlug,
  normalizeSlug,
  normalizeTags,
  parseMetadata,
  parsePagination,
  serializeProjectMetadata,
  validateProjectInput,
} from "@/lib/research/models";
import { getRedisClient } from "@/lib/research/redis";
import { site } from "@/lib/research/site";

function responseProject(
  slug: string,
  target: string,
  metadata: Record<string, string>,
  clicks: number,
) {
  return {
    slug,
    short: `${site.url}/${slug}`,
    target,
    clicks,
    metadata: parseMetadata(slug, metadata),
  };
}

function requestEntries(body: unknown): { entries: unknown[]; single: boolean } | null {
  if (Array.isArray(body)) {
    return { entries: body, single: false };
  }
  if (!body || typeof body !== "object") {
    return null;
  }
  const raw = body as Record<string, unknown>;
  if (Array.isArray(raw.links)) {
    return { entries: raw.links, single: false };
  }
  if (raw.slug !== undefined) {
    return { entries: [raw], single: true };
  }
  return null;
}

export async function POST(req: NextRequest) {
  const auth = authorizeAdmin(req);
  if (auth) {
    return auth;
  }
  try {
    const requested = requestEntries(await readJson(req));
    if (!requested) {
      return jsonError("a project or links array is required", 400);
    }
    const redis = await getRedisClient();
    const results: Array<Record<string, unknown>> = [];

    for (const entry of requested.entries) {
      const parsed = validateProjectInput(entry, true);
      if (!parsed.success) {
        if (requested.single) {
          return jsonError(parsed.error, 400);
        }
        results.push({ error: parsed.error });
        continue;
      }
      const project = parsed.data;
      if (await redis.exists(`link:${project.slug}`)) {
        if (requested.single) {
          return jsonError("project already exists", 409);
        }
        results.push({ slug: project.slug, error: "project already exists" });
        continue;
      }
      const metadata = serializeProjectMetadata(project);
      const multi = redis.multi();
      multi.set(`link:${project.slug}`, project.target!);
      multi.set(`count:${project.slug}`, "0");
      multi.hSet(`meta:${project.slug}`, metadata);
      await multi.exec();
      results.push(responseProject(project.slug, project.target!, metadata, 0));
    }
    invalidateDirectoryCache();
    return NextResponse.json(requested.single ? results[0] : { results }, {
      status: 201,
      headers: PRIVATE_HEADERS,
    });
  } catch (error) {
    return routeError(error, "POST /api/research/links");
  }
}

export async function PUT(req: NextRequest) {
  const auth = authorizeAdmin(req);
  if (auth) {
    return auth;
  }
  try {
    const requested = requestEntries(await readJson(req));
    if (!requested) {
      return jsonError("a project or links array is required", 400);
    }
    const redis = await getRedisClient();
    const results: Array<Record<string, unknown>> = [];

    for (const entry of requested.entries) {
      const parsed = validateProjectInput(entry, false);
      if (!parsed.success) {
        if (requested.single) {
          return jsonError(parsed.error, 400);
        }
        results.push({ error: parsed.error });
        continue;
      }
      const project = parsed.data;
      const [target, existing] = await Promise.all([
        redis.get(`link:${project.slug}`),
        redis.hGetAll(`meta:${project.slug}`),
      ]);
      if (!target) {
        if (requested.single) {
          return jsonError("project not found", 404);
        }
        results.push({ slug: project.slug, error: "project not found" });
        continue;
      }
      const metadata = serializeProjectMetadata(project, existing);
      const multi = redis.multi();
      if (project.target) {
        multi.set(`link:${project.slug}`, project.target);
      }
      multi.hSet(`meta:${project.slug}`, metadata);
      await multi.exec();
      const clicks = Number((await redis.get(`count:${project.slug}`)) || 0);
      results.push(responseProject(project.slug, project.target || target, metadata, clicks));
    }
    invalidateDirectoryCache();
    return NextResponse.json(requested.single ? results[0] : { results }, {
      headers: PRIVATE_HEADERS,
    });
  } catch (error) {
    return routeError(error, "PUT /api/research/links");
  }
}

export async function GET(req: NextRequest) {
  const auth = authorizeAdmin(req);
  if (auth) {
    return auth;
  }
  try {
    const { searchParams } = new URL(req.url);
    const slugParam = searchParams.get("slug");
    if (slugParam) {
      const slug = normalizeSlug(slugParam);
      if (!isValidSlug(slug)) {
        return jsonError("invalid slug", 400);
      }
      const project = await getProject(slug);
      if (!project) {
        return jsonError("project not found", 404);
      }
      return NextResponse.json(project, { headers: PRIVATE_HEADERS });
    }

    const pagination = parsePagination(searchParams, { limit: 50, max: 200 });
    if (!pagination.success) {
      return jsonError(pagination.error, 400);
    }
    const source = searchParams.get("source");
    if (source && source !== "manual" && source !== "orcid") {
      return jsonError("source must be manual or orcid", 400);
    }
    const tag = searchParams.get("tag")?.trim().toLowerCase();
    const search = searchParams.get("search")?.trim().toLowerCase();
    if (search && search.length > 200) {
      return jsonError("search must be at most 200 characters", 400);
    }

    const { projects } = await getDirectorySnapshot();
    const filtered = projects
      .filter((project) => !source || project.source === source)
      .filter(
        (project) => !tag || project.metadata.tags.some((value) => value.toLowerCase() === tag),
      )
      .filter((project) => {
        if (!search) {
          return true;
        }
        return [
          project.slug,
          project.target,
          project.metadata.title,
          project.metadata.description || "",
          ...project.metadata.tags,
        ].some((value) => value.toLowerCase().includes(search));
      })
      .sort((a, b) => Date.parse(b.metadata.createdAt) - Date.parse(a.metadata.createdAt));
    const { limit, offset } = pagination.data;
    return NextResponse.json(
      {
        links: filtered.slice(offset, offset + limit),
        pagination: {
          total: filtered.length,
          limit,
          offset,
          hasMore: offset + limit < filtered.length,
        },
      },
      { headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    return routeError(error, "GET /api/research/links");
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
    if (typeof raw.slug !== "string") {
      return jsonError("slug is required", 400);
    }
    const slug = normalizeSlug(raw.slug);
    if (!isValidSlug(slug)) {
      return jsonError("invalid slug", 400);
    }
    const addTags = normalizeTags(raw.addTags);
    const removeTags = new Set(normalizeTags(raw.removeTags));
    if (addTags.length === 0 && removeTags.size === 0) {
      return jsonError("addTags or removeTags is required", 400);
    }

    const redis = await getRedisClient();
    const [exists, meta] = await Promise.all([
      redis.exists(`link:${slug}`),
      redis.hGetAll(`meta:${slug}`),
    ]);
    if (!exists) {
      return jsonError("project not found", 404);
    }
    const tags = Array.from(new Set([...normalizeTags(meta.tags), ...addTags])).filter(
      (tag) => !removeTags.has(tag),
    );
    await redis.hSet(`meta:${slug}`, {
      tags: tags.join(","),
      updatedAt: new Date().toISOString(),
    });
    invalidateDirectoryCache();
    return NextResponse.json({ slug, tags }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return routeError(error, "PATCH /api/research/links");
  }
}

export async function DELETE(req: NextRequest) {
  const auth = authorizeAdmin(req);
  if (auth) {
    return auth;
  }
  try {
    const { searchParams } = new URL(req.url);
    let body: Record<string, unknown> = {};
    if (req.headers.get("content-length") !== "0") {
      try {
        const parsed = await req.json();
        if (parsed && typeof parsed === "object") {
          body = parsed as Record<string, unknown>;
        }
      } catch {}
    }
    const values = [searchParams.get("slug"), body.slug]
      .concat(
        (searchParams.get("slugs") || "").split(","),
        Array.isArray(body.slugs) ? body.slugs : [],
      )
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map(normalizeSlug);
    const tag = typeof body.tag === "string" ? body.tag : searchParams.get("tag");
    const snapshot = await getDirectorySnapshot({ fresh: true });
    if (tag) {
      snapshot.projects
        .filter((project) => project.metadata.tags.includes(tag.trim()))
        .forEach((project) => values.push(project.slug));
    }
    const slugs = Array.from(new Set(values));
    if (slugs.length === 0) {
      return jsonError("slug, slugs, or tag is required", 400);
    }
    const invalid = slugs.filter((slug) => !isValidSlug(slug));
    if (invalid.length > 0) {
      return jsonError("invalid slug", 400, invalid);
    }

    const redis = await getRedisClient();
    const existing: string[] = [];
    const missing: string[] = [];
    const checks = redis.multi();
    slugs.forEach((slug) => checks.exists(`link:${slug}`));
    const exists = await checks.exec();
    slugs.forEach((slug, index) => (exists[index] ? existing : missing).push(slug));
    if (existing.length > 0) {
      const multi = redis.multi();
      const deleting = new Set(existing);
      existing.forEach((slug) => {
        multi.del(`link:${slug}`);
        multi.del(`count:${slug}`);
        multi.del(`meta:${slug}`);
      });
      snapshot.collections.forEach((collection) => {
        const projects = collection.projects.filter((slug) => !deleting.has(slug));
        if (projects.length !== collection.projects.length) {
          multi.hSet(`collection:${collection.id}`, {
            projects: projects.join(","),
            updatedAt: new Date().toISOString(),
          });
        }
      });
      await multi.exec();
    }
    invalidateDirectoryCache();
    return NextResponse.json(
      {
        deleted: existing,
        notFound: missing,
        summary: {
          deleted: existing.length,
          notFound: missing.length,
          total: slugs.length,
        },
      },
      { headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    return routeError(error, "DELETE /api/research/links");
  }
}
