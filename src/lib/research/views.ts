import type { CollectionRecord } from "./models";
import type { PhotoSet } from "./conferenceSlides";

export type CollectionView = CollectionRecord & { photoSet?: PhotoSet };
