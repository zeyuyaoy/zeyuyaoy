"use client";

import { Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type ArchiveState, filterProjects, type ProjectSummary } from "@/lib/research/archive";

export default function FilterDrawer({
  open,
  onClose,
  state,
  projects,
  onApply,
  onClear,
  returnFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  state: ArchiveState;
  projects: ProjectSummary[];
  onApply: (state: ArchiveState) => void;
  onClear: () => void;
  returnFocusRef?: { readonly current: HTMLElement | null };
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [draft, setDraft] = useState(state);
  const [tagQuery, setTagQuery] = useState("");
  const dismiss = useCallback(() => {
    const previous = previousFocus.current;
    if (dialogRef.current?.open) {
      dialogRef.current.close();
    }
    onClose();
    window.setTimeout(() => previous?.focus(), 0);
  }, [onClose]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    if (open && !dialog.open) {
      previousFocus.current =
        returnFocusRef?.current ?? (document.activeElement as HTMLElement | null);
      dialog.showModal();
      document.body.style.overflow = "hidden";
    } else if (!open && dialog.open) {
      dialog.close();
    }
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, returnFocusRef]);
  const tags = useMemo(
    () =>
      Array.from(new Set(projects.flatMap((project) => project.researchAreas)))
        .filter((tag) => tag.toLowerCase().includes(tagQuery.toLowerCase()))
        .sort((a, b) => a.localeCompare(b)),
    [projects, tagQuery],
  );
  const years = useMemo(
    () =>
      Array.from(
        new Set(
          projects
            .flatMap((project) => [project.startDate, project.endDate])
            .filter((date): date is string => Boolean(date))
            .map((date) => date.slice(0, 4)),
        ),
      ).sort((a, b) => b.localeCompare(a)),
    [projects],
  );
  const visible = useMemo(() => filterProjects(projects, draft).length, [draft, projects]);
  const active = draft.tags.length + (draft.source === "all" ? 0 : 1) + (draft.year ? 1 : 0);
  return (
    <dialog
      ref={dialogRef}
      className="filter-dialog"
      aria-labelledby="filter-title"
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
    >
      <header>
        <div>
          <h2 id="filter-title">Filter and sort research</h2>
          {active ? <span>{active} active</span> : null}
        </div>
        <button className="icon-button" type="button" onClick={dismiss} aria-label="Close filters">
          <X aria-hidden />
        </button>
      </header>
      <div className="filter-body">
        <label className="filter-select filter-sort">
          <strong>Sort by</strong>
          <select
            value={draft.sort}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                sort: event.target.value as ArchiveState["sort"],
              }))
            }
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="title-asc">Title (A–Z)</option>
            <option value="title-desc">Title (Z–A)</option>
          </select>
        </label>
        <fieldset>
          <legend>Source</legend>
          <div className="filter-options-inline">
            {(["all", "manual", "orcid"] as const).map((source) => (
              <label key={source}>
                <input
                  type="radio"
                  name="source"
                  checked={draft.source === source}
                  onChange={() =>
                    setDraft((current) => ({
                      ...current,
                      source,
                    }))
                  }
                />
                <span>{source === "all" ? "All" : source === "orcid" ? "ORCID" : "Manual"}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Research areas</legend>
          <label className="filter-search">
            <Search aria-hidden />
            <span className="sr-only">Find a research area</span>
            <input
              value={tagQuery}
              onChange={(event) => setTagQuery(event.target.value)}
              placeholder="Find a research area…"
            />
          </label>
          <div className="filter-checks">
            {tags.map((tag) => {
              const checked = draft.tags.some(
                (selected) => selected.toLowerCase() === tag.toLowerCase(),
              );
              return (
                <label key={tag}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setDraft((current) => ({
                        ...current,
                        tags: checked
                          ? current.tags.filter(
                              (selected) => selected.toLowerCase() !== tag.toLowerCase(),
                            )
                          : [...current.tags, tag],
                      }))
                    }
                  />
                  <span>{tag}</span>
                </label>
              );
            })}
          </div>
          {!tags.length ? (
            <p className="filter-empty" role="status">
              No research areas match “{tagQuery}”.
            </p>
          ) : null}
        </fieldset>
        <label className="filter-select">
          <strong>Year</strong>
          <select
            value={draft.year || ""}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                year: event.target.value || null,
              }))
            }
          >
            <option value="">Any year</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
      </div>
      <footer>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            onClear();
            dismiss();
          }}
        >
          Clear all
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            onApply(draft);
            dismiss();
          }}
        >
          Show {visible} project{visible === 1 ? "" : "s"}
        </button>
      </footer>
    </dialog>
  );
}
