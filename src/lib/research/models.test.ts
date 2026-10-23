import { describe, expect, it } from "vitest";
import {
  artifactTypeLabel,
  formatResearchDate,
  formatResearchDateRange,
  isHttpUrl,
  isValidDate,
  normalizeTags,
  parseMetadata,
  parsePagination,
  resolveTargetType,
  serializeProjectMetadata,
  toPublicProject,
  validateCollectionInput,
  validateProjectInput,
} from "./models";

describe("project validation", () => {
  it("round-trips target type overrides, preserves omitted values, and clears explicit null", () => {
    const parsed = validateProjectInput(
      {
        slug: "study",
        target: "https://example.org/opaque",
        targetType: "file",
      },
      true,
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }
    const stored = serializeProjectMetadata(parsed.data);
    expect(parseMetadata("study", stored).targetType).toBe("file");
    expect(serializeProjectMetadata({ slug: "study", title: "Updated" }, stored).targetType).toBe(
      "file",
    );
    expect(
      parseMetadata(
        "study",
        serializeProjectMetadata(
          {
            slug: "study",
            targetType: null,
          },
          stored,
        ),
      ).targetType,
    ).toBeNull();
    expect(parseMetadata("study", {}).targetType).toBeNull();
    expect(parseMetadata("study", { targetType: "unknown" }).targetType).toBeNull();
    expect(
      toPublicProject({
        slug: "study",
        target: parsed.data.target!,
        source: "manual",
        clicks: 0,
        metadata: parseMetadata("study", stored),
      }).targetType,
    ).toBe("file");
  });

  it.each(["invalid", "", 1, false, [], {}])("rejects an invalid targetType %j", (targetType) => {
    expect(validateProjectInput({ slug: "study", targetType }, false)).toMatchObject({
      success: false,
    });
  });

  it.each([
    ["https://youtu.be/example", "video"],
    ["https://www.youtube.com/watch?v=example", "video"],
    ["https://notyoutube.com/watch?v=example", "website"],
    ["https://youtube.com.example.org/watch?v=example", "website"],
    ["https://github.com/owner/repo", "code"],
    ["https://github.com/owner", "website"],
    ["https://doi.org/10.1234/paper", "publication"],
    ["https://drive.google.com/file/d/id/view?usp=sharing", "file"],
    ["https://drive.google.com/drive/folders/id", "website"],
    ["https://docs.google.com/presentation/d/id/edit", "file"],
    ["https://example.org/PAPER.PDF?download=1", "file"],
    ["https://example.org/movie.mp4", "video"],
    ["https://example.org/?file=paper.pdf", "website"],
    ["https://example.org/project", "website"],
  ])("infers %s as %s without fetching the destination", (target, expected) => {
    expect(resolveTargetType({ target, artifacts: [] })).toBe(expected);
  });

  it("prefers explicit types, then authored artifacts, and uses readable action labels", () => {
    const artifact = {
      type: "poster" as const,
      title: "Poster",
      url: "https://example.org/study.pdf",
      date: null,
      venue: null,
      featured: true,
    };
    const project = { target: artifact.url, artifacts: [artifact] };
    expect(resolveTargetType(project)).toBe("poster");
    expect(resolveTargetType({ ...project, targetType: "presentation" })).toBe("presentation");
    expect(artifactTypeLabel("code")).toBe("source code");
    expect(artifactTypeLabel("other")).toBe("resource");
  });

  it("normalizes compatible project input without fetching metadata", () => {
    const parsed = validateProjectInput(
      {
        slug: "/My-Study",
        target: "https://example.org/paper",
        tags: "Bioinformatics, Bioinformatics, AI",
        startDate: "2025-09",
      },
      true,
    );
    expect(parsed).toEqual({
      success: true,
      data: expect.objectContaining({
        slug: "my-study",
        tags: ["Bioinformatics", "AI"],
        startDate: "2025-09",
      }),
    });
    if (parsed.success) {
      expect(serializeProjectMetadata(parsed.data).title).toBe("my-study");
    }
  });

  it("rejects unsafe URLs and impossible dates", () => {
    expect(isHttpUrl("file:///etc/passwd")).toBe(false);
    expect(validateProjectInput({ slug: "x", target: "javascript:alert(1)" }, true).success).toBe(
      false,
    );
    expect(isValidDate("2025-02-31")).toBe(false);
  });

  it("keeps valid partial dates and formats them without inventing present state", () => {
    expect(isValidDate("2025")).toBe(true);
    expect(isValidDate("2025-07")).toBe(true);
    expect(formatResearchDate("2025-07")).toBe("Jul 2025");
    expect(formatResearchDate("2025")).toBe("2025");
  });

  it("formats the same date range for cards, timelines and project details", () => {
    expect(formatResearchDateRange(null, null)).toBeNull();
    expect(formatResearchDateRange("2024", null)).toBe("2024");
    expect(formatResearchDateRange(null, "2025-07")).toBe("Jul 2025");
    expect(formatResearchDateRange("2025-07", "2025-07")).toBe("Jul 2025");
    expect(formatResearchDateRange("2024", "2025-07")).toBe("2024–Jul 2025");
  });

  it("round-trips structured optional metadata and tolerates malformed stored JSON", () => {
    const parsed = validateProjectInput(
      {
        slug: "study",
        target: "https://example.org",
        researchAreas: ["Genomics"],
        organizations: [{ name: "Institute", role: "Host", url: "https://example.org/institute" }],
        artifacts: [
          {
            type: "dataset",
            title: "Data",
            url: "https://example.org/data",
            date: "2025",
            venue: "Zenodo",
            featured: true,
          },
        ],
      },
      true,
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }
    const stored = serializeProjectMetadata(parsed.data);
    expect(parseMetadata("study", stored)).toEqual(
      expect.objectContaining({
        researchAreas: ["Genomics"],
        organizations: [expect.objectContaining({ name: "Institute" })],
        artifacts: [expect.objectContaining({ type: "dataset", featured: true })],
      }),
    );
    expect(
      parseMetadata("old-record", {
        researchAreas: "not-json",
        artifacts: "{}",
      }),
    ).toEqual(expect.objectContaining({ researchAreas: [], artifacts: [], organizations: [] }));
  });
});

describe("collection and query validation", () => {
  it("normalizes collection projects and tags", () => {
    expect(
      validateCollectionInput(
        {
          id: "Group-One",
          name: "Group",
          projects: ["A", "b"],
          tags: "genomics, data",
        },
        true,
      ),
    ).toEqual({
      success: true,
      data: {
        id: "group-one",
        name: "Group",
        description: undefined,
        projects: ["a", "b"],
        tags: ["genomics", "data"],
      },
    });
    expect(normalizeTags([" a ", "a", "b"])).toEqual(["a", "b"]);
  });

  it("rejects unbounded or invalid pagination", () => {
    expect(parsePagination(new URLSearchParams("limit=-1"), { limit: 20, max: 100 }).success).toBe(
      false,
    );
    expect(
      parsePagination(new URLSearchParams("limit=20&offset=10"), { limit: 5, max: 100 }),
    ).toEqual({
      success: true,
      data: { limit: 20, offset: 10 },
    });
  });
});
