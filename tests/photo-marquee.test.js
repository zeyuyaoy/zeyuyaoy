import {expect, test} from "bun:test";
import {readdir} from "node:fs/promises";
import {bottomPhotos, marqueePhotos, middlePhotos, topPhotos,} from "../src/app/components/photoMarqueeData";

test("the single marquee queue preserves every photo in top, middle, bottom order", async () => {
  for (const [row, photos, count] of [
    ["top", topPhotos, 33],
    ["middle", middlePhotos, 32],
    ["bottom", bottomPhotos, 32],
  ]) {
    expect(photos).toHaveLength(count);
    photos.forEach((src, index) => {
      const match = src.match(/^\/marquee\/(top|middle|bottom)-(\d{3})\.webp$/);
      expect(match?.[1]).toBe(row);
      expect(Number(match?.[2])).toBe(index + 1);
    });
  }

  const photos = marqueePhotos;
  expect(photos).toEqual([...topPhotos, ...middlePhotos, ...bottomPhotos]);
  expect(photos).toHaveLength(97);
  expect(new Set(photos).size).toBe(97);
  const files = await readdir(new URL("../public/marquee/", import.meta.url));
  expect(photos.toSorted()).toEqual(files.map((file) => `/marquee/${file}`).sort());
});
