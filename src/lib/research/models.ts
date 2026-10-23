import { shortPath } from "./paths";

export type ProjectSource = "manual" | "orcid";

export const ARTIFACT_TYPES = [
  "publication",
  "preprint",
  "poster",
  "talk",
  "presentation",
  "award",
  "code",
  "dataset",
  "video",
  "file",
  "website",
  "other",
] as const;

export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

export interface NamedEntity {
  name: string;
  role: string | null;
  url: string | null;
}

export interface ProjectArtifact {
  type: ArtifactType;
  title: string;
  url: string | null;
  date: string | null;
  venue: string | null;
  featured: boolean;
}

interface ProjectMetadata {
  targetType: ArtifactType | null;
  permanent: boolean;
  title: string;
  description: string | null;
  longDescription: string | null;
  tags: string[];
  researchAreas: string[];
  technologies: string[];
  methods: string[];
  organizations: NamedEntity[];
  collaborators: NamedEntity[];
  artifacts: ProjectArtifact[];
  createdAt: string;
  updatedAt: string | null;
  startDate: string | null;
  endDate: string | null;
  githubRepo: string | null;
  photoSetId: string | null;
}

export interface ProjectRecord {
  slug: string;
  target: string;
  clicks: number;
  source: ProjectSource;
  metadata: ProjectMetadata;
}

export interface PublicProject {
  slug: string;
  target: string;
  targetType: ArtifactType;
  shortUrl: string;
  title: string;
  description: string | null;
  longDescription: string | null;
  tags: string[];
  researchAreas: string[];
  technologies: string[];
  methods: string[];
  organizations: NamedEntity[];
  collaborators: NamedEntity[];
  artifacts: ProjectArtifact[];
  source: ProjectSource;
  createdAt: string;
  updatedAt: string | null;
  startDate: string | null;
  endDate: string | null;
  githubRepo: string | null;
  photoSetId: string | null;
}

export interface CollectionRecord {
  id: string;
  name: string;
  description: string;
  projects: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string | null;
}

export interface AnalyticsSummary {
  totalLinks: number;
  totalClicks: number;
  averageClicks: number;
  uniqueTags: number;
  sources: Record<ProjectSource, number>;
  topProjects: Array<{ slug: string; title: string; clicks: number }>;
  topTags: Array<{ tag: string; projects: number }>;
  tagDistribution: Record<string, number>;
  generatedAt: string;
}

interface ProjectInput {
  slug: string;
  target?: string;
  targetType?: ArtifactType | null;
  permanent?: boolean;
  title?: string;
  description?: string;
  longDescription?: string;
  tags?: string[];
  researchAreas?: string[];
  technologies?: string[];
  methods?: string[];
  organizations?: NamedEntity[];
  collaborators?: NamedEntity[];
  artifacts?: ProjectArtifact[];
  startDate?: string;
  endDate?: string;
  githubRepo?: string;
  photoSetId?: string;
}

interface CollectionInput {
  id: string;
  name?: string;
  description?: string;
  projects?: string[];
  tags?: string[];
}

type ValidationResult<T> = { success: true; data: T } | { success: false; error: string };

const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const DATE_PATTERN = /^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/;
const ARTIFACT_TYPE_SET = new Set<string>(ARTIFACT_TYPES);

function parseArtifactType(value: unknown): ArtifactType | null {
  return typeof value === "string" && ARTIFACT_TYPE_SET.has(value) ? (value as ArtifactType) : null;
}

export function artifactTypeLabel(type: ArtifactType): string {
  if (type === "code") {
    return "source code";
  }
  if (type === "other") {
    return "resource";
  }
  return type;
}

