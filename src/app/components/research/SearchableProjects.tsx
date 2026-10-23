"use client";

import { navigateHome } from "../useHomeLocation";
import { Filter, Search, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  type ArchiveState,
  archiveUrl,
  filterProjects,
  parseArchiveState,
  type ProjectSummary,
} from "@/lib/research/archive";
import type { CollectionView } from "@/lib/research/views";
import CollectionCard from "./CollectionCard";
import FilterDrawer from "./FilterDrawer";
import ProjectList from "./ProjectList";
import SiteHeader from "./SiteHeader";
import TimelineView from "./TimelineView";

export default function SearchableProjects({
  initialLinks,
  initialCollections = [],
  availability,
  initialState,
  active = true,
}: {
  initialLinks: ProjectSummary[];
  initialCollections?: CollectionView[];
  availability: "ready" | "unconfigured" | "unavailable";
  initialState: ArchiveState;
  active?: boolean;
}) {
  const [state, setState] = useState(initialState);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const filtersReturnFocus = useRef<HTMLElement | null>(null);
  const deferredQuery = useDeferredValue(state.query);

  const commit = useCallback((next: ArchiveState, mode: "push" | "replace" = "push") => {
    setState(next);
    const url = archiveUrl(next, window.location.href);
    navigateHome(url, mode);
  }, []);

  useEffect(() => {
    const onPopState = () =>
      setState(parseArchiveState(new URLSearchParams(window.location.search)));
    const onKey = (event: KeyboardEvent) => {
      if (!active) {
        return;
      }
      const target = event.target;
      const editable =
        target instanceof HTMLElement &&
        target.matches("input, textarea, select, [contenteditable]");
      if (
        event.key === "/" &&
        !editable &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !document.querySelector(".filter-dialog[open], .command-dialog[open]")
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("popstate", onPopState);
    window.addEventListener("portfolio:navigate", onPopState);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("portfolio:navigate", onPopState);
      document.removeEventListener("keydown", onKey);
    };
  }, [active]);

  const effectiveState = useMemo(
    () => ({ ...state, query: deferredQuery }),
    [deferredQuery, state],
  );
  const filtered = useMemo(
    () => filterProjects(initialLinks, effectiveState),
    [effectiveState, initialLinks],
  );
  const model = useMemo(() => {
    const visibleSlugs = new Set(filtered.map((project) => project.slug));
    const collections = initialCollections.flatMap((collection) => {
      const members = initialLinks.filter(
        (project) => collection.projects.includes(project.slug) && visibleSlugs.has(project.slug),
      );
      return members.length ? [{ ...collection, members }] : [];
    });
    const grouped = new Set(
      collections.flatMap((collection) => collection.members.map((project) => project.slug)),
    );
    return {
      collections,
      standalone: filtered.filter((project) => !grouped.has(project.slug)),
    };
  }, [filtered, initialCollections, initialLinks]);

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    initialLinks.forEach((project) =>
      project.researchAreas.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1)),
    );
    const featured = ["computational biology", "machine learning", "bioinformatics", "embeddings"];
    return [...counts.entries()].toSorted((a, b) => {
      const aIndex = featured.indexOf(a[0].toLowerCase());
      const bIndex = featured.indexOf(b[0].toLowerCase());
      if (aIndex >= 0 || bIndex >= 0) {
        return (aIndex < 0 ? featured.length : aIndex) - (bIndex < 0 ? featured.length : bIndex);
      }
      return b[1] - a[1] || a[0].localeCompare(b[0]);
    });
  }, [initialLinks]);
  const visibleTopics = tagCounts.slice(0, 4);
  const hiddenTopicCount = tagCounts.length - visibleTopics.length;
  const filtersActive = Boolean(
    state.query || state.tags.length || state.source !== "all" || state.year,
  );
  const filterCount = state.tags.length + (state.source === "all" ? 0 : 1) + (state.year ? 1 : 0);
  const highlights = deferredQuery.trim().split(/\s+/).filter(Boolean);
  const clearFilters = useCallback(
    () =>
      commit({
        ...state,
        query: "",
        tags: [],
        source: "all",
        year: null,
      }),
    [commit, state],
  );
  const toggleTag = useCallback(
    (tag: string) => {
      const selected = state.tags.some((value) => value.toLowerCase() === tag.toLowerCase());
      commit({
        ...state,
        tags: selected
          ? state.tags.filter((value) => value.toLowerCase() !== tag.toLowerCase())
          : [...state.tags, tag],
      });
    },
    [commit, state],
  );

  return (
    <>
      <section id="research-content" aria-label="Research archive">
        <SiteHeader
          projects={initialLinks}
          active={active}
          onTagSelect={toggleTag}
          onClearFilters={clearFilters}
          showIntro
        />
        <section className="archive-search" aria-label="Search and browse research">
          <div className="search-field">
            <Search aria-hidden />
            <label className="sr-only" htmlFor="research-search">
              Search projects, tags, dates, organizations, and metadata
            </label>
            <input
              ref={searchRef}
              id="research-search"
              type="search"
              placeholder="Search the archives"
              aria-keyshortcuts="/"
              value={state.query}
              onChange={(event) => commit({ ...state, query: event.target.value }, "replace")}
            />
            {state.query ? (
              <button
                type="button"
                onClick={() => commit({ ...state, query: "" }, "replace")}
                aria-label="Clear search"
              >
                <X aria-hidden />
              </button>
            ) : (
              <kbd aria-hidden="true">/</kbd>
            )}
          </div>
          <Image
            src="/research/pet.png"
            alt=""
            aria-hidden
            width={58}
            height={58}
            priority
            className="search-pet"
          />
        </section>

        <section className="archive-toolbar" aria-label="Directory controls">
          <div className="view-switch" role="group" aria-label="Archive view">
            {(["projects", "timeline"] as const).map((view) => (
              <button
                key={view}
                type="button"
                aria-pressed={state.view === view}
                onClick={() =>
                  commit({
                    ...state,
                    view,
                  })
                }
              >
                {view === "projects" ? "Projects" : "Timeline"}
              </button>
            ))}
          </div>
          <p className="archive-count">
            <strong>{filtered.length}</strong>
            <span>
              {" "}
              of {initialLinks.length} projects · {tagCounts.length} research areas
            </span>
          </p>
          <button
            type="button"
            className="filter-button"
            aria-haspopup="dialog"
            aria-expanded={filtersOpen}
            aria-label={filterCount ? `Filters, ${filterCount} active` : "Filters"}
            onClick={(event) => {
              filtersReturnFocus.current = event.currentTarget;
              setFiltersOpen(true);
            }}
          >
            <Filter aria-hidden />
            Filters{filterCount ? <span>{filterCount}</span> : null}
          </button>
        </section>

        <div className="quick-filters" aria-label="Quick research area filters">
          {visibleTopics.map(([tag]) => (
            <button
              key={tag}
              type="button"
              aria-pressed={state.tags.some((value) => value.toLowerCase() === tag.toLowerCase())}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          ))}
          {hiddenTopicCount > 0 ? (
            <button
              type="button"
              className="topics-more"
              aria-haspopup="dialog"
              aria-label={`+${hiddenTopicCount} ${hiddenTopicCount === 1 ? "topic" : "topics"} — show all topics`}
              aria-expanded={filtersOpen}
              onClick={(event) => {
                filtersReturnFocus.current = event.currentTarget;
                setFiltersOpen(true);
              }}
            >
              +{hiddenTopicCount} {hiddenTopicCount === 1 ? "topic" : "topics"}
            </button>
          ) : null}
        </div>

        {filtersActive ? (
          <div className="active-filters" aria-label="Active filters">
            {state.tags.map((tag) => (
              <button key={tag} type="button" onClick={() => toggleTag(tag)}>
                {tag}
                <X aria-hidden />
              </button>
            ))}
            {state.source !== "all" ? (
              <button
                type="button"
                onClick={() =>
                  commit({
                    ...state,
                    source: "all",
                  })
                }
              >
                {state.source === "orcid" ? "ORCID" : "Manual"}
                <X aria-hidden />
              </button>
            ) : null}
            {state.year ? (
              <button type="button" onClick={() => commit({ ...state, year: null })}>
                {state.year}
                <X aria-hidden />
              </button>
            ) : null}
            <button type="button" className="clear-filter-link" onClick={clearFilters}>
              Clear all
            </button>
          </div>
        ) : null}

        <p className="sr-only" aria-live="polite">
          {filtered.length} project{filtered.length === 1 ? "" : "s"} shown.
        </p>
        <section id="research-archive" className="archive-content" aria-label="Research results">
          {state.view === "timeline" ? (
            <TimelineView selectedTags={state.tags} projects={filtered} onTagSelect={toggleTag} />
          ) : (
            <>
              {model.collections.length ? (
                <div className="archive-list">
                  {model.collections.map((collection) => (
                    <CollectionCard
                      key={collection.id}
                      {...collection}
                      projects={collection.members}
                      selectedTags={state.tags}
                      onTagSelect={toggleTag}
                    />
                  ))}
                </div>
              ) : null}
              <ProjectList
                selectedTags={state.tags}
                links={model.standalone}
                isSearching={filtersActive}
                highlights={highlights}
                availability={availability}
                hasCollectionResults={model.collections.length > 0}
                onTagSelect={toggleTag}
                onReset={clearFilters}
              />
            </>
          )}
          {state.view === "timeline" && !filtered.length ? (
            <div className="empty-state">
              <h2>No matching research</h2>
              <p>Try a broader search or remove a filter.</p>
              <button className="secondary-button" onClick={clearFilters}>
                Clear search and filters
              </button>
            </div>
          ) : null}
        </section>
      </section>
      {filtersOpen ? (
        <FilterDrawer
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          returnFocusRef={filtersReturnFocus}
          state={state}
          projects={initialLinks}
          onApply={(next) => commit(next)}
          onClear={clearFilters}
        />
      ) : null}
    </>
  );
}
