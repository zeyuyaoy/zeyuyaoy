import { describe, expect, it } from "vitest";
import {
  archiveUrl,
  effectiveArtifacts,
  filterProjects,
  parseArchiveState,
  projectMatchesYear,
  relatedProjects,
  toProjectSummary,
} from "./archive";
import type { PublicProject } from "./models";

function project(overrides: Partial<PublicProject> = {}): PublicProject {
  return {
    slug: "alpha",
    target: "https://example.org/alpha",
    targetType: "website",
    shortUrl: "/research/alpha",
    title: "Alpha protein atlas",
    description: "A spatial biology project",
    longDescription: "Longer transcriptomics description",
    tags: ["Biology"],
    researchAreas: ["Spatial omics"],
    technologies: ["Python"],
    methods: ["Microscopy"],
    organizations: [{ name: "Genome Institute", role: "Host", url: null }],
    collaborators: [{ name: "Ada", role: null, url: null }],
    artifacts: [
      {
        type: "poster",
        title: "Atlas poster",
        url: "https://example.org/poster",
        date: "2024",
        venue: "ISMB",
        featured: true,
      },
    ],
    source: "manual",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: null,
    startDate: "2022",
    endDate: "2024",
    githubRepo: null,
    photoSetId: null,
    ...overrides,
  };
}

describe("archive query model", () => {
  it("uses resource types for generated actions without replacing authored output titles", () => {
    const file = project({ target: "https://example.org/study.pdf", targetType: "file" });
    expect(effectiveArtifacts(file)[0]).toMatchObject({ type: "file", title: "Open file" });
    const authored = {
      ...file,
      artifacts: [{ ...file.artifacts[0], url: file.target, title: "Conference handout" }],
    };
    expect(effectiveArtifacts(authored)).toEqual(authored.artifacts);
    expect(toProjectSummary(file).targetType).toBe("file");
  });

  it("parses repeated and comma-separated tags and serializes only non-default state", () => {
    const state = parseArchiveState(
      new URLSearchParams(
        "q=atlas&tag=Biology&tag=Spatial%20omics,AI&sort=title-asc&view=timeline&x=keep",
      ),
    );
    expect(state.tags).toEqual(["Biology", "Spatial omics", "AI"]);
    expect(archiveUrl(state, "https://example.org/?x=keep")).toBe(
      "/?x=keep&q=atlas&tag=Biology&tag=Spatial+omics&tag=AI&sort=title-asc&view=timeline",
    );
  });

  it("searches rich metadata and applies case-insensitive match-all tags", () => {
    const projects = [
      toProjectSummary(project()),
      toProjectSummary(
        project({
          slug: "beta",
          title: "Other",
          tags: ["Biology"],
          researchAreas: [],
        }),
      ),
    ];
    const state = parseArchiveState(
      new URLSearchParams("q=genome+ismb+ada+microscopy&tag=biology&tag=spatial%20omics"),
    );
    expect(filterProjects(projects, state).map((item) => item.slug)).toEqual(["alpha"]);
  });

  it("matches years within research ranges and sorts deterministically", () => {
    const summary = toProjectSummary(project());
    expect(projectMatchesYear(summary, "2023")).toBe(true);
    expect(projectMatchesYear(summary, "2025")).toBe(false);
    const sameDate = toProjectSummary(project({ slug: "aardvark", title: "Aardvark" }));
    const state = parseArchiveState(new URLSearchParams());
    expect(filterProjects([summary, sameDate], state).map((item) => item.title)).toEqual([
      "Aardvark",
      "Alpha protein atlas",
    ]);
  });

  it("ranks related projects by shared terms, then research date and title", () => {
    const root = toProjectSummary(project());
    const twoTerms = toProjectSummary(project({ slug: "two", title: "Two", endDate: "2020" }));
    const newerOne = toProjectSummary(
      project({
        slug: "newer",
        title: "Newer",
        tags: [],
        researchAreas: ["Spatial omics"],
        endDate: "2025",
      }),
    );
    const unrelated = toProjectSummary(
      project({
        slug: "none",
        title: "None",
        tags: ["Chemistry"],
        researchAreas: [],
      }),
    );
    expect(relatedProjects(root, [newerOne, unrelated, twoTerms]).map((item) => item.slug)).toEqual(
      ["two", "newer"],
    );
  });
});
