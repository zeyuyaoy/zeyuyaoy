import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { parseAbout, parseEducation, parseExperience } from "../src/lib/profile-content";

const education = (first = "### School\n\n> 2022–2026\n\nSchool description.") =>
  `## Formal education\n\n${first}`;

describe("profile Markdown", () => {
  test("keeps headings, formatting, and paragraphs while sorting entries by date", () => {
    const body =
      "First **bold** and *emphasized* paragraph with [a link](https://example.com).\n\nSecond paragraph.\n\n- One\n- Two";
    const entries = parseExperience(
      `## [Second & Company](https://example.com/team)\n\n> 2021–Present\n\n${body}\n\n## First\n\n> June–August 2024\n\nAnother entry.`,
    );
    expect(entries).toEqual([
      { title: "First", dateLabel: "June–August 2024", body: "Another entry." },
      {
        title: "Second & Company",
        href: "https://example.com/team",
        dateLabel: "2021–Present",
        body,
      },
    ]);
    expect(parseAbout(`  \n${body}\n`)).toBe(body);
  });

  test("extracts education metadata without including it in the description", () => {
    const result = parseEducation(
      education(
        "### [School](https://example.com)\n\n> 2022–2026\n>\n> Diploma · Singapore\n\n**Valedictorian.**\n\nAnother paragraph.",
      ),
    );
    expect(result).toEqual({
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
    expect(parseEducation(education()).entries[0].subtitle).toBeUndefined();
  });

  test("sorts formal institutions by date within their group, including incoming education", () => {
    const result = parseEducation(
      education() +
        "\n\n### [Next school](https://example.com/school)\n\n> Incoming · 2028\n\nNext stage.",
    );
    expect(result.entries.map((entry) => entry.title)).toEqual(["Next school", "School"]);
    expect(result.entries[0]).toEqual({
      title: "Next school",
      href: "https://example.com/school",
      dateLabel: "Incoming · 2028",
      body: "Next stage.",
    });
  });

  const datedEntries = (tab, entries) => {
    const source = entries
      .map(
        ([title, dates]) =>
          `${tab === "experience" ? "##" : "###"} ${title}\n\n> ${dates}\n\nDescription.`,
      )
      .join("\n\n");
    return tab === "experience"
      ? parseExperience(source, "custom/experience.md")
      : parseEducation(education(source), "custom/education.md").entries;
  };

  test.each(["experience", "education"])(
    "%s sorts newest starts first, then latest ends, preserving exact ties",
    (tab) => {
      const entries = datedEntries(tab, [
        ["Older ongoing", "2021–Present"],
        ["Later end", "June 2023 - August 2024"],
        ["Earlier end", "June–July 2023"],
        ["Latest 2023 start", "July 2023"],
        ["Single month", "June 2023"],
        ["Single month tie", "June 2023"],
        ["Same start ongoing", "June 2023–Present"],
        ["Year precision", "2023"],
        ["January start", "January–June 2023"],
        ["Incoming", "Incoming · August 2028"],
        ["Shared year range", "June – August 2024"],
      ]);
      expect(entries.map((entry) => entry.title)).toEqual([
        "Incoming",
        "Shared year range",
        "Latest 2023 start",
        "Same start ongoing",
        "Later end",
        "Earlier end",
        "Single month",
        "Single month tie",
        "Year precision",
        "January start",
        "Older ongoing",
      ]);
    },
  );

  test.each([
    "Someday",
    "Smarch 2024",
    "August–June 2024",
    "2026–2022",
    "Present",
    "June–Present",
    "June–July–August 2023",
  ])("rejects unsortable or reversed dates with entry context: %s", (label) => {
    for (const tab of ["experience", "education"]) {
      expect(() => datedEntries(tab, [["Example", label]])).toThrow(
        `custom/${tab}.md [Example]: Invalid date`,
      );
    }
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
    ["## A\n\n> 2021\n\nText\n\n## a\n\n> 2022\n\nMore", "Duplicate title"],
    ["## [A](javascript:alert)\n\nText", "Heading links"],
    ["## A\n\n> 2021\n\n![Image](https://example.com/image.png)", "Unsupported image"],
    ["## A\n\n> 2021\n\n```js\nconsole.log('## Not an entry');\n```", "Unsupported code"],
  ])("reports malformed experience content: %s", (source, message) => {
    expect(() => parseExperience(source, "custom/experience.md")).toThrow("custom/experience.md");
    expect(() => parseExperience(source)).toThrow(message);
  });

  test.each([
    ["Description without dates.", "date paragraph"],
    [">", "date paragraph"],
    ["> 2021\n>\n> Extra field\n\nDescription.", "date paragraph"],
    ["> - 2021\n\nDescription.", "date paragraph"],
    ["> **2021**\n\nDescription.", "plain text"],
    ["> [2021](https://example.com)\n\nDescription.", "plain text"],
    ["> 2021", "describing this entry"],
    ["> 2021\n\nDescription.\n\n> Extra quote", "Unsupported blockquote"],
  ])("rejects invalid experience metadata: %s", (body, message) => {
    const parse = () => parseExperience(`## Example\n\n${body}`, "custom/experience.md");
    expect(parse).toThrow("custom/experience.md [Example]");
    expect(parse).toThrow(message);
  });

  test.each([
    ["", "exactly one"],
    ["### Missing group\n\nText", "Missing group"],
    [education("### School\n\nDescription without dates."), "School"],
    [education("### School\n\n> 2026\n>\n> Diploma\n>\n> Extra field\n\nText"), "blockquote"],
    [education("### School\n\n> **2026**\n\nText"), "plain text"],
    [education("### School\n\n> 2026"), "describing this entry"],
    [education(""), "Formal education"],
    [education() + "\n\n### School\n\n> 2026\n\nText", "Duplicate title"],
    [education() + "\n\n## Programs\n\n### Other\n\n> 2026\n\nText", "exactly one"],
    [education() + "\n\n## Empty group", "exactly one"],
  ])("reports malformed education content: %s", (source, message) => {
    expect(() => parseEducation(source, "custom/education.md")).toThrow("custom/education.md");
    expect(() => parseEducation(source)).toThrow(message);
  });

  test("rejects a repeated education group immediately with file and heading context", () => {
    expect(() =>
      parseEducation(education() + "\n\n## Formal education", "custom/education.md"),
    ).toThrow(
      "custom/education.md [Formal education]: Provide exactly one ## group for formal education; put programs in experience.md.",
    );
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
    expect(parseExperience(experience).map((entry) => entry.title)).toEqual([
      "ISCB Youth Bioinformatics Symposium",
      "Garcia Research Scholar Program @ Stony Brook University",
      "LaunchX Innovation Program @ University of Michigan, Ann Arbor",
      "Stanford AI4ALL @ Stanford University",
      "Mathematics & Computational Research in Biological Sciences @ University of Chicago",
      "Fundamentals of Computer Science @ Johns Hopkins CTY",
      "BuildingBloCS",
      "Hack Club",
      "IJHS & Young Achievers Leadership Academy",
    ]);
    expect(parseEducation(groups).entries.map((entry) => entry.title)).toEqual([
      "Carnegie Mellon University",
      "Stamford American International School, Singapore",
    ]);
  });
});
