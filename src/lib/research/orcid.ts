import "server-only";
import { invalidateDirectoryCache } from "./directory";
import { isHttpUrl, parseMetadata, ProjectRecord, projectSource } from "./models";
import { getRedisClient } from "./redis";

type JsonRecord = Record<string, unknown>;

interface NormalizedOrcidWork {
  slug: string;
  title: string;
  description: string | null;
  tags: string[];
  year: string | null;
  target: string;
}

const ORCID_PATTERN = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

function record(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function nestedString(value: unknown, path: string[]): string | null {
  let current: unknown = value;
  for (const key of path) {
    const next = record(current);
    if (!next) {
      return null;
    }
    current = next[key];
  }
  return typeof current === "string" && current.trim() ? current.trim() : null;
}

function targetForWork(work: JsonRecord, orcidId: string): string {
  const external = record(work["external-ids"]);
  const ids = external?.["external-id"];
  if (Array.isArray(ids)) {
    for (const candidate of ids) {
      const id = record(candidate);
      if (!id || String(id["external-id-type"] || "").toLowerCase() !== "doi") {
        continue;
      }
      const provided = nestedString(id, ["external-id-url", "value"]);
      if (provided && isHttpUrl(provided)) {
        return provided;
      }
      const doi = typeof id["external-id-value"] === "string" ? id["external-id-value"].trim() : "";
      if (doi) {
        return `https://doi.org/${encodeURI(doi)}`;
      }
    }
  }
  const supplied = nestedString(work, ["url", "value"]);
  return supplied && isHttpUrl(supplied) ? supplied : `https://orcid.org/${orcidId}`;
}

export function normalizeOrcidWorks(value: unknown, orcidId: string): NormalizedOrcidWork[] {
  const groups = record(value)?.group;
  if (!Array.isArray(groups)) {
    return [];
  }
  return groups.flatMap((group): NormalizedOrcidWork[] => {
    const summaries = record(group)?.["work-summary"];
    if (!Array.isArray(summaries) || !summaries.length) {
      return [];
    }
    const work = record(summaries[0]);
    if (!work || (typeof work["put-code"] !== "number" && typeof work["put-code"] !== "string")) {
      return [];
    }
    const title = nestedString(work, ["title", "title", "value"]);
    if (!title) {
      return [];
    }
    const journal = nestedString(work, ["journal-title", "value"]);
    const description =
      typeof work["short-description"] === "string"
        ? work["short-description"].trim() || journal
        : journal;
    const year = nestedString(work, ["publication-date", "year", "value"]);
    return [
      {
        slug: `orcid-${work["put-code"]}`,
        title,
        description,
        tags: journal ? [journal] : [],
        year: year && /^\d{4}$/.test(year) ? year : null,
        target: targetForWork(work, orcidId),
      },
    ];
  });
}

export async function getOrcidWorks(orcidId: string): Promise<ProjectRecord[]> {
  if (!ORCID_PATTERN.test(orcidId)) {
    return [];
  }
  try {
    const response = await fetch(`https://pub.orcid.org/v3.0/${orcidId}/works`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
      next: { revalidate: 3_600 },
    });
    if (!response.ok) {
      return [];
    }
    const incoming = normalizeOrcidWorks(await response.json(), orcidId);
    if (!incoming.length) {
      return [];
    }

    const redis = await getRedisClient();
    const reads = redis.multi();
    incoming.forEach((work) => {
      reads.get(`link:${work.slug}`);
      reads.get(`count:${work.slug}`);
      reads.hGetAll(`meta:${work.slug}`);
    });
    const values = await reads.exec();
    const writes = redis.multi();
    let writeCount = 0;
    const projects = incoming.map((work, index): ProjectRecord => {
      const target = values[index * 3] as unknown as string | null;
      const clicks = values[index * 3 + 1] as unknown as string | null;
      const meta = values[index * 3 + 2] as unknown as Record<string, string>;
      const createdAt = meta?.createdAt || new Date().toISOString();
      if (!target) {
        writes.set(`link:${work.slug}`, work.target);
        writeCount++;
      }
      if (!clicks) {
        writes.set(`count:${work.slug}`, "0");
        writeCount++;
      }
      if (!meta || Object.keys(meta).length === 0) {
        writes.hSet(`meta:${work.slug}`, {
          permanent: "0",
          title: work.title,
          description: work.description || "",
          longDescription: "",
          tags: work.tags.join(","),
          researchAreas: "[]",
          technologies: "[]",
          methods: "[]",
          organizations: "[]",
          collaborators: "[]",
          artifacts: JSON.stringify([
            {
              type: work.target.startsWith("https://doi.org/") ? "publication" : "website",
              title: work.title,
              url: work.target,
              date: work.year,
              venue: work.tags[0] || null,
              featured: true,
            },
          ]),
          createdAt,
          updatedAt: "",
          startDate: work.year || "",
          endDate: work.year || "",
          githubRepo: "",
          photoSetId: "",
        });
        writeCount++;
      }
      const parsed = parseMetadata(work.slug, meta || {});
      return {
        slug: work.slug,
        target: target || work.target,
        clicks: Number(clicks || 0),
        source: projectSource(work.slug),
        metadata: {
          ...parsed,
          title: meta?.title || work.title,
          description: meta?.description || work.description,
          tags: meta?.tags ? parsed.tags : work.tags,
          artifacts: parsed.artifacts.length
            ? parsed.artifacts
            : [
                {
                  type: work.target.startsWith("https://doi.org/") ? "publication" : "website",
                  title: work.title,
                  url: work.target,
                  date: work.year,
                  venue: work.tags[0] || null,
                  featured: true,
                },
              ],
          createdAt,
          startDate: meta?.startDate || work.year,
          endDate: meta?.endDate || work.year,
        },
      };
    });
    if (writeCount) {
      await writes.exec();
      invalidateDirectoryCache();
    }
    return projects;
  } catch (error) {
    console.error(
      "ORCID synchronization failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return [];
  }
}
