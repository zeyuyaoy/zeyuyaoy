export type PhotoMarqueePhoto = `/marquee/photo-${string}.webp`;

export const marqueePhotos: readonly PhotoMarqueePhoto[] = Array.from(
  {length: 97},
  (_, index) => `/marquee/photo-${String(index + 1).padStart(3, "0")}.webp` as const,
);
