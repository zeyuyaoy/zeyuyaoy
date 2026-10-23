import "server-only";
import type { RedisClientType } from "redis";
import {
  CollectionRecord,
  isHttpUrl,
  parseCollection,
  parseMetadata,
  ProjectRecord,
  projectSource,
} from "./models";
import { getRedisClient } from "./redis";

interface DirectorySnapshot {
  projects: ProjectRecord[];
  collections: CollectionRecord[];
}

const CACHE_TTL_MS = 15_000;
let cachedSnapshot: { expiresAt: number; value: DirectorySnapshot } | null = null;
let pendingSnapshot: Promise<DirectorySnapshot> | null = null;

export function invalidateDirectoryCache() {
  cachedSnapshot = null;
  pendingSnapshot = null;
}

async function scanKeys(redis: RedisClientType, pattern: string): Promise<string[]> {
  const keys: string[] = [];
  for await (const batch of redis.scanIterator({ MATCH: pattern, COUNT: 100 })) {
    if (Array.isArray(batch)) {
      keys.push(...batch);
    } else {
      keys.push(batch as string);
    }
  }
  return keys;
}

async function loadProjects(redis: RedisClientType): Promise<ProjectRecord[]> {
  const keys = await scanKeys(redis, "link:*");
  const projects: ProjectRecord[] = [];
  for (let start = 0; start < keys.length; start += 100) {
    const batch = keys.slice(start, start + 100);
    const pipeline = redis.multi();
    for (const key of batch) {
      const slug = key.slice("link:".length);
      pipeline.get(key);
      pipeline.get(`count:${slug}`);
      pipeline.hGetAll(`meta:${slug}`);
    }
    const values = await pipeline.exec();
    batch.forEach((key, index) => {
      const slug = key.slice("link:".length);
      const target = values[index * 3] as unknown as string | null;
      const clicks = values[index * 3 + 1] as unknown as string | null;
      const meta = values[index * 3 + 2] as unknown as Record<string, string>;
      if (!target || !isHttpUrl(target)) {
        return;
      }
      projects.push({
        slug,
        target,
        clicks: Number(clicks || 0),
        source: projectSource(slug),
        metadata: parseMetadata(slug, meta || {}),
      });
    });
  }
  return projects;
}

async function loadCollections(redis: RedisClientType): Promise<CollectionRecord[]> {
  const keys = await scanKeys(redis, "collection:*");
  const collections: CollectionRecord[] = [];
  for (let start = 0; start < keys.length; start += 100) {
    const batch = keys.slice(start, start + 100);
    const pipeline = redis.multi();
    batch.forEach((key) => pipeline.hGetAll(key));
    const values = await pipeline.exec();
    batch.forEach((key, index) =>
      collections.push(
        parseCollection(
          key.slice("collection:".length),
          (values[index] as unknown as Record<string, string>) || {},
        ),
      ),
    );
  }
  return collections;
}

async function loadDirectorySnapshot(): Promise<DirectorySnapshot> {
  const redis = await getRedisClient();
  const [projects, collections] = await Promise.all([
    loadProjects(redis as RedisClientType),
    loadCollections(redis as RedisClientType),
  ]);
  return { projects, collections };
}

export async function getDirectorySnapshot(options?: { fresh?: boolean }) {
  if (!options?.fresh && cachedSnapshot && cachedSnapshot.expiresAt > Date.now()) {
    return cachedSnapshot.value;
  }
  if (!options?.fresh && pendingSnapshot) {
    return pendingSnapshot;
  }
  pendingSnapshot = loadDirectorySnapshot().then((value) => {
    cachedSnapshot = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  });
  try {
    return await pendingSnapshot;
  } finally {
    pendingSnapshot = null;
  }
}

export async function getProject(slug: string): Promise<ProjectRecord | null> {
  const redis = await getRedisClient();
  const [target, count, meta] = await Promise.all([
    redis.get(`link:${slug}`),
    redis.get(`count:${slug}`),
    redis.hGetAll(`meta:${slug}`),
  ]);
  if (!target || !isHttpUrl(target)) {
    return null;
  }
  return {
    slug,
    target,
    clicks: Number(count || 0),
    source: projectSource(slug),
    metadata: parseMetadata(slug, meta),
  };
}
