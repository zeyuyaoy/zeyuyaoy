import {expect, test} from "bun:test";
import {readdir} from "node:fs/promises";
import {marqueePhotos} from "../src/app/components/photoMarqueeData";

test("the single marquee queue contains all 97 sequentially numbered photos", async () => {
  expect(marqueePhotos).toHaveLength(97);
  marqueePhotos.forEach((src, index) => {
    const match = src.match(/^\/marquee\/photo-(\d{3})\.webp$/);
    expect(Number(match?.[1])).toBe(index + 1);
  });
  const files = await readdir(new URL("../public/marquee/", import.meta.url));
  expect(marqueePhotos.toSorted()).toEqual(files.map((file) => `/marquee/${file}`).sort());
});
