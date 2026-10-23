import { describe, expect, it } from "vitest";
import { normalizeOrcidWorks } from "./orcid";

describe("ORCID normalization", () => {
  it("normalizes DOI, journal, and publication year while skipping malformed works", () => {
    const works = normalizeOrcidWorks(
      {
        group: [
          {
            "work-summary": [
              {
                "put-code": 42,
                title: { title: { value: "Useful paper" } },
                "journal-title": { value: "Nature Data" },
                "publication-date": { year: { value: "2025" } },
                "external-ids": {
                  "external-id": [
                    {
                      "external-id-type": "doi",
                      "external-id-value": "10.1000/example",
                    },
                  ],
                },
              },
            ],
          },
          { "work-summary": [{ "put-code": 43 }] },
        ],
      },
      "0000-0000-0000-0000",
    );
    expect(works).toEqual([
      {
        slug: "orcid-42",
        title: "Useful paper",
        description: "Nature Data",
        tags: ["Nature Data"],
        year: "2025",
        target: "https://doi.org/10.1000/example",
      },
    ]);
  });
});
