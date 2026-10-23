"use client";

import styles from "./Admin.module.css";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  type AnalyticsSummary,
  ARTIFACT_TYPES,
  type ArtifactType,
  artifactTypeLabel,
  type CollectionRecord,
  type NamedEntity,
  type ProjectArtifact,
  type ProjectRecord,
} from "@/lib/research/models";

type Tab = "projects" | "collections" | "analytics";
type ProjectForm = {
  slug: string;
  target: string;
  targetType: ArtifactType | null;
  title: string;
  description: string;
  longDescription: string;
  tags: string;
  researchAreas: string[];
  technologies: string[];
  methods: string[];
  organizations: NamedEntity[];
  collaborators: NamedEntity[];
  artifacts: ProjectArtifact[];
  permanent: boolean;
  startDate: string;
  endDate: string;
  githubRepo: string;
  photoSetId: string;
};
type CollectionForm = {
  id: string;
  name: string;
  description: string;
  tags: string;
  projects: string[];
};

const EMPTY_PROJECT: ProjectForm = {
  slug: "",
  target: "",
  targetType: null,
  title: "",
  description: "",
  longDescription: "",
  tags: "",
  researchAreas: [],
  technologies: [],
  methods: [],
  organizations: [],
  collaborators: [],
  artifacts: [],
  permanent: false,
  startDate: "",
  endDate: "",
  githubRepo: "",
  photoSetId: "",
};
const EMPTY_COLLECTION: CollectionForm = {
  id: "",
  name: "",
  description: "",
  tags: "",
  projects: [],
};

function readAdminKey() {
  try {
    return sessionStorage.getItem("adminKey") || "";
  } catch {
    return "";
  }
}

function storeAdminKey(value: string) {
  try {
    sessionStorage.setItem("adminKey", value);
  } catch {}
}

function removeAdminKey() {
  try {
    sessionStorage.removeItem("adminKey");
  } catch {}
}

async function responseError(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    details?: unknown;
  };
  return payload.error || `Request failed with status ${response.status}`;
}

function TextField({
  label,
  value,
  onChange,
  required,
  type = "text",
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className={styles.field}>
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      <input
        type={type}
        required={required}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={styles.fieldInput}
        style={{ backgroundColor: "var(--input-bg)", borderColor: "var(--input-border)" }}
      />
    </label>
  );
}

function ListEditor({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  return (
    <fieldset className={styles.editorBox} style={{ borderColor: "var(--card-border)" }}>
      <legend className={styles.legend}>{label}</legend>
      {values.map((value, index) => (
        <div key={index} className={styles.actions}>
          <label className={styles.screenReader} htmlFor={`${label}-${index}`}>
            {label} {index + 1}
          </label>
          <input
            id={`${label}-${index}`}
            value={value}
            onChange={(event) =>
              onChange(
                values.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)),
              )
            }
            placeholder={placeholder}
            className={styles.truncateInput}
            style={{
              backgroundColor: "var(--input-bg)",
              borderColor: "var(--input-border)",
            }}
          />
          <button
            type="button"
            aria-label={`Remove ${label.toLowerCase()} ${index + 1}`}
            onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}
            className={styles.borderButton}
          >
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...values, ""])} className={styles.addButton}>
        Add {label.toLowerCase().replace(/s$/, "")}
      </button>
    </fieldset>
  );
}

function EntityEditor({
  label,
  values,
  onChange,
}: {
  label: string;
  values: NamedEntity[];
  onChange: (values: NamedEntity[]) => void;
}) {
  const update = (index: number, patch: Partial<NamedEntity>) =>
    onChange(values.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  return (
    <fieldset className={styles.editorSection} style={{ borderColor: "var(--card-border)" }}>
      <legend className={styles.legend}>{label}</legend>
      {values.map((item, index) => (
        <div
          key={index}
          className={styles.editorTriple}
          style={{ borderColor: "var(--card-border)" }}
        >
          <TextField label="Name" value={item.name} onChange={(name) => update(index, { name })} />
          <TextField
            label="Role"
            value={item.role || ""}
            onChange={(role) => update(index, { role: role || null })}
          />
          <TextField
            label="URL"
            type="url"
            value={item.url || ""}
            onChange={(url) => update(index, { url: url || null })}
          />
          <button
            type="button"
            aria-label={`Remove ${label.toLowerCase()} entry ${index + 1}`}
            onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}
            className={styles.smallButton}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...values, { name: "", role: null, url: null }])}
        className={styles.addButton}
      >
        Add {label.toLowerCase().replace(/s$/, "")}
      </button>
    </fieldset>
  );
}

