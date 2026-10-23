import { projectPath } from "./paths";
import type {
  ArtifactType,
  ProjectArtifact,
  ProjectRecord,
  ProjectSource,
  PublicProject,
} from "./models";
import {
  artifactTypeLabel,
  formatResearchDate,
  researchTimestamp,
  resolveTargetType,
  toPublicProject,
} from "./models";

type ArchiveSort = "newest" | "oldest" | "title-asc" | "title-desc";
type ArchiveView = "projects" | "timeline";

export interface ArchiveState {
  query: string;
  tags: string[];
  source: "all" | ProjectSource;
  year: string | null;
  sort: ArchiveSort;
  view: ArchiveView;
}

export interface ProjectSummary {
  slug: string;
  target: string;
  targetType: ArtifactType;
  shortUrl: string;
  detailUrl: string;
  title: string;
  description: string | null;
  tags: string[];
  researchAreas: string[];
  source: ProjectSource;
  createdAt: string;
  startDate: string | null;
  endDate: string | null;
  githubRepo: string | null;
  photoSetId: string | null;
  organizations: PublicProject["organizations"];
  artifacts: ProjectArtifact[];
  searchText: string;
}

const KNOWN_PARAMS = ["q", "tag", "source", "year", "sort", "view"];

function unique(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (!value || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function parseArchiveState(searchParams: URLSearchParams): ArchiveState {
  const tags = unique(
    searchParams
      .getAll("tag")
      .flatMap((tag) => tag.split(","))
      .map((tag) => tag.trim())
      .filter(Boolean),
  );
  const source = searchParams.get("source");
  const sort = searchParams.get("sort");
  const view = searchParams.get("view");
  const year = searchParams.get("year");
  return {
    query: (searchParams.get("q") || "").trim().slice(0, 200),
    tags,
    source: source === "manual" || source === "orcid" ? source : "all",
    year: year && /^\d{4}$/.test(year) ? year : null,
    sort: sort === "oldest" || sort === "title-asc" || sort === "title-desc" ? sort : "newest",
    view: view === "timeline" ? "timeline" : "projects",
  };
}

export function archiveUrl(state: ArchiveState, current: string) {
  const url = new URL(current);
  KNOWN_PARAMS.forEach((name) => url.searchParams.delete(name));
  if (state.query.trim()) {
    url.searchParams.set("q", state.query.trim());
  }
  state.tags.forEach((tag) => url.searchParams.append("tag", tag));
  if (state.source !== "all") {
    url.searchParams.set("source", state.source);
  }
  if (state.year) {
    url.searchParams.set("year", state.year);
  }
  if (state.sort !== "newest") {
    url.searchParams.set("sort", state.sort);
  }
  if (state.view !== "projects") {
    url.searchParams.set("view", state.view);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function effectiveArtifacts(project: PublicProject): ProjectArtifact[] {
  const artifacts = [...project.artifacts];
  const urls = new Set(artifacts.flatMap((artifact) => (artifact.url ? [artifact.url] : [])));
  if (!urls.has(project.target)) {
    const type = resolveTargetType(project);
    artifacts.unshift({
      type,
      title: `Open ${artifactTypeLabel(type)}`,
      url: project.target,
      date: null,
      venue: null,
      featured: true,
    });
    urls.add(project.target);
  }
  if (project.githubRepo && !urls.has(project.githubRepo)) {
    artifacts.push({
      type: "code",
      title: "Source code",
      url: project.githubRepo,
      date: null,
      venue: "GitHub",
      featured: true,
    });
  }
  return artifacts;
}

function searchableText(project: PublicProject, artifacts: ProjectArtifact[]) {
  const values = [
    project.slug,
    project.target,
    project.title,
    project.description,
    project.longDescription,
    project.startDate,
    project.endDate,
    formatResearchDate(project.startDate),
    formatResearchDate(project.endDate),
    project.source,
    ...project.tags,
    ...project.researchAreas,
    ...project.technologies,
    ...project.methods,
    ...project.organizations.flatMap((item) => [item.name, item.role, item.url]),
    ...project.collaborators.flatMap((item) => [item.name, item.role, item.url]),
    ...artifacts.flatMap((item) => [item.type, item.title, item.url, item.date, item.venue]),
  ];
  return values
    .filter((value): value is string => Boolean(value))
    .join(" \n ")
    .normalize("NFKD")
    .toLowerCase();
}

export function toProjectSummary(project: ProjectRecord | PublicProject): ProjectSummary {
  const publicProject = "metadata" in project ? toPublicProject(project) : project;
  const artifacts = effectiveArtifacts(publicProject);
  const researchAreas = unique([...publicProject.researchAreas, ...publicProject.tags]);
  return {
    slug: publicProject.slug,
    target: publicProject.target,
    targetType: resolveTargetType(publicProject),
    shortUrl: publicProject.shortUrl,
    detailUrl: projectPath(publicProject.slug),
    title: publicProject.title,
    description: publicProject.description,
    tags: publicProject.tags,
    researchAreas,
    source: publicProject.source,
    createdAt: publicProject.createdAt,
    startDate: publicProject.startDate,
    endDate: publicProject.endDate,
    githubRepo: publicProject.githubRepo,
    photoSetId: publicProject.photoSetId,
    organizations: publicProject.organizations,
    artifacts,
    searchText: searchableText(publicProject, artifacts),
  };
}

export function filterProjects(projects: ProjectSummary[], state: ArchiveState): ProjectSummary[] {
  const terms = state.query.normalize("NFKD").toLowerCase().split(/\s+/).filter(Boolean);
  const selectedTags = state.tags.map((tag) => tag.toLowerCase());
  return projects
    .filter((project) => {
      if (state.source !== "all" && project.source !== state.source) {
        return false;
      }
      if (state.year && !projectMatchesYear(project, state.year)) {
        return false;
      }
      const areas = new Set(project.researchAreas.map((tag) => tag.toLowerCase()));
      if (selectedTags.some((tag) => !areas.has(tag))) {
        return false;
      }
      return terms.every((term) => project.searchText.includes(term));
    })
    .toSorted((a, b) => compareProjectSummaries(a, b, state.sort));
}

export function projectMatchesYear(
  project: Pick<ProjectSummary, "startDate" | "endDate">,
  year: string,
) {
  const selected = Number(year);
  if (!Number.isInteger(selected)) {
    return false;
  }
  const start = project.startDate ? Number(project.startDate.slice(0, 4)) : null;
  const end = project.endDate ? Number(project.endDate.slice(0, 4)) : null;
  if (start !== null && end !== null) {
    return selected >= Math.min(start, end) && selected <= Math.max(start, end);
  }
  return start === selected || end === selected;
}

export function searchScore(project: ProjectSummary, query: string) {
  const terms = query.normalize("NFKD").toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) {
    return 0;
  }
  const title = project.title.toLowerCase();
  const tags = project.researchAreas.map((tag) => tag.toLowerCase());
  return terms.reduce(
    (score, term) =>
      score +
      (title === term ? 12 : title.includes(term) ? 7 : 0) +
      (tags.includes(term) ? 5 : tags.some((tag) => tag.includes(term)) ? 2 : 0) +
      (project.searchText.includes(term) ? 1 : 0),
    0,
  );
}

export function compareProjectSummaries(a: ProjectSummary, b: ProjectSummary, sort: ArchiveSort) {
  if (sort === "title-asc") {
    return a.title.localeCompare(b.title);
  }
  if (sort === "title-desc") {
    return b.title.localeCompare(a.title);
  }
  const dateA = researchTimestamp(a);
  const dateB = researchTimestamp(b);
  return sort === "oldest"
    ? dateA - dateB || a.title.localeCompare(b.title)
    : dateB - dateA || a.title.localeCompare(b.title);
}

export function projectYear(project: ProjectSummary) {
  const value = project.endDate || project.startDate;
  return value?.slice(0, 4) || null;
}

export function relatedProjects(project: ProjectSummary, candidates: ProjectSummary[], limit = 3) {
  const terms = new Set(project.researchAreas.map((tag) => tag.toLowerCase()));
  return candidates
    .flatMap((candidate) => {
      if (candidate.slug === project.slug) {
        return [];
      }
      const shared = candidate.researchAreas.filter((tag) => terms.has(tag.toLowerCase()));
      return shared.length ? [{ project: candidate, score: shared.length }] : [];
    })
    .toSorted(
      (a, b) => b.score - a.score || compareProjectSummaries(a.project, b.project, "newest"),
    )
    .slice(0, limit)
    .map((entry) => entry.project);
}
