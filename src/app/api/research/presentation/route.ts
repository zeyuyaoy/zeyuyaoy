import { after, NextResponse } from "next/server";
import { toProjectSummary } from "@/lib/research/archive";
import { getPhotoSet } from "@/lib/research/conferenceSlides";
import { getDirectorySnapshot } from "@/lib/research/directory";
import { toPublicProject } from "@/lib/research/models";
import { getOrcidWorks } from "@/lib/research/orcid";
import type { ResearchPresentation } from "@/lib/research/presentation";
import { getRedisUrl } from "@/lib/research/redis";

export const dynamic = "force-dynamic";
export async function GET() {
  const empty = (availability: ResearchPresentation["availability"], status = 200) =>
    NextResponse.json(
      { availability, projects: [], collections: [] } satisfies ResearchPresentation,
      { status, headers: { "Cache-Control": "no-store" } },
    );
  if (!getRedisUrl()) {
    return empty("unconfigured");
  }
  try {
    const snapshot = await getDirectorySnapshot();
    const payload: ResearchPresentation = {
      availability: "ready",
      projects: snapshot.projects.map((record) => {
        const detail = toPublicProject(record);
        return {
          summary: toProjectSummary(record),
          detail,
          photoSet: getPhotoSet(detail.photoSetId || detail.slug),
        };
      }),
      collections: snapshot.collections.map((collection) => ({
        ...collection,
        photoSet: getPhotoSet(collection.id),
      })),
    };
    const orcid = process.env.ORCID_ID;
    if (orcid) {
      after(async () => {
        await getOrcidWorks(orcid);
      });
    }
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return empty("unavailable", 503);
  }
}
