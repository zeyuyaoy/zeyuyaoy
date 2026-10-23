import { NextRequest, NextResponse } from "next/server";
import {
  authorizeAdmin,
  jsonError,
  PRIVATE_HEADERS,
  readJson,
  routeError,
} from "@/lib/research/api";
import { getDirectorySnapshot, invalidateDirectoryCache } from "@/lib/research/directory";
import { normalizeTags, validateCollectionInput } from "@/lib/research/models";
import { getRedisClient } from "@/lib/research/redis";

async function validateProjects(projects: string[]) {
  const { projects: existing } = await getDirectorySnapshot({ fresh: true });
  const known = new Set(existing.map((project) => project.slug));
  return projects.filter((project) => !known.has(project));
}

export async function GET(req: NextRequest) {
  const auth = authorizeAdmin(req);
  if (auth) {
    return auth;
  }
  try {
    const { collections } = await getDirectorySnapshot();
    return NextResponse.json(
      { collections: collections.toSorted((a, b) => a.name.localeCompare(b.name)) },
      { headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    return routeError(error, "GET /api/research/collections");
  }
}

export async function POST(req: NextRequest) {
  const auth = authorizeAdmin(req);
  if (auth) {
    return auth;
  }
  try {
    const parsed = validateCollectionInput(await readJson(req), true);
    if (!parsed.success) {
      return jsonError(parsed.error, 400);
    }
    const collection = parsed.data;
    const missing = await validateProjects(collection.projects || []);
    if (missing.length > 0) {
      return jsonError("collection references unknown projects", 400, missing);
    }
    const redis = await getRedisClient();
    if (await redis.exists(`collection:${collection.id}`)) {
      return jsonError("collection already exists", 409);
    }
    const now = new Date().toISOString();
    await redis.hSet(`collection:${collection.id}`, {
      name: collection.name!,
      description: collection.description || "",
      projects: (collection.projects || []).join(","),
      tags: (collection.tags || []).join(","),
      createdAt: now,
      updatedAt: "",
    });
    invalidateDirectoryCache();
    return NextResponse.json({ id: collection.id }, { status: 201, headers: PRIVATE_HEADERS });
  } catch (error) {
    return routeError(error, "POST /api/research/collections");
  }
}

export async function PUT(req: NextRequest) {
  const auth = authorizeAdmin(req);
  if (auth) {
    return auth;
  }
  try {
    const parsed = validateCollectionInput(await readJson(req), false);
    if (!parsed.success) {
      return jsonError(parsed.error, 400);
    }
    const collection = parsed.data;
    const redis = await getRedisClient();
    const key = `collection:${collection.id}`;
    if (!(await redis.exists(key))) {
      return jsonError("collection not found", 404);
    }
    if (collection.projects) {
      const missing = await validateProjects(collection.projects);
      if (missing.length > 0) {
        return jsonError("collection references unknown projects", 400, missing);
      }
    }
    const updates: Record<string, string> = { updatedAt: new Date().toISOString() };
    if (collection.name !== undefined) {
      updates.name = collection.name || collection.id;
    }
    if (collection.description !== undefined) {
      updates.description = collection.description;
    }
    if (collection.projects !== undefined) {
      updates.projects = collection.projects.join(",");
    }
    if (collection.tags !== undefined) {
      updates.tags = collection.tags.join(",");
    }
    await redis.hSet(key, updates);
    invalidateDirectoryCache();
    return NextResponse.json({ id: collection.id }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return routeError(error, "PUT /api/research/collections");
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
    const parsed = validateCollectionInput({ id: raw.id }, false);
    if (!parsed.success) {
      return jsonError(parsed.error, 400);
    }
    const addProjects = normalizeTags(raw.addProjects);
    const removeProjects = new Set(normalizeTags(raw.removeProjects));
    if (addProjects.length === 0 && removeProjects.size === 0) {
      return jsonError("addProjects or removeProjects is required", 400);
    }
    const redis = await getRedisClient();
    const key = `collection:${parsed.data.id}`;
    const data = await redis.hGetAll(key);
    if (Object.keys(data).length === 0) {
      return jsonError("collection not found", 404);
    }
    const missing = await validateProjects(addProjects);
    if (missing.length > 0) {
      return jsonError("collection references unknown projects", 400, missing);
    }
    const projects = Array.from(new Set([...normalizeTags(data.projects), ...addProjects])).filter(
      (project) => !removeProjects.has(project),
    );
    await redis.hSet(key, {
      projects: projects.join(","),
      updatedAt: new Date().toISOString(),
    });
    invalidateDirectoryCache();
    return NextResponse.json({ id: parsed.data.id, projects }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return routeError(error, "PATCH /api/research/collections");
  }
}

export async function DELETE(req: NextRequest) {
  const auth = authorizeAdmin(req);
  if (auth) {
    return auth;
  }
  try {
    const id = new URL(req.url).searchParams.get("id");
    const parsed = validateCollectionInput({ id }, false);
    if (!parsed.success) {
      return jsonError(parsed.error, 400);
    }
    const redis = await getRedisClient();
    const deleted = await redis.del(`collection:${parsed.data.id}`);
    if (!deleted) {
      return jsonError("collection not found", 404);
    }
    invalidateDirectoryCache();
    return NextResponse.json({ id: parsed.data.id }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return routeError(error, "DELETE /api/research/collections");
  }
}