export function resolveTargetType(project: {
  target: string;
  targetType?: ArtifactType | null;
  artifacts: ProjectArtifact[];
}): ArtifactType {
  if (project.targetType) {
    return project.targetType;
  }
  const target = project.target;
  const matching = project.artifacts.find((artifact) => artifact.url === target);
  if (matching) {
    return matching.type;
  }
  try {
    const { hostname, pathname } = new URL(target);
    const onHost = (host: string) => hostname === host || hostname.endsWith(`.${host}`);
    if (
      onHost("youtube.com") ||
      hostname === "youtu.be" ||
      /\.(mp4|webm|mov|m4v|ogv)$/i.test(pathname)
    ) {
      return "video";
    }
    if (onHost("doi.org")) {
      return "publication";
    }
    if (
      (hostname === "drive.google.com" && pathname.startsWith("/file/d/")) ||
      (hostname === "docs.google.com" &&
        /^\/(document|spreadsheets|presentation|drawings)\/d\//.test(pathname)) ||
      /\.(pdf|docx?|xlsx?|pptx?|odt|ods|odp|rtf|txt|csv|tsv|json|xml|zip|tar|gz|7z|png|jpe?g|gif|webp|svg|mp3|wav|ogg)$/i.test(
        pathname,
      )
    ) {
      return "file";
    }
    if (hostname === "github.com" && /^\/[^/]+\/[^/]+/.test(pathname)) {
      return "code";
    }
  } catch {}
  return "website";
}

export function normalizeSlug(value: string): string {
  return value.trim().replace(/^\/+/, "").toLowerCase();
}

export function isValidSlug(value: string): boolean {
  return value.length <= 120 && SLUG_PATTERN.test(value);
}

export function normalizeTags(value: unknown): string[] {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return Array.from(
    new Set(
      values
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0 && tag.length <= 80),
    ),
  );
}

function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeNamedEntities(value: unknown): NamedEntity[] {
  const seen = new Set<string>();
  return parseJsonArray(value).flatMap((item): NamedEntity[] => {
    if (typeof item === "string") {
      const name = item.trim().slice(0, 240);
      const key = name.toLowerCase();
      if (!name || seen.has(key)) {
        return [];
      }
      seen.add(key);
      return [{ name, role: null, url: null }];
    }
    if (!item || typeof item !== "object") {
      return [];
    }
    const raw = item as Record<string, unknown>;
    const name = optionalString(raw.name, 240);
    const role = optionalString(raw.role, 240) || null;
    const url = optionalString(raw.url, 2048) || null;
    const key = name?.toLowerCase() || "";
    if (!name || seen.has(key) || (url && !isHttpUrl(url))) {
      return [];
    }
    seen.add(key);
    return [{ name, role, url }];
  });
}

function normalizeArtifacts(value: unknown): ProjectArtifact[] {
  return parseJsonArray(value).flatMap((item): ProjectArtifact[] => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const raw = item as Record<string, unknown>;
    const type =
      typeof raw.type === "string" && ARTIFACT_TYPE_SET.has(raw.type)
        ? (raw.type as ArtifactType)
        : "other";
    const title = optionalString(raw.title, 240);
    const url = optionalString(raw.url, 2048) || null;
    const date = optionalString(raw.date, 10) || null;
    const venue = optionalString(raw.venue, 240) || null;
    if (!title || (url && !isHttpUrl(url)) || (date && !isValidDate(date))) {
      return [];
    }
    return [{ type, title, url, date, venue, featured: raw.featured === true }];
  });
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  if (value.length === 10) {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }
  return true;
}

function optionalString(value: unknown, maxLength: number): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  return value.trim().slice(0, maxLength);
}

export function validateProjectInput(
  value: unknown,
  requireTarget: boolean,
): ValidationResult<ProjectInput> {
  if (!value || typeof value !== "object") {
    return { success: false, error: "project must be an object" };
  }
  const raw = value as Record<string, unknown>;
  if (typeof raw.slug !== "string") {
    return { success: false, error: "slug is required" };
  }
  const slug = normalizeSlug(raw.slug);
  if (!isValidSlug(slug)) {
    return {
      success: false,
      error: "slug must contain only letters, numbers, hyphens, and underscores",
    };
  }

  const target = optionalString(raw.target, 2048);
  if (requireTarget && !target) {
    return { success: false, error: "target is required" };
  }
  if (target !== undefined && !isHttpUrl(target)) {
    return {
      success: false,
      error: "target must be a valid HTTP(S) URL",
    };
  }
  const targetType = raw.targetType === undefined ? undefined : parseArtifactType(raw.targetType);
  if (raw.targetType !== undefined && raw.targetType !== null && targetType === null) {
    return {
      success: false,
      error: `targetType must be null or one of: ${ARTIFACT_TYPES.join(", ")}`,
    };
  }
  const githubRepo = optionalString(raw.githubRepo, 2048);
  if (githubRepo && !isHttpUrl(githubRepo)) {
    return { success: false, error: "githubRepo must be a valid HTTP(S) URL" };
  }
  const startDate = optionalString(raw.startDate, 10);
  const endDate = optionalString(raw.endDate, 10);
  if (startDate && !isValidDate(startDate)) {
    return {
      success: false,
      error: "startDate must use YYYY, YYYY-MM, or YYYY-MM-DD",
    };
  }
  if (endDate && !isValidDate(endDate)) {
    return {
      success: false,
      error: "endDate must use YYYY, YYYY-MM, or YYYY-MM-DD",
    };
  }
  if (raw.permanent !== undefined && typeof raw.permanent !== "boolean") {
    return {
      success: false,
      error: "permanent must be a boolean",
    };
  }

  return {
    success: true,
    data: {
      slug,
      target,
      targetType,
      permanent: raw.permanent as boolean | undefined,
      title: optionalString(raw.title, 240),
      description: optionalString(raw.description, 4000),
      longDescription: optionalString(raw.longDescription, 20_000),
      tags: raw.tags === undefined ? undefined : normalizeTags(raw.tags),
      researchAreas: raw.researchAreas === undefined ? undefined : normalizeTags(raw.researchAreas),
      technologies: raw.technologies === undefined ? undefined : normalizeTags(raw.technologies),
      methods: raw.methods === undefined ? undefined : normalizeTags(raw.methods),
      organizations:
        raw.organizations === undefined ? undefined : normalizeNamedEntities(raw.organizations),
      collaborators:
        raw.collaborators === undefined ? undefined : normalizeNamedEntities(raw.collaborators),
      artifacts: raw.artifacts === undefined ? undefined : normalizeArtifacts(raw.artifacts),
      startDate,
      endDate,
      githubRepo,
      photoSetId: optionalString(raw.photoSetId, 120),
    },
  };
}

