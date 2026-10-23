import { NextRequest, NextResponse } from "next/server";
import { jsonError, routeError } from "@/lib/research/api";
import {
  filterProjects,
  parseArchiveState,
  searchScore,
  toProjectSummary,
} from "@/lib/research/archive";
import { getDirectorySnapshot } from "@/lib/research/directory";
import { parsePagination, toPublicProject } from "@/lib/research/models";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pagination = parsePagination(searchParams, { limit: 20, max: 100 });
    if (!pagination.success) {
      return jsonError(pagination.error, 400);
    }
    const query = (searchParams.get("q") || "").trim();
    if (query.length > 200) {
      return jsonError("q must be at most 200 characters", 400);
    }
    const tags = searchParams
      .getAll("tag")
      .flatMap((value) => value.split(","))
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);
    if (tags.some((tag) => tag.length > 80)) {
      return jsonError("tags must be at most 80 characters", 400);
    }
    const source = searchParams.get("source");
    if (source && source !== "manual" && source !== "orcid") {
      return jsonError("source must be manual or orcid", 400);
    }
    const year = searchParams.get("year");
    if (year && !/^\d{4}$/.test(year)) {
      return jsonError("year must use YYYY", 400);
    }
    const sort = searchParams.get("sort");
    if (sort && !new Set(["newest", "oldest", "title-asc", "title-desc"]).has(sort)) {
      return jsonError("invalid sort", 400);
    }
    if (!query && tags.length === 0 && !source && !year) {
      return jsonError("q, tag, source, or year is required", 400);
    }
    const { projects } = await getDirectorySnapshot();
    const parsed = parseArchiveState(searchParams);
    const bySlug = new Map(projects.map((project) => [project.slug, project]));
    const summaries = filterProjects(projects.map(toProjectSummary), {
      ...parsed,
      query,
      tags,
      source: source === "manual" || source === "orcid" ? source : "all",
    });
    const matches = summaries.map((summary) => {
      const project = bySlug.get(summary.slug)!;
      const lowered = query.toLowerCase();
      return {
        ...toPublicProject(project),
        score: searchScore(summary, query),
        highlights: {
          title: lowered && project.metadata.title.toLowerCase().includes(lowered) ? [query] : [],
          description:
            lowered && project.metadata.description?.toLowerCase().includes(lowered) ? [query] : [],
          tags: lowered
            ? project.metadata.tags.filter((tag) => tag.toLowerCase().includes(lowered))
            : [],
        },
      };
    });
    const { limit, offset } = pagination.data;
    return NextResponse.json(
      {
        query: query || null,
        filters: {
          tags: tags.length ? tags : null,
          source: source || null,
          year: year || null,
          sort: parsed.sort,
        },
        results: matches.slice(offset, offset + limit),
        pagination: {
          total: matches.length,
          limit,
          offset,
          hasMore: offset + limit < matches.length,
        },
      },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } },
    );
  } catch (error) {
    return routeError(error, "GET /api/research/search");
  }
}