function ArtifactEditor({
  values,
  onChange,
}: {
  values: ProjectArtifact[];
  onChange: (values: ProjectArtifact[]) => void;
}) {
  const update = (index: number, patch: Partial<ProjectArtifact>) =>
    onChange(values.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  return (
    <fieldset className={styles.editorSection} style={{ borderColor: "var(--card-border)" }}>
      <legend className={styles.legend}>Research artifacts</legend>
      {values.map((item, index) => (
        <div
          key={index}
          className={styles.editorPair}
          style={{ borderColor: "var(--card-border)" }}
        >
          <label className={styles.field}>
            Type
            <select
              value={item.type}
              onChange={(event) =>
                update(index, {
                  type: event.target.value as ProjectArtifact["type"],
                })
              }
              className={styles.normalButton}
              style={{
                backgroundColor: "var(--input-bg)",
                borderColor: "var(--input-border)",
              }}
            >
              {ARTIFACT_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <TextField
            label="Title"
            value={item.title}
            onChange={(title) => update(index, { title })}
          />
          <TextField
            label="URL"
            type="url"
            value={item.url || ""}
            onChange={(url) => update(index, { url: url || null })}
          />
          <TextField
            label="Date"
            value={item.date || ""}
            onChange={(date) => update(index, { date: date || null })}
            placeholder="YYYY or YYYY-MM-DD"
          />
          <TextField
            label="Venue"
            value={item.venue || ""}
            onChange={(venue) => update(index, { venue: venue || null })}
          />
          <label className={styles.actionLabel}>
            <input
              type="checkbox"
              checked={item.featured}
              onChange={(event) => update(index, { featured: event.target.checked })}
            />
            Featured on archive card
          </label>
          <button
            type="button"
            aria-label={`Remove artifact ${index + 1}`}
            onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}
            className={styles.smallButton}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange([
            ...values,
            {
              type: "publication",
              title: "",
              url: null,
              date: null,
              venue: null,
              featured: false,
            },
          ])
        }
        className={styles.addButton}
      >
        Add artifact
      </button>
    </fieldset>
  );
}

type ProjectEditorProps = {
  initial: ProjectForm;
  editing: boolean;
  onCancel: () => void;
  onSave: (form: ProjectForm) => Promise<void>;
  busy: boolean;
};

function ProjectEditor(props: ProjectEditorProps) {
  return <ProjectEditorState key={props.initial.slug || "new-project"} {...props} />;
}

function ProjectEditorState({ initial, editing, onCancel, onSave, busy }: ProjectEditorProps) {
  const [form, setForm] = useState(initial);
  const field = <K extends keyof ProjectForm>(key: K, value: ProjectForm[K]) =>
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(form);
      }}
      className={styles.panel}
      style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
    >
      <div>
        <h2 className={styles.heading}>{editing ? "Edit project" : "Add project"}</h2>
        <p className={styles.mutedText}>
          Titles are never fetched from external URLs; an empty title uses the slug.
        </p>
      </div>
      <div className={styles.pairGrid}>
        <TextField
          label="Slug"
          value={form.slug}
          onChange={(value) => field("slug", value)}
          required
          disabled={editing}
          placeholder="project-slug"
        />
      </div>
      <div className={styles.pairGrid}>
        <TextField
          label="Target URL"
          value={form.target}
          onChange={(value) => field("target", value)}
          required
          type="url"
          placeholder="https://…"
        />
        <label className={styles.field}>
          Link type
          <select
            value={form.targetType || ""}
            onChange={(event) =>
              field("targetType", event.target.value ? (event.target.value as ArtifactType) : null)
            }
            className={styles.select}
            style={{
              backgroundColor: "var(--input-bg)",
              borderColor: "var(--input-border)",
            }}
          >
            <option value="">Automatic</option>
            {ARTIFACT_TYPES.map((type) => (
              <option key={type} value={type}>
                {artifactTypeLabel(type)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <TextField
        label="Title"
        value={form.title}
        onChange={(value) => field("title", value)}
        placeholder="Optional display title"
      />
      <label className={styles.field}>
        <span>Description</span>
        <textarea
          rows={4}
          value={form.description}
          onChange={(event) => field("description", event.target.value)}
          className={styles.normalInput}
          style={{
            backgroundColor: "var(--input-bg)",
            borderColor: "var(--input-border)",
          }}
        />
      </label>
      <label className={styles.field}>
        <span>Long description</span>
        <textarea
          rows={8}
          value={form.longDescription}
          onChange={(event) => field("longDescription", event.target.value)}
          className={styles.normalInput}
          style={{
            backgroundColor: "var(--input-bg)",
            borderColor: "var(--input-border)",
          }}
        />
      </label>
      <TextField
        label="Tags"
        value={form.tags}
        onChange={(value) => field("tags", value)}
        placeholder="bioinformatics, software"
      />
      <div className={styles.tripleGrid}>
        <ListEditor
          label="Research areas"
          values={form.researchAreas}
          onChange={(value) => field("researchAreas", value)}
          placeholder="Computational biology"
        />
        <ListEditor
          label="Technologies"
          values={form.technologies}
          onChange={(value) => field("technologies", value)}
          placeholder="Python"
        />
        <ListEditor
          label="Methods"
          values={form.methods}
          onChange={(value) => field("methods", value)}
          placeholder="Machine learning"
        />
      </div>
      <EntityEditor
        label="Organizations"
        values={form.organizations}
        onChange={(value) => field("organizations", value)}
      />
      <EntityEditor
        label="Collaborators"
        values={form.collaborators}
        onChange={(value) => field("collaborators", value)}
      />
      <ArtifactEditor values={form.artifacts} onChange={(value) => field("artifacts", value)} />
      <div className={styles.pairGrid}>
        <TextField
          label="Start date"
          value={form.startDate}
          onChange={(value) => field("startDate", value)}
          placeholder="YYYY, YYYY-MM, or YYYY-MM-DD"
        />
        <TextField
          label="End date"
          value={form.endDate}
          onChange={(value) => field("endDate", value)}
          placeholder="YYYY, YYYY-MM, or YYYY-MM-DD"
        />
      </div>
      <div className={styles.pairGrid}>
        <TextField
          label="Repository URL"
          value={form.githubRepo}
          onChange={(value) => field("githubRepo", value)}
          type="url"
          placeholder="https://github.com/…"
        />
        <TextField
          label="Photo set ID"
          value={form.photoSetId}
          onChange={(value) => field("photoSetId", value)}
          placeholder="Defaults to the project slug"
        />
      </div>
      <label className={styles.actionLabel}>
        <input
          type="checkbox"
          checked={form.permanent}
          onChange={(event) => field("permanent", event.target.checked)}
        />
        Permanent redirect (308)
      </label>
      <p className={styles.smallText}>
        Source: {form.slug.toLowerCase().startsWith("orcid-") ? "ORCID" : "Manual"}
      </p>
      <div className={styles.endActions}>
        <button
          type="button"
          onClick={onCancel}
          className={styles.saveButton}
          style={{ borderColor: "var(--card-border)" }}
        >
          Cancel
        </button>
        <button
          disabled={busy}
          type="submit"
          className={styles.secondaryButton}
          style={{
            backgroundColor: "var(--button-primary)",
            color: "var(--on-primary)",
          }}
        >
          {busy ? "Saving…" : "Save project"}
        </button>
      </div>
    </form>
  );
}

type CollectionEditorProps = {
  initial: CollectionForm;
  editing: boolean;
  projects: ProjectRecord[];
  onCancel: () => void;
  onSave: (form: CollectionForm) => Promise<void>;
  busy: boolean;
};

function CollectionEditor(props: CollectionEditorProps) {
  return <CollectionEditorState key={props.initial.id || "new-collection"} {...props} />;
}

function CollectionEditorState({
  initial,
  editing,
  projects,
  onCancel,
  onSave,
  busy,
}: CollectionEditorProps) {
  const [form, setForm] = useState(initial);
  const move = (index: number, direction: -1 | 1) =>
    setForm((current) => {
      const next = [...current.projects];
      const target = index + direction;
      if (target < 0 || target >= next.length) {
        return current;
      }
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, projects: next };
    });
  const bySlug = new Map(projects.map((project) => [project.slug, project]));
  const orderedProjects = [
    ...form.projects
      .map((slug) => bySlug.get(slug))
      .filter((project): project is ProjectRecord => Boolean(project)),
    ...projects.filter((project) => !form.projects.includes(project.slug)),
  ];
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(form);
      }}
      className={styles.panel}
      style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
    >
      <div>
        <h2 className={styles.heading}>{editing ? "Edit collection" : "Add collection"}</h2>
        <p className={styles.mutedText}>Choose existing projects and arrange their public order.</p>
      </div>
      <div className={styles.pairGrid}>
        <TextField
          label="Collection ID"
          value={form.id}
          onChange={(id) =>
            setForm((current) => ({
              ...current,
              id,
            }))
          }
          required
          disabled={editing}
        />
        <TextField
          label="Name"
          value={form.name}
          onChange={(name) =>
            setForm((current) => ({
              ...current,
              name,
            }))
          }
          required
        />
      </div>
      <label className={styles.field}>
        <span>Description</span>
        <textarea
          rows={3}
          value={form.description}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
          className={styles.normalInput}
          style={{
            backgroundColor: "var(--input-bg)",
            borderColor: "var(--input-border)",
          }}
        />
      </label>
      <TextField
        label="Collection tags"
        value={form.tags}
        onChange={(tags) => setForm((current) => ({ ...current, tags }))}
        placeholder="group, topic"
      />
      <fieldset className={styles.smallGrid}>
        <legend className={styles.label}>Projects</legend>
        {orderedProjects.map((project) => {
          const selected = form.projects.includes(project.slug);
          return (
            <label
              key={project.slug}
              className={styles.choice}
              style={{ borderColor: "var(--card-border)" }}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() =>
                  setForm((current) => ({
                    ...current,
                    projects: selected
                      ? current.projects.filter((slug) => slug !== project.slug)
                      : [...current.projects, project.slug],
                  }))
                }
              />
              <span className={styles.inlineLink}>{project.metadata.title}</span>
              {selected ? (
                <span className={styles.compactActions}>
                  <button
                    type="button"
                    aria-label={`Move ${project.metadata.title} up`}
                    onClick={() => move(form.projects.indexOf(project.slug), -1)}
                    className={styles.inlineButton}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${project.metadata.title} down`}
                    onClick={() => move(form.projects.indexOf(project.slug), 1)}
                    className={styles.inlineButton}
                  >
                    ↓
                  </button>
                </span>
              ) : null}
            </label>
          );
        })}
      </fieldset>
      <div className={styles.endActions}>
        <button
          type="button"
          onClick={onCancel}
          className={styles.saveButton}
          style={{ borderColor: "var(--card-border)" }}
        >
          Cancel
        </button>
        <button
          disabled={busy}
          type="submit"
          className={styles.secondaryButton}
          style={{
            backgroundColor: "var(--button-primary)",
            color: "var(--on-primary)",
          }}
        >
          {busy ? "Saving…" : "Save collection"}
        </button>
      </div>
    </form>
  );
}

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [tab, setTab] = useState<Tab>("projects");
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [projectChoices, setProjectChoices] = useState<ProjectRecord[]>([]);
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [projectForm, setProjectForm] = useState<ProjectForm | null>(null);
  const [collectionForm, setCollectionForm] = useState<CollectionForm | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pageSize = 20;

  const logout = useCallback(() => {
    removeAdminKey();
    setAdminKey("");
    setAuthenticated(false);
    setProjects([]);
    setCollections([]);
    setAnalytics(null);
  }, []);
  const request = useCallback(
    async (path: string, init?: RequestInit) => {
      const response = await fetch(path, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
          ...(init?.headers || {}),
        },
        cache: "no-store",
      });
      if (response.status === 401) {
        logout();
      }
      if (!response.ok) {
        throw new Error(await responseError(response));
      }
      return response;
    },
    [adminKey, logout],
  );
  const loadProjects = useCallback(
    async (nextOffset = 0) => {
      const response = await request(`/api/research/links?limit=${pageSize}&offset=${nextOffset}`);
      const payload = (await response.json()) as {
        links: ProjectRecord[];
        pagination: { total: number };
      };
      setProjects(payload.links);
      setTotal(payload.pagination.total);
      setOffset(nextOffset);
    },
    [request],
  );
  const loadProjectChoices = useCallback(async () => {
    const collected: ProjectRecord[] = [];
    let nextOffset = 0;
    let hasMore = true;
    while (hasMore) {
      const response = await request(`/api/research/links?limit=200&offset=${nextOffset}`);
      const payload = (await response.json()) as {
        links: ProjectRecord[];
        pagination: { hasMore: boolean };
      };
      collected.push(...payload.links);
      hasMore = payload.pagination.hasMore;
      nextOffset += 200;
    }
    setProjectChoices(collected);
  }, [request]);
  const loadCollections = useCallback(async () => {
    const response = await request("/api/research/collections");
    setCollections(((await response.json()) as { collections: CollectionRecord[] }).collections);
  }, [request]);

  useEffect(() => {
    const stored = readAdminKey();
    if (!stored) {
      const timeout = window.setTimeout(() => setCheckingAuth(false), 0);
      return () => window.clearTimeout(timeout);
    }
    const controller = new AbortController();
    fetch("/api/research/auth", {
      headers: { "x-admin-key": stored },
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Session expired");
        }
        setAdminKey(stored);
        setAuthenticated(true);
      })
      .catch((caught) => {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) {
          removeAdminKey();
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setCheckingAuth(false);
        }
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!authenticated || !adminKey) {
      return;
    }
    const timeout = window.setTimeout(() => {
      Promise.all([loadProjects(0), loadProjectChoices(), loadCollections()]).catch(
        (caught: Error) => setError(caught.message),
      );
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [adminKey, authenticated, loadCollections, loadProjectChoices, loadProjects]);

  const allProjectChoices = useMemo(() => {
    const map = new Map(projectChoices.map((project) => [project.slug, project]));
    return [...map.values()].toSorted((a, b) => a.metadata.title.localeCompare(b.metadata.title));
  }, [projectChoices]);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy("login");
    try {
      const response = await fetch("/api/research/auth", {
        headers: { "x-admin-key": adminKey },
        cache: "no-store",
      });
      if (!response.ok) {
        setError(await responseError(response));
        return;
      }
      storeAdminKey(adminKey);
      setAuthenticated(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign in");
    } finally {
      setBusy(null);
    }
  };

  const saveProject = async (form: ProjectForm) => {
    const editing = Boolean(projects.find((project) => project.slug === form.slug));
    setBusy(`project:${form.slug || "new"}`);
    setError("");
    setNotice("");
    try {
      await request("/api/research/links", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify({
          ...form,
          tags: form.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          researchAreas: form.researchAreas.filter((item) => item.trim()),
          technologies: form.technologies.filter((item) => item.trim()),
          methods: form.methods.filter((item) => item.trim()),
          organizations: form.organizations.filter((item) => item.name.trim()),
          collaborators: form.collaborators.filter((item) => item.name.trim()),
          artifacts: form.artifacts.filter((item) => item.title.trim()),
        }),
      });
      setProjectForm(null);
      setNotice(editing ? "Project updated." : "Project created.");
      await Promise.all([
        loadProjects(editing ? offset : 0),
        loadProjectChoices(),
        loadCollections(),
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save project");
    } finally {
      setBusy(null);
    }
  };
  const saveCollection = async (form: CollectionForm) => {
    const editing = collections.some((collection) => collection.id === form.id);
    setBusy(`collection:${form.id || "new"}`);
    setError("");
    setNotice("");
    try {
      await request("/api/research/collections", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify({
          ...form,
          tags: form.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      });
      setCollectionForm(null);
      setNotice(editing ? "Collection updated." : "Collection created.");
      await loadCollections();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save collection");
    } finally {
      setBusy(null);
    }
  };
  const remove = async (kind: "project" | "collection", id: string) => {
    if (!window.confirm(`Delete ${kind} “${id}”?`)) {
      return;
    }
    setBusy(`${kind}:${id}`);
    setError("");
    setNotice("");
    try {
      await request(
        kind === "project"
          ? `/api/research/links?slug=${encodeURIComponent(id)}`
          : `/api/research/collections?id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      setNotice(`${kind === "project" ? "Project" : "Collection"} deleted.`);
      await Promise.all([
        loadProjects(Math.max(0, offset - (projects.length === 1 ? pageSize : 0))),
        loadProjectChoices(),
        loadCollections(),
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Unable to delete ${kind}`);
    } finally {
      setBusy(null);
    }
  };
  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    setError("");
    try {
      setAnalytics((await (await request("/api/research/stats")).json()) as AnalyticsSummary);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load analytics");
    } finally {
      setAnalyticsLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <main id="main-content" tabIndex={-1} className={styles.sessionScreen}>
        <p role="status">Checking your session…</p>
      </main>
    );
  }
  if (!authenticated) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className={styles.loginScreen}
        style={{ backgroundColor: "var(--background-color)" }}
      >
        <form
          onSubmit={login}
          className={styles.loginForm}
          style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
        >
          <div>
            <h1 className={styles.title}>Research admin</h1>
            <p className={styles.mutedText}>Use the deployment&apos;s shared administrator key.</p>
          </div>
          <TextField
            label="Admin key"
            value={adminKey}
            onChange={setAdminKey}
            required
            type="password"
          />
          {error ? (
            <p
              role="alert"
              className={styles.smallBox}
              style={{
                color: "var(--error-text)",
                backgroundColor: "var(--error-bg)",
                borderColor: "var(--error-border)",
              }}
            >
              {error}
            </p>
          ) : null}
          <button
            disabled={busy === "login"}
            className={styles.submitButton}
            style={{
              backgroundColor: "var(--button-primary)",
              color: "var(--on-primary)",
            }}
          >
            {busy === "login" ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={styles.main}
      style={{ backgroundColor: "var(--background-color)" }}
    >
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.pageTitle}>Research admin</h1>
            <p className={styles.muted}>Manage the public directory and all-time analytics.</p>
          </div>
          <button
            onClick={logout}
            className={styles.saveButton}
            style={{ borderColor: "var(--card-border)" }}
          >
            Sign out
          </button>
        </header>
        <nav
          aria-label="Admin sections"
          className={styles.tabs}
          style={{ borderColor: "var(--card-border)" }}
        >
          {(["projects", "collections", "analytics"] as Tab[]).map((value) => (
            <button
              key={value}
              onClick={() => {
                setTab(value);
                setProjectForm(null);
                setCollectionForm(null);
                if (value === "analytics" && !analytics) {
                  void loadAnalytics();
                }
              }}
              aria-current={tab === value ? "page" : undefined}
              className={styles.tab}
              style={{
                borderColor: tab === value ? "var(--primary-color)" : "transparent",
                color: tab === value ? "var(--primary-color)" : "var(--text-color)",
              }}
            >
              {value}
            </button>
          ))}
        </nav>
        {error ? (
          <div
            role="alert"
            className={styles.plainBox}
            style={{
              color: "var(--error-text)",
              backgroundColor: "var(--error-bg)",
              borderColor: "var(--error-border)",
            }}
          >
            {error}
            <button onClick={() => setError("")} className={styles.exportLink}>
              Dismiss
            </button>
          </div>
        ) : null}
        {notice ? (
          <div
            role="status"
            className={styles.plainBox}
            style={{
              backgroundColor: "var(--primary-soft)",
              borderColor: "var(--primary-color)",
            }}
          >
            {notice}
          </div>
        ) : null}

        {tab === "projects" ? (
          <section className={styles.stack}>
            {projectForm ? (
              <ProjectEditor
                initial={projectForm}
                editing={projects.some((project) => project.slug === projectForm.slug)}
                onCancel={() => setProjectForm(null)}
                onSave={saveProject}
                busy={busy?.startsWith("project:") || false}
              />
            ) : (
              <button
                onClick={() => setProjectForm({ ...EMPTY_PROJECT })}
                className={styles.primaryButton}
                style={{
                  backgroundColor: "var(--button-primary)",
                  color: "var(--on-primary)",
                }}
              >
                Add project
              </button>
            )}
            <div
              className={styles.tablePanel}
              style={{
                borderColor: "var(--card-border)",
                backgroundColor: "var(--card-bg)",
              }}
            >
              <table className={styles.table}>
                <thead className={styles.tableHead} style={{ borderColor: "var(--card-border)" }}>
                  <tr>
                    <th className={styles.cell}>Project</th>
                    <th className={styles.cell}>Source</th>
                    <th className={styles.cell}>Clicks</th>
                    <th className={styles.cell}>Tags</th>
                    <th className={styles.rightCell}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    <tr
                      key={project.slug}
                      className={styles.tableRow}
                      style={{ borderColor: "var(--card-border)" }}
                    >
                      <td className={styles.cell}>
                        <p className={styles.bold}>{project.metadata.title}</p>
                        <p className={styles.identifier}>/{project.slug}</p>
                      </td>
                      <td className={styles.sourceCell}>{project.source}</td>
                      <td className={styles.cell}>{project.clicks}</td>
                      <td className={styles.smallCell}>
                        {project.metadata.tags.join(", ") || "—"}
                      </td>
                      <td className={styles.rightCell}>
                        <button
                          onClick={() =>
                            setProjectForm({
                              slug: project.slug,
                              target: project.target,
                              targetType: project.metadata.targetType ?? null,
                              title: project.metadata.title,
                              description: project.metadata.description || "",
                              longDescription: project.metadata.longDescription || "",
                              tags: project.metadata.tags.join(", "),
                              researchAreas: project.metadata.researchAreas,
                              technologies: project.metadata.technologies,
                              methods: project.metadata.methods,
                              organizations: project.metadata.organizations,
                              collaborators: project.metadata.collaborators,
                              artifacts: project.metadata.artifacts,
                              permanent: project.metadata.permanent,
                              startDate: project.metadata.startDate || "",
                              endDate: project.metadata.endDate || "",
                              githubRepo: project.metadata.githubRepo || "",
                              photoSetId: project.metadata.photoSetId || "",
                            })
                          }
                          className={styles.hint}
                        >
                          Edit
                        </button>
                        <button
                          disabled={busy === `project:${project.slug}`}
                          onClick={() => void remove("project", project.slug)}
                          className={styles.textButton}
                          style={{ color: "var(--error-text)" }}
                        >
                          {busy === `project:${project.slug}` ? "Deleting…" : "Delete"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!projects.length ? (
                <p className={styles.emptyCell}>No projects on this page.</p>
              ) : null}
            </div>
            <div className={styles.smallRow}>
              <span>
                {total
                  ? `${offset + 1}–${Math.min(offset + pageSize, total)} of ${total}`
                  : "0 projects"}
              </span>
              <span className={styles.actions}>
                <button
                  disabled={offset === 0}
                  onClick={() => void loadProjects(Math.max(0, offset - pageSize))}
                  className={styles.pageButton}
                >
                  Previous
                </button>
                <button
                  disabled={offset + pageSize >= total}
                  onClick={() => void loadProjects(offset + pageSize)}
                  className={styles.pageButton}
                >
                  Next
                </button>
              </span>
            </div>
          </section>
        ) : null}

        {tab === "collections" ? (
          <section className={styles.stack}>
            {collectionForm ? (
              <CollectionEditor
                initial={collectionForm}
                editing={collections.some((collection) => collection.id === collectionForm.id)}
                projects={allProjectChoices}
                onCancel={() => setCollectionForm(null)}
                onSave={saveCollection}
                busy={busy?.startsWith("collection:") || false}
              />
            ) : (
              <button
                onClick={() => setCollectionForm({ ...EMPTY_COLLECTION })}
                className={styles.primaryButton}
                style={{
                  backgroundColor: "var(--button-primary)",
                  color: "var(--on-primary)",
                }}
              >
                Add collection
              </button>
            )}
            <div className={styles.grid}>
              {collections.map((collection) => (
                <article
                  key={collection.id}
                  className={styles.stat}
                  style={{
                    backgroundColor: "var(--card-bg)",
                    borderColor: "var(--card-border)",
                  }}
                >
                  <div className={styles.editorHeader}>
                    <div>
                      <h2 className={styles.heading}>{collection.name}</h2>
                      <p className={styles.subtle}>{collection.description}</p>
                      <p className={styles.page}>
                        {collection.projects.length} projects ·{" "}
                        {collection.tags.join(", ") || "no collection tags"}
                      </p>
                    </div>
                    <div className={styles.fixed}>
                      <button
                        onClick={() =>
                          setCollectionForm({
                            id: collection.id,
                            name: collection.name,
                            description: collection.description,
                            tags: collection.tags.join(", "),
                            projects: collection.projects,
                          })
                        }
                        className={styles.hint}
                      >
                        Edit
                      </button>
                      <button
                        disabled={busy === `collection:${collection.id}`}
                        onClick={() => void remove("collection", collection.id)}
                        className={styles.textButton}
                        style={{ color: "var(--error-text)" }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
              {!collections.length ? (
                <p className={styles.emptyPanel} style={{ borderColor: "var(--card-border)" }}>
                  No collections yet.
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {tab === "analytics" ? (
          <section className={styles.stackLarge}>
            <div className={styles.row}>
              <div>
                <h2 className={styles.heading}>All-time analytics</h2>
                <p className={styles.mutedText}>
                  Raw successful redirect counts since each project was created.
                </p>
              </div>
              <button onClick={() => void loadAnalytics()} className={styles.saveButton}>
                Refresh
              </button>
            </div>
            {analyticsLoading ? (
              <p role="status">Loading analytics…</p>
            ) : analytics ? (
              <>
                <div className={styles.statsGrid}>
                  {[
                    ["Projects", analytics.totalLinks],
                    ["Clicks", analytics.totalClicks],
                    ["Average clicks", analytics.averageClicks],
                    ["Unique tags", analytics.uniqueTags],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className={styles.stat}
                      style={{
                        backgroundColor: "var(--card-bg)",
                        borderColor: "var(--card-border)",
                      }}
                    >
                      <p className={styles.mutedText}>{label}</p>
                      <p className={styles.pageTitle}>{value}</p>
                    </div>
                  ))}
                </div>
                <div className={styles.splitGrid}>
                  <div
                    className={styles.stat}
                    style={{
                      backgroundColor: "var(--card-bg)",
                      borderColor: "var(--card-border)",
                    }}
                  >
                    <h3 className={styles.subheading}>Top projects</h3>
                    <ol className={styles.stackSmall}>
                      {analytics.topProjects.map((project) => (
                        <li key={project.slug} className={styles.spreadActions}>
                          <span className={styles.truncate}>{project.title}</span>
                          <strong>{project.clicks}</strong>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div
                    className={styles.stat}
                    style={{
                      backgroundColor: "var(--card-bg)",
                      borderColor: "var(--card-border)",
                    }}
                  >
                    <h3 className={styles.subheading}>Top tags</h3>
                    <ol className={styles.stackSmall}>
                      {analytics.topTags.map((tag) => (
                        <li key={tag.tag} className={styles.spreadActions}>
                          <span>{tag.tag}</span>
                          <strong>{tag.projects}</strong>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </>
            ) : (
              <p>No analytics available.</p>
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}
