import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { parseAbout, parseEducation, parseExperience } from "../src/lib/profile-content";

const education = (first = "### School\n\n> 2022–2026\n\nSchool description.") =>
  `## Formal education\n\n${first}\n\n## Programs\n\n### Summer school\n\n> 2024\n>\n> University\n\nProgram description.`;

describe("profile Markdown", () => {
  test("keeps linked and plain headings, source order, formatting, and paragraphs", () => {
    const body =
      "First **bold** and *emphasized* paragraph with [a link](https://example.com).\n\nSecond paragraph.\n\n- One\n- Two";
    const entries = parseExperience(
      `## [Second & Company](https://example.com/team)\n\n${body}\n\n## First\n\nAnother entry.`,
    );
    expect(entries).toEqual([
      { title: "Second & Company", href: "https://example.com/team", body },
      { title: "First", body: "Another entry." },
    ]);
    expect(parseAbout(`  \n${body}\n`)).toBe(body);
  });

  test("extracts education metadata without including it in the description", () => {
    const result = parseEducation(
      education(
        "### [School](https://example.com)\n\n> 2022–2026\n>\n> Diploma · Singapore\n\n**Valedictorian.**\n\nAnother paragraph.",
      ),
    );
    expect(result[0]).toEqual({
      title: "Formal education",
      entries: [
        {
          title: "School",
          href: "https://example.com",
          dateLabel: "2022–2026",
          subtitle: "Diploma · Singapore",
          body: "**Valedictorian.**\n\nAnother paragraph.",
        },
      ],
    });
    expect(result[1].title).toBe("Programs");
    expect(result[1].entries[0].subtitle).toBe("University");
    expect(parseEducation(education())[0].entries[0].subtitle).toBeUndefined();
  });

  test.each([
    ["", "About Me"],
    ["# Biography\n\nHello", "About Me"],
    ["- A list first", "About Me"],
    ["Hello\n\n<script>alert(1)</script>", "Unsupported html"],
    ["Hello [link](javascript:alert)", "Links must use"],
  ])("rejects invalid About content: %s", (source, message) => {
    expect(() => parseAbout(source, "custom/about.md")).toThrow(`custom/about.md [About Me]`);
    expect(() => parseAbout(source)).toThrow(message);
  });

  test.each([
    ["", "Add at least one"],
    ["Orphan paragraph", "Place content beneath"],
    ["### Wrong level\n\nText", "Wrong level"],
    ["## Empty", "Empty"],
    ["## **Formatted title**\n\nText", "## **Formatted title**"],
    ["## A\n\nText\n\n## a\n\nMore", "Duplicate title"],
    ["## [A](javascript:alert)\n\nText", "Heading links"],
    ["## A\n\n![Image](https://example.com/image.png)", "Unsupported image"],
    ["## A\n\n```js\nconsole.log('## Not an entry');\n```", "Unsupported code"],
  ])("reports malformed experience content: %s", (source, message) => {
    expect(() => parseExperience(source, "custom/experience.md")).toThrow("custom/experience.md");
    expect(() => parseExperience(source)).toThrow(message);
  });

  test.each([
    ["### Missing group\n\nText", "Missing group"],
    [education("### School\n\nDescription without dates."), "School"],
    [education("### School\n\n> 2026\n>\n> Diploma\n>\n> Extra field\n\nText"), "blockquote"],
    [education("### School\n\n> **2026**\n\nText"), "plain text"],
    [education("### School\n\n> 2026"), "describing this entry"],
    [education(""), "Formal education"],
    [education().replace("### Summer school", "### School"), "Duplicate title"],
    [education() + "\n\n## Extra\n\n### Other\n\n> 2026\n\nText", "exactly two"],
    ["## Formal\n\n### School\n\n> 2026\n\nText", "exactly two"],
  ])("reports malformed education content: %s", (source, message) => {
    expect(() => parseEducation(source, "custom/education.md")).toThrow("custom/education.md");
    expect(() => parseEducation(source)).toThrow(message);
  });

  test("the editable repository content follows the profile format", async () => {
    const read = (name) =>
      readFile(new URL(`../src/content/profile/${name}.md`, import.meta.url), "utf8");
    const [about, experience, groups] = await Promise.all([
      read("about"),
      read("experience"),
      read("education"),
    ]);
    expect(() => parseAbout(about)).not.toThrow();
    expect(() => parseExperience(experience)).not.toThrow();
    expect(() => parseEducation(groups)).not.toThrow();
  });
});
