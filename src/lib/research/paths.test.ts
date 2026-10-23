import { describe, expect, it } from "vitest";
import { archiveTagPath, projectPath, shortPath } from "./paths";
import { parseMetadata, toPublicProject } from "./models";
import { toProjectSummary } from "./archive";

describe("research destinations", () => {
  it("keeps project pages and counted artifact links distinct", () => {
    const record = {
      slug: "garcia",
      target: "https://example.org/paper?download=1#page=2",
      source: "manual" as const,
      clicks: 10,
      metadata: parseMetadata("garcia", {}),
    };
    expect(toPublicProject(record).shortUrl).toBe(shortPath("garcia"));
    expect(toProjectSummary(record).detailUrl).toBe(projectPath("garcia"));
    expect(projectPath("garcia")).toBe("/?panel=research&project=garcia");
    expect(shortPath("garcia")).toBe("/research/garcia");
    expect(toPublicProject(record).target).toBe(record.target);
  });
});

it("puts research tags before a preserved collection anchor", () => {
  expect(
    archiveTagPath("/?panel=research&project=garcia#collection-biorsp", "machine learning"),
  ).toBe("/?panel=research&tag=machine+learning#collection-biorsp");
});
