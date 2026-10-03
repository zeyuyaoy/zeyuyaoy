import { expect, test } from "bun:test";
import loadMarkdown from "../scripts/profile-markdown-loader.cjs";

test("Markdown is exported verbatim as data, including JavaScript-like text", async () => {
  const source =
    '# Heading\n\n"Quotes", \\slashes, `ticks`, ${expressions}, and Unicode 姚.\n\n<script>throw new Error("never execute")</script>\n';
  const imported = await import(
    `data:text/javascript;base64,${Buffer.from(loadMarkdown(source)).toString("base64")}`
  );
  expect(imported.default).toBe(source);
});
