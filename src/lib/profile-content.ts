import type { Heading, Nodes, Paragraph, RootContent } from "mdast";
import { unified } from "unified";
import remarkParse from "remark-parse";

export type ProfileTab = "about" | "experience" | "education";

export type ProfileEntry = {
  title: string;
  href?: string;
  body: string;
};

export type ExperienceEntry = ProfileEntry & {
  dateLabel: string;
};

type EducationEntry = ProfileEntry & {
  dateLabel: string;
  subtitle?: string;
};

export type EducationGroup = {
  title: string;
  entries: EducationEntry[];
};

export type ProfileContent = {
  about: string;
  experience: ExperienceEntry[];
  education: EducationGroup;
};

const parser = unified().use(remarkParse);

function invalid(file: string, heading: string, message: string): never {
  throw new Error(`${file} [${heading}]: ${message}`);
}

function plainText(node: Heading | Paragraph, file: string, context: string): string {
  if (node.children.some((child) => child.type !== "text")) {
    invalid(file, context, "Use plain text here.");
  }
  const value = node.children
    .map((child) => (child.type === "text" ? child.value : ""))
    .join("")
    .trim();
  if (!value) {
    invalid(file, context, "Text must not be empty.");
  }
  return value;
}

function headingFields(
  node: Heading,
  file: string,
  source: string,
): Pick<ProfileEntry, "title" | "href"> {
  const context = source.slice(node.position!.start.offset!, node.position!.end.offset!);
  const first = node.children[0];
  if (node.children.length === 1 && first.type === "link") {
    const title = plainText({ ...node, children: first.children }, file, context);
    if (!/^https?:\/\//i.test(first.url)) {
      invalid(file, title, "Heading links must use an http:// or https:// URL.");
    }
    return { title, href: first.url };
  }
  return { title: plainText(node, file, context) };
}

function unique(title: string, seen: Set<string>, file: string) {
  const key = title.toLowerCase();
  if (seen.has(key)) {
    invalid(file, title, "Duplicate title; each entry or group must have a unique title.");
  }
  seen.add(key);
}

const months = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

function dateRange(label: string, file: string, heading: string) {
  const parts = label.replace(/^Incoming\s*·\s*/i, "").split(/\s*[-–—]\s*/);
  const invalidDate = (): never =>
    invalid(
      file,
      heading,
      `Invalid date "${label}"; use a year or Month Year, optionally a range ending in another date or Present.`,
    );
  if (parts.length > 2) {
    invalidDate();
  }
  const endLabel = parts[1] ?? parts[0];
  const startLabel =
    parts.length === 2 && /^[a-z]+$/i.test(parts[0])
      ? `${parts[0]} ${endLabel.match(/\d{4}$/)?.[0] ?? ""}`
      : parts[0];

  function dateValue(value: string, isEnd: boolean): number {
    if (isEnd && parts.length === 2 && /^Present$/i.test(value)) {
      return Infinity;
    }
    const match = value.match(/^(?:([a-z]+)\s+)?(\d{4})$/i);
    if (!match) {
      return invalidDate();
    }
    const month = match[1] ? months.indexOf(match[1].toLowerCase()) : isEnd ? 11 : 0;
    if (month < 0) {
      return invalidDate();
    }
    return Number(match[2]) * 12 + month;
  }

  const start = dateValue(startLabel, false);
  const end = dateValue(endLabel, true);
  if (end < start) {
    invalid(file, heading, `Invalid date "${label}"; the end must not precede the start.`);
  }
  return { start, end };
}

function sortDatedEntries<T extends { title: string; dateLabel: string }>(
  entries: readonly T[],
  file: string,
): T[] {
  return entries
    .map((entry) => ({ entry, ...dateRange(entry.dateLabel, file, entry.title) }))
    .toSorted((a, b) => b.start - a.start || (a.end === b.end ? 0 : a.end > b.end ? -1 : 1))
    .map(({ entry }) => entry);
}

const bodyTypes = new Set([
  "paragraph",
  "text",
  "strong",
  "emphasis",
  "link",
  "list",
  "listItem",
  "break",
]);

function validateBody(node: Nodes, file: string, heading: string) {
  if (!bodyTypes.has(node.type)) {
    invalid(
      file,
      heading,
      `Unsupported ${node.type}; use paragraphs, inline links, emphasis, or lists.`,
    );
  }
  if (node.type === "link" && !/^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(node.url)) {
    invalid(file, heading, "Links must use http(s), mailto, a site-relative path, or an anchor.");
  }
  if ("children" in node) {
    for (const child of node.children) {
      validateBody(child, file, heading);
    }
  }
}

