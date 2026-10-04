import type { ProfileContent, ProfileEntry, ProfileTab } from "@/lib/profile-content";

type PhotoMarqueePhoto = `/marquee/photo-${string}.webp`;
export type PhotoMarqueeQueues = Readonly<Record<ProfileTab, readonly PhotoMarqueePhoto[]>>;
type PhotoMarqueeSection = {
  id: ProfileTab;
  start: number;
  count: number;
  photos: readonly PhotoMarqueePhoto[];
};

export function createPhotoMarqueeSections(queues: PhotoMarqueeQueues): PhotoMarqueeSection[] {
  let start = 0;
  return (["about", "experience", "education"] as const).map((id) => {
    const section = { id, start, count: queues[id].length, photos: queues[id] };
    start += section.count;
    return section;
  });
}

const photoPath = (number: number): PhotoMarqueePhoto =>
  `/marquee/photo-${String(number).padStart(3, "0")}.webp`;

export const marqueePhotos: readonly PhotoMarqueePhoto[] = Array.from({ length: 104 }, (_, index) =>
  photoPath(index + 1),
);

const aboutPhotoNumbers = [
  2, 6, 7, 8, 9, 14, 17, 19, 28, 31, 35, 36, 39, 42, 47, 56, 57, 60, 62, 65, 68, 79, 81, 90, 91, 92,
  96, 97,
] as const;

const entryPhotoNumbers = {
  experience: {
    "Hack Club": [3, 25, 29, 34, 44, 59, 75],
    BuildingBloCS: [13, 54, 67, 88, 93, 95],
    "IJHS & Young Achievers Leadership Academy": [
      1, 11, 12, 16, 20, 22, 23, 24, 27, 38, 41, 48, 50, 58, 63, 70, 80, 84, 86, 89, 94,
    ],
    "Garcia Research Scholar Program @ Stony Brook University": [45, 49, 52, 53, 64, 71, 78],
    "LaunchX Innovation Program @ University of Michigan, Ann Arbor": [98, 99, 100, 101, 102],
    "Mathematics & Computational Research in Biological Sciences @ University of Chicago": [103],
    "Fundamentals of Computer Science @ Johns Hopkins CTY": [104],
  },
  education: {
    "Carnegie Mellon University": [76],
    "Stamford American International School, Singapore": [
      4, 5, 10, 15, 18, 21, 26, 30, 32, 33, 37, 40, 43, 46, 51, 55, 61, 66, 69, 72, 73, 74, 77, 82,
      83, 85, 87,
    ],
  },
} as const;

function entryPhotos(
  tab: Exclude<ProfileTab, "about">,
  entries: readonly Pick<ProfileEntry, "title">[],
): PhotoMarqueePhoto[] {
  const groups = new Map<string, readonly number[]>(Object.entries(entryPhotoNumbers[tab]));
  const titles = new Set(entries.map((entry) => entry.title));
  for (const title of groups.keys()) {
    if (!titles.has(title)) {
      throw new Error(
        `Photo marquee: "${title}" has no matching ${tab} entry. Update photoMarqueeData.ts to match the Markdown heading.`,
      );
    }
  }
  return entries.flatMap((entry) =>
    (groups.get(entry.title) ?? []).toSorted((a, b) => a - b).map(photoPath),
  );
}

export function createPhotoMarqueeQueues(
  content: Pick<ProfileContent, "experience" | "education">,
): PhotoMarqueeQueues {
  return {
    about: aboutPhotoNumbers.toSorted((a, b) => a - b).map(photoPath),
    experience: entryPhotos("experience", content.experience),
    education: entryPhotos("education", content.education.entries),
  };
}