export function validateCollectionInput(
  value: unknown,
  requireName: boolean,
): ValidationResult<CollectionInput> {
  if (!value || typeof value !== "object") {
    return { success: false, error: "collection must be an object" };
  }
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string") {
    return { success: false, error: "id is required" };
  }
  const id = normalizeSlug(raw.id);
  if (!isValidSlug(id)) {
    return {
      success: false,
      error: "id must contain only letters, numbers, hyphens, and underscores",
    };
  }
  const name = optionalString(raw.name, 240);
  if (requireName && !name) {
    return { success: false, error: "name is required" };
  }
  const projects =
    raw.projects === undefined ? undefined : normalizeTags(raw.projects).map(normalizeSlug);
  if (projects?.some((project) => !isValidSlug(project))) {
    return {
      success: false,
      error: "projects contains an invalid slug",
    };
  }
  return {
    success: true,
    data: {
      id,
      name,
      description: optionalString(raw.description, 4000),
      projects,
      tags: raw.tags === undefined ? undefined : normalizeTags(raw.tags),
    },
  };
}

export function parseMetadata(slug: string, meta: Record<string, string>): ProjectMetadata {
  return {
    targetType: parseArtifactType(meta.targetType),
    permanent: meta.permanent === "1",
    title: meta.title?.trim() || slug,
    description: meta.description?.trim() || null,
    longDescription: meta.longDescription?.trim() || null,
    tags: normalizeTags(meta.tags),
    researchAreas: normalizeTags(parseJsonArray(meta.researchAreas)),
    technologies: normalizeTags(parseJsonArray(meta.technologies)),
    methods: normalizeTags(parseJsonArray(meta.methods)),
    organizations: normalizeNamedEntities(meta.organizations),
    collaborators: normalizeNamedEntities(meta.collaborators),
    artifacts: normalizeArtifacts(meta.artifacts),
    createdAt: meta.createdAt || new Date(0).toISOString(),
    updatedAt: meta.updatedAt || null,
    startDate: meta.startDate || null,
    endDate: meta.endDate || null,
    githubRepo: meta.githubRepo || null,
    photoSetId: meta.photoSetId || null,
  };
}

