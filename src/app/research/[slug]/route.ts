import { NextRequest, NextResponse } from "next/server";
import { getProject, invalidateDirectoryCache } from "@/lib/research/directory";
import { isValidSlug, normalizeSlug } from "@/lib/research/models";
import { getRedisClient, RedisUnavailableError } from "@/lib/research/redis";

const PRIVATE_REDIRECT_HEADERS = { "X-Robots-Tag": "noindex", "Cache-Control": "no-store" };

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const slug = normalizeSlug((await params).slug || "");
  if (!slug || !isValidSlug(slug)) {
    return new NextResponse("Not found", {
      status: 404,
      headers: PRIVATE_REDIRECT_HEADERS,
    });
  }
  try {
    const project = await getProject(slug);
    if (!project) {
      return new NextResponse("Not found", {
        status: 404,
        headers: PRIVATE_REDIRECT_HEADERS,
      });
    }
    try {
      await (await getRedisClient()).incr(`count:${slug}`);
      invalidateDirectoryCache();
    } catch {}
    const response = NextResponse.redirect(project.target, project.metadata.permanent ? 308 : 307);
    Object.entries(PRIVATE_REDIRECT_HEADERS).forEach(([name, value]) =>
      response.headers.set(name, value),
    );
    return response;
  } catch (error) {
    if (!(error instanceof RedisUnavailableError)) {
      console.error("Redirect lookup failed:", error);
    }
    return new NextResponse("Service unavailable", {
      status: 503,
      headers: PRIVATE_REDIRECT_HEADERS,
    });
  }
}
