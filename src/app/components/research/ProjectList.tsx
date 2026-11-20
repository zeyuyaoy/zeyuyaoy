"use client";

import type { ReactNode } from "react";

export default function ProjectList({
  children,
  isSearching,
  availability,
  onReset,
}: {
  children: ReactNode[];
  isSearching: boolean;
  availability: "ready" | "unconfigured" | "unavailable";
  onReset?: () => void;
}) {
  if (!children.length) {
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
  return <div className="archive-list">{children}</div>;
}