export function serializeProjectMetadata(
  input: ProjectInput,
  existing?: Record<string, string>,
): Record<string, string> {
  const now = new Date().toISOString();
  return {
    targetType:
      input.targetType === undefined ? existing?.targetType || "" : input.targetType || "",
    permanent:
      input.permanent === undefined ? existing?.permanent || "0" : input.permanent ? "1" : "0",
    title: input.title === undefined ? existing?.title || input.slug : input.title || input.slug,
    description: input.description === undefined ? existing?.description || "" : input.description,
    longDescription:
      input.longDescription === undefined ? existing?.longDescription || "" : input.longDescription,
    tags: input.tags === undefined ? existing?.tags || "" : input.tags.join(","),
    researchAreas:
      input.researchAreas === undefined
        ? existing?.researchAreas || "[]"
        : JSON.stringify(input.researchAreas),
    technologies:
      input.technologies === undefined
        ? existing?.technologies || "[]"
        : JSON.stringify(input.technologies),
    methods:
      input.methods === undefined ? existing?.methods || "[]" : JSON.stringify(input.methods),
    organizations:
      input.organizations === undefined
        ? existing?.organizations || "[]"
        : JSON.stringify(input.organizations),
    collaborators:
      input.collaborators === undefined
        ? existing?.collaborators || "[]"
        : JSON.stringify(input.collaborators),
    artifacts:
      input.artifacts === undefined ? existing?.artifacts || "[]" : JSON.stringify(input.artifacts),
    startDate: input.startDate === undefined ? existing?.startDate || "" : input.startDate,
    endDate: input.endDate === undefined ? existing?.endDate || "" : input.endDate,
    githubRepo: input.githubRepo === undefined ? existing?.githubRepo || "" : input.githubRepo,
    photoSetId: input.photoSetId === undefined ? existing?.photoSetId || "" : input.photoSetId,
    createdAt: existing?.createdAt || now,
    updatedAt: existing ? now : "",
  };
}

export function parseCollection(id: string, data: Record<string, string>): CollectionRecord {
  return {
    id,
    name: data.name || id,
    description: data.description || "",
    projects: normalizeTags(data.projects).map(normalizeSlug),
    tags: normalizeTags(data.tags),
    createdAt: data.createdAt || new Date(0).toISOString(),
    updatedAt: data.updatedAt || null,
  };
}

export function projectSource(slug: string): ProjectSource {
  return slug.startsWith("orcid-") ? "orcid" : "manual";
}

export function toPublicProject(project: ProjectRecord): PublicProject {
  return {
    slug: project.slug,
    target: project.target,
    targetType: resolveTargetType({
      target: project.target,
      targetType: project.metadata.targetType,
      artifacts: project.metadata.artifacts,
    }),
    shortUrl: shortPath(project.slug),
    title: project.metadata.title,
    description: project.metadata.description,
    longDescription: project.metadata.longDescription,
    tags: project.metadata.tags,
    researchAreas: project.metadata.researchAreas,
    technologies: project.metadata.technologies,
    methods: project.metadata.methods,
    organizations: project.metadata.organizations,
    collaborators: project.metadata.collaborators,
    artifacts: project.metadata.artifacts,
    source: project.source,
    createdAt: project.metadata.createdAt,
    updatedAt: project.metadata.updatedAt,
    startDate: project.metadata.startDate,
    endDate: project.metadata.endDate,
    githubRepo: project.metadata.githubRepo,
    photoSetId: project.metadata.photoSetId,
  };
}

export function parsePagination(
  searchParams: URLSearchParams,
  defaults: {
    limit: number;
    max: number;
  },
): ValidationResult<{ limit: number; offset: number }> {
  const rawLimit = searchParams.get("limit");
  const rawOffset = searchParams.get("offset");
  const limit = rawLimit === null ? defaults.limit : Number(rawLimit);
  const offset = rawOffset === null ? 0 : Number(rawOffset);
  if (!Number.isInteger(limit) || limit < 1 || limit > defaults.max) {
    return {
      success: false,
      error: `limit must be an integer from 1 to ${defaults.max}`,
    };
  }
  if (!Number.isInteger(offset) || offset < 0) {
    return {
      success: false,
      error: "offset must be a non-negative integer",
    };
  }
  return { success: true, data: { limit, offset } };
}

export function formatResearchDate(value: string | null | undefined): string | null {
  if (!value || !isValidDate(value)) {
    return null;
  }
  if (value.length === 4) {
    return value;
  }
  const [year, month] = value.split("-");
  const label = new Intl.DateTimeFormat("en", {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${year}-${month}-01T00:00:00Z`));
  return `${label} ${year}`;
}

export function formatResearchDateRange(startDate: string | null, endDate: string | null) {
  const start = formatResearchDate(startDate);
  const end = formatResearchDate(endDate);
  return start && end && start !== end ? `${start}–${end}` : start || end;
}

export function researchTimestamp(
  project: Pick<ProjectMetadata, "startDate" | "endDate" | "createdAt">,
): number {
  const value = project.endDate || project.startDate || project.createdAt;
  const normalized =
    value.length === 4 ? `${value}-01-01` : value.length === 7 ? `${value}-01` : value;
  const timestamp = Date.parse(normalized);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}
