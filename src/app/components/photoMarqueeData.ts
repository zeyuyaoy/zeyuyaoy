export type PhotoMarqueeRowName = "top" | "middle" | "bottom";
export type PhotoMarqueePhoto = `/marquee/${PhotoMarqueeRowName}-${string}.webp`;

function photos(row: PhotoMarqueeRowName, count: number): readonly PhotoMarqueePhoto[] {
    return Array.from({length: count}, (_, index) =>
        `/marquee/${row}-${String(index + 1).padStart(3, "0")}.webp` as const);
}

export const topPhotos = photos("top", 33);
export const middlePhotos = photos("middle", 32);
export const bottomPhotos = photos("bottom", 32);
