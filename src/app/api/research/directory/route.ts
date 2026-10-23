import { NextRequest, NextResponse } from "next/server";
import { jsonError, routeError } from "@/lib/research/api";
import { getDirectorySnapshot } from "@/lib/research/directory";
import { parsePagination, toPublicProject } from "@/lib/research/models";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pagination = parsePagination(searchParams, { limit: 50, max: 200 });
    if (!pagination.success) {
      return jsonError(pagination.error, 400);
    }
    const source = searchParams.get("source");
    if (source && source !== "manual" && source !== "orcid") {
      return jsonError("source must be manual or orcid", 400);
    }
    const tag = searchParams.get("tag")?.trim().toLowerCase();
    if (tag && tag.length > 80) {
      return jsonError("tag must be at most 80 characters", 400);
    }
    const { projects } = await getDirectorySnapshot();
    const filtered = projects
      .filter((project) => !source || project.source === source)
      .filter(
        (project) =>
          !tag || project.metadata.tags.some((value) => value.toLowerCase().includes(tag)),
      )
      .sort((a, b) => Date.parse(b.metadata.createdAt) - Date.parse(a.metadata.createdAt));
    const { limit, offset } = pagination.data;
    return NextResponse.json(
      {
        links: filtered.slice(offset, offset + limit).map(toPublicProject),
        pagination: {
          total: filtered.length,
          limit,
          offset,
          hasMore: offset + limit < filtered.length,
        },
        filters: { tag: tag || null, source: source || null },
      },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } },
    );
  } catch (error) {
    return routeError(error, "GET /api/research/directory");
  }
}
