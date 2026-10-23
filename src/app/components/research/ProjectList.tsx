"use client";

import type { ProjectSummary } from "@/lib/research/archive";
import ProjectCard from "./ProjectCard";

export default function ProjectList({
  links,
  isSearching,
  highlights,
  availability,
  hasCollectionResults,
  onTagSelect,
  onReset,
  selectedTags,
}: {
  links: ProjectSummary[];
  isSearching: boolean;
  highlights?: string[];
  selectedTags?: string[];
  availability: "ready" | "unconfigured" | "unavailable";
  hasCollectionResults: boolean;
  onTagSelect?: (tag: string) => void;
  onReset?: () => void;
}) {
  if (!links.length && hasCollectionResults) {
    return null;
  }
  if (!links.length) {
    const message = isSearching
      ? "No projects match this search and filter combination."
      : availability === "unconfigured"
        ? "The research directory is not configured yet."
        : availability === "unavailable"
          ? "The research directory is temporarily unavailable. Please try again later."
          : "No projects are available yet.";
    return (
      <div className="empty-state" role="status">
        <h2>{isSearching ? "No matching research" : "Research unavailable"}</h2>
        <p>{message}</p>
        {isSearching && onReset ? (
          <button type="button" className="secondary-button" onClick={onReset}>
            Clear search and filters
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="archive-list">
      {links.map((project) => (
        <ProjectCard
          key={project.slug}
          project={project}
          highlights={highlights}
          selectedTags={selectedTags}
          onTagSelect={onTagSelect}
        />
      ))}
    </div>
  );
}
