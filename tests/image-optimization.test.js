import { expect, test } from "bun:test";
import { ImageOptimizerCache } from "next/dist/server/image-optimizer";
import config from "../next.config.mjs";

const request = { headers: { accept: "image/avif,image/webp" } };

test("Spotify artwork accepts the six display widths without fetching the upstream image", () => {
  for (const width of [64, 96, 128, 256, 384, 640]) {
    const result = ImageOptimizerCache.validateParams(
      request,
      { url: "https://i.scdn.co/image/cover", w: String(width), q: "75" },
      config,
      false,
    );
    expect(result.errorMessage).toBeUndefined();
    expect(result.width).toBe(width);
    expect(result.mimeType).toBe("image/webp");
    expect(result.minimumCacheTTL).toBe(2678400);
  }
});

test.each([
  "http://i.scdn.co/image/cover",
  "https://i.scdn.co:8443/image/cover",
  "https://other.scdn.co/image/cover",
  "https://i.scdn.co/other/cover",
  "https://i.scdn.co/image/cover?v=1",
])("rejects unsupported artwork sources before any upstream fetch: %s", (url) => {
  const result = ImageOptimizerCache.validateParams(
    request,
    { url, w: "64", q: "75" },
    config,
    false,
  );
  expect(result.errorMessage).toBe('"url" parameter is not allowed');
});

test.each(["/_next/static/media/profile.hash.jpg", "/_next/static/immutable/media/conan.hash.jpg"])(
  "accepts hashed profile assets: %s",
  (url) => {
    const result = ImageOptimizerCache.validateParams(
      request,
      { url, w: "384", q: "90" },
      config,
      false,
    );
    expect(result.errorMessage).toBeUndefined();
    expect(result.isStatic).toBe(true);
  },
);
