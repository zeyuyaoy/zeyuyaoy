import { NextRequest, NextResponse } from "next/server";
import { authorizeAdmin, PRIVATE_HEADERS, routeError } from "@/lib/research/api";
import { getDirectorySnapshot } from "@/lib/research/directory";
import type { AnalyticsSummary } from "@/lib/research/models";

export async function GET(req: NextRequest) {
  const auth = authorizeAdmin(req);
  if (auth) {
    return auth;
  }
  try {
    const { projects } = await getDirectorySnapshot();
    const tagDistribution: Record<string, number> = {};
    const sources = { manual: 0, orcid: 0 };
    let totalClicks = 0;
    for (const project of projects) {
      sources[project.source]++;
      totalClicks += project.clicks;
      for (const tag of project.metadata.tags) {
        tagDistribution[tag] = (tagDistribution[tag] || 0) + 1;
      }
    }
    const result: AnalyticsSummary = {
      totalLinks: projects.length,
      totalClicks,
      averageClicks: projects.length ? Math.round((totalClicks / projects.length) * 100) / 100 : 0,
      uniqueTags: Object.keys(tagDistribution).length,
      sources,
      topProjects: projects
        .toSorted((a, b) => b.clicks - a.clicks)
        .slice(0, 10)
        .map((project) => ({
          slug: project.slug,
          title: project.metadata.title,
          clicks: project.clicks,
        })),
      topTags: Object.entries(tagDistribution)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([tag, count]) => ({
          tag,
          projects: count,
        })),
      tagDistribution,
      generatedAt: new Date().toISOString(),
    };
    return NextResponse.json(result, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return routeError(error, "GET /api/research/stats");
  }
}