function bodyMarkdown(nodes: RootContent[], source: string, file: string, heading: string) {
  if (nodes.length === 0) {
    invalid(file, heading, "Add at least one paragraph or list describing this entry.");
  }
  for (const node of nodes) {
    validateBody(node, file, heading);
  }
  return source
    .slice(nodes[0].position!.start.offset!, nodes[nodes.length - 1].position!.end.offset!)
    .trim();
}

export function parseAbout(source: string, file = "about.md"): string {
  const nodes = parser.parse(source).children;
  if (nodes[0]?.type !== "paragraph") {
    invalid(file, "About Me", "Begin with a nonempty introductory paragraph.");
  }
  return bodyMarkdown(nodes, source, file, "About Me");
}

export function parseExperience(source: string, file = "experience.md"): ExperienceEntry[] {
  const entries: ExperienceEntry[] = [];
  const seen = new Set<string>();
  let current: Pick<ProfileEntry, "title" | "href"> | undefined;
  let body: RootContent[] = [];
  function finishEntry() {
    if (current) {
      const [metadata, ...description] = body;
      if (
        metadata?.type !== "blockquote" ||
        metadata.children.length !== 1 ||
        metadata.children[0].type !== "paragraph"
      ) {
        invalid(
          file,
          current.title,
          "Start with a blockquote containing one plain-text date paragraph.",
        );
      }
      entries.push({
        ...current,
        dateLabel: plainText(metadata.children[0], file, current.title),
        body: bodyMarkdown(description, source, file, current.title),
      });
    }
    body = [];
  }
  for (const node of parser.parse(source).children) {
    if (node.type === "heading") {
      if (node.depth !== 2) {
        invalid(
          file,
          headingFields(node, file, source).title,
          "Experience entries must start with ## headings.",
        );
      }
      finishEntry();
      current = headingFields(node, file, source);
      unique(current.title, seen, file);
    } else if (!current) {
      invalid(file, "Experience", "Place content beneath a ## entry heading.");
    } else {
      body.push(node);
    }
  }
  finishEntry();
  if (!entries.length) {
    invalid(file, "Experience", "Add at least one ## entry.");
  }
  return sortDatedEntries(entries, file);
}

export function parseEducation(source: string, file = "education.md"): EducationGroup {
  const seenEntries = new Set<string>();
  let group: EducationGroup | undefined;
  let current: Pick<ProfileEntry, "title" | "href"> | undefined;
  let body: RootContent[] = [];
  function finishEntry() {
    if (!current || !group) {
      return;
    }
    const [metadata, ...description] = body;
    if (
      metadata?.type !== "blockquote" ||
      metadata.children.length < 1 ||
      metadata.children.length > 2 ||
      metadata.children.some((node) => node.type !== "paragraph")
    ) {
      invalid(
        file,
        current.title,
        "Start with a blockquote containing a date paragraph and an optional subtitle paragraph.",
      );
    }
    const dateLabel = plainText(metadata.children[0] as Paragraph, file, current.title);
    const subtitle = metadata.children[1]
      ? plainText(metadata.children[1] as Paragraph, file, current.title)
      : undefined;
    group.entries.push({
      ...current,
      dateLabel,
      subtitle,
      body: bodyMarkdown(description, source, file, current.title),
    });
    current = undefined;
    body = [];
  }
  for (const node of parser.parse(source).children) {
    if (node.type === "heading") {
      finishEntry();
      const fields = headingFields(node, file, source);
      if (node.depth === 2) {
        if (fields.href) {
          invalid(file, fields.title, "Timeline group headings must be plain text.");
        }
        if (group) {
          invalid(
            file,
            fields.title,
            "Provide exactly one ## group for formal education; put programs in experience.md.",
          );
        }
        group = { title: fields.title, entries: [] };
      } else if (node.depth === 3 && group) {
        unique(fields.title, seenEntries, file);
        current = fields;
      } else {
        invalid(file, fields.title, "Use ## for timeline groups, followed by ### entry headings.");
      }
    } else if (!current) {
      invalid(file, group?.title ?? "Education", "Place entry content beneath a ### heading.");
    } else {
      body.push(node);
    }
  }
  finishEntry();
  if (!group) {
    invalid(
      file,
      "Education",
      "Provide exactly one ## group for formal education; put programs in experience.md.",
    );
  }
  if (!group.entries.length) {
    invalid(file, group.title, "Add at least one ### entry to this timeline.");
  }
  return { ...group, entries: sortDatedEntries(group.entries, file) };
}
