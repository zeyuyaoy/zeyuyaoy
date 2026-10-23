import { describe, expect, it } from "vitest";
import { parsePhotoSets } from "./conferenceSlides";

describe("photo set parsing", () => {
  it("requires accessible slides and sorts newest first", () => {
    const sets = parsePhotoSets({
      conference: {
        slides: [
          { src: "/old.jpg", alt: "Old poster", date: "2024-01-01" },
          { src: "/new.jpg", alt: "New poster", date: "2025-01-01" },
        ],
      },
    });
    expect(sets.conference.slides.map((slide) => slide.src)).toEqual(["/new.jpg", "/old.jpg"]);
  });

  it("rejects missing alt text and non-ISO dates", () => {
    expect(() =>
      parsePhotoSets({
        bad: {
          slides: [
            {
              src: "/bad.jpg",
              date: "July 2025",
            },
          ],
        },
      }),
    ).toThrow(/descriptive alt/);
  });
});
