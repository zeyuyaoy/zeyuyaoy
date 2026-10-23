import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import assets from "./fixtures/research/assets.json";
import config from "../next.config.mjs";
import { ImageOptimizerCache } from "next/dist/server/image-optimizer";

test("all seven research assets retain their original bytes", async () => {
  expect(Object.keys(assets)).toHaveLength(7);
  for (const [file, expected] of Object.entries(assets)) {
    const bytes = await readFile(new URL(`../public/research/${file}`, import.meta.url));
    expect(bytes.length).toBe(expected.bytes);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(expected.sha256);
  }
});

test.each(["/research/biorsp/bcb.jpeg", "/research/pet.png"])(
  "research images are allowed at gallery widths: %s",
  (url) => {
    for (const width of [960, 1440]) {
      expect(
        ImageOptimizerCache.validateParams(
          { headers: {} },
          { url, w: String(width), q: "75" },
          config,
          false,
        ).errorMessage,
      ).toBeUndefined();
    }
  },
);

test.each([
  "/research/secret.png",
  "/research/pet.png?source=elsewhere",
  "https://example.org/photo.jpg",
])("research does not broaden image access to %s", (url) => {
  expect(
    ImageOptimizerCache.validateParams({ headers: {} }, { url, w: "960", q: "75" }, config, false)
      .errorMessage,
  ).toBe('"url" parameter is not allowed');
});
