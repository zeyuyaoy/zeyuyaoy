import { expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import {
  createPhotoMarqueeQueues,
  createPhotoMarqueeSections,
  marqueePhotos,
} from "../src/app/components/photoMarqueeData";
import { parseEducation, parseExperience } from "../src/lib/profile-content";

const [experience, education] = await Promise.all(
  ["experience", "education"].map((name) =>
    readFile(new URL(`../src/content/profile/${name}.md`, import.meta.url), "utf8"),
  ),
);
const content = {
  experience: parseExperience(experience),
  education: parseEducation(education),
};
const paths = (numbers) =>
  numbers.map((number) => `/marquee/photo-${String(number).padStart(3, "0")}.webp`);

const expectedAbout = [
  2, 6, 7, 8, 9, 14, 17, 19, 28, 31, 35, 36, 39, 42, 47, 56, 57, 60, 62, 65, 68, 79, 81, 90, 91, 92,
  96, 97,
];
const expectedExperienceGroups = [
  [45, 49, 52, 53, 64, 71, 78],
  [98, 99, 100, 101, 102],
  [103],
  [104],
  [13, 54, 67, 88, 93, 95],
  [3, 25, 29, 34, 44, 59, 75],
  [1, 11, 12, 16, 20, 22, 23, 24, 27, 38, 41, 48, 50, 58, 63, 70, 80, 84, 86, 89, 94],
];
const expectedEducationGroups = [
  [76],
  [
    4, 5, 10, 15, 18, 21, 26, 30, 32, 33, 37, 40, 43, 46, 51, 55, 61, 66, 69, 72, 73, 74, 77, 82,
    83, 85, 87,
  ],
];

test("the complete catalog retains all 104 sequentially numbered photos and console links", async () => {
  expect(marqueePhotos).toHaveLength(104);
  marqueePhotos.forEach((src, index) => {
    const match = src.match(/^\/marquee\/photo-(\d{3})\.webp$/);
    expect(Number(match?.[1])).toBe(index + 1);
  });
  const files = await readdir(new URL("../public/marquee/", import.meta.url));
  expect(marqueePhotos.toSorted()).toEqual(files.map((file) => `/marquee/${file}`).sort());
});

test("tab queues follow the date-sorted profile entries, including the IJHS and Stamford aliases", () => {
  expect(createPhotoMarqueeQueues(content)).toEqual({
    about: paths(expectedAbout),
    experience: paths(expectedExperienceGroups.flat()),
    education: paths(expectedEducationGroups.flat()),
  });
});

test("the three queues partition all 104 assets without omissions, repetitions, or cross-tab photos", () => {
  const queues = createPhotoMarqueeQueues(content);
  expect(
    Object.fromEntries(Object.entries(queues).map(([tab, photos]) => [tab, photos.length])),
  ).toEqual({
    about: 28,
    experience: 48,
    education: 28,
  });
  const photos = Object.values(queues).flat();
  expect(new Set(photos).size).toBe(104);
  expect(photos.toSorted()).toEqual(marqueePhotos);
});

test("permanent section boundaries follow About, Experience, Education and their actual counts", () => {
  const queues = createPhotoMarqueeQueues(content);
  const sections = createPhotoMarqueeSections(queues);
  expect(sections.map(({ id, start, count }) => ({ id, start, count }))).toEqual([
    { id: "about", start: 0, count: 28 },
    { id: "experience", start: 28, count: 48 },
    { id: "education", start: 76, count: 28 },
  ]);
  expect(sections.flatMap(({ photos }) => photos)).toEqual([
    ...paths(expectedAbout),
    ...paths(expectedExperienceGroups.flat()),
    ...paths(expectedEducationGroups.flat()),
  ]);
  expect(createPhotoMarqueeSections({ ...queues, about: queues.about.slice(1) })[2].start).toBe(75);
});

test("the marquee follows its supplied entry order while retaining numeric order inside each group", () => {
  const queues = createPhotoMarqueeQueues({
    experience: content.experience.toReversed(),
    education: { ...content.education, entries: content.education.entries.toReversed() },
  });
  expect(queues.about).toEqual(paths(expectedAbout));
  expect(queues.experience).toEqual(paths(expectedExperienceGroups.toReversed().flat()));
  expect(queues.education).toEqual(paths(expectedEducationGroups.toReversed().flat()));
});

test("entries without assigned photos contribute no images to their tab", () => {
  const queues = createPhotoMarqueeQueues(content);
  expect(
    createPhotoMarqueeQueues({
      ...content,
      experience: [
        { ...content.experience[0], title: "New experience without photos" },
        ...content.experience,
        { ...content.experience[0], title: "constructor" },
      ],
    }),
  ).toEqual(queues);
});

test("renaming or removing a mapped entry reports orphaned photos instead of silently dropping them", () => {
  expect(() =>
    createPhotoMarqueeQueues({
      ...content,
      experience: content.experience.map((entry) =>
        entry.title === "Hack Club" ? { ...entry, title: "Renamed Hack Club" } : entry,
      ),
    }),
  ).toThrow('"Hack Club" has no matching experience entry');
  expect(() =>
    createPhotoMarqueeQueues({
      ...content,
      education: { ...content.education, entries: content.education.entries.slice(1) },
    }),
  ).toThrow('"Carnegie Mellon University" has no matching education entry');
});
