# Editing the profile

## Experience

```markdown
## [Organization](https://example.com/)

Describe your contribution in the first person.

Add another paragraph for a distinct contribution or outcome.
```

## Education

```markdown
## Formal education

### School

> August 2022–June 2026
>
> High School Diploma · Singapore

**Valedictorian, Class of 2026.** Unweighted GPA: 4.0/4.0.

Describe achievements and activities here.

## Summer experiences & programs

### [Program](https://example.com/)

> June–August 2024
>
> Host institution

Describe what you learned or built.
```

## Formatting and checks

- Use ordinary paragraphs separated by blank lines, `**bold**`, `*emphasis*`, inline `[links](https://example.com)`, and
  ordinary bulleted or numbered lists.
- Entry headings must be plain text or one link containing the title. Heading links use full HTTP(S) URLs. Body links
  can also use `mailto:`, `/site-relative-paths`, or `#anchors`.
- Each entry needs a description and a unique title within its tab. Education group names must also be unique.
- Avoid additional headings inside descriptions. About Me starts with a paragraph and has no headings.
- Raw HTML, JSX/MDX, images, tables, code blocks, reference-style links, and blockquotes outside education metadata are
  not supported.
- Run `bun test tests/profile-content.test.js` for content checks and `bun run check` for the full repository checks.
