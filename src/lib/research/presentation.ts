import type { ProjectSummary } from "./archive";
import type { PhotoSet } from "./conferenceSlides";
import type { PublicProject } from "./models";
import type { CollectionView } from "./views";

export type ResearchPresentation = {
  availability: "ready" | "unconfigured" | "unavailable";
  projects: { summary: ProjectSummary; detail: PublicProject; photoSet?: PhotoSet }[];
  collections: CollectionView[];
};
