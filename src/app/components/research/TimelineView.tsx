import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ProjectSummary } from "@/lib/research/archive";
import { projectYear } from "@/lib/research/archive";
import { formatResearchDateRange } from "@/lib/research/models";

export default function TimelineView({
  projects,
  onTagSelect,
  selectedTags = [],
}: {
  projects: ProjectSummary[];
  selectedTags?: string[];
  onTagSelect: (tag: string) => void;
}) {
  const grouped = new Map<string, ProjectSummary[]>();
  projects.forEach((project) => {
    const year = projectYear(project) || "Undated";
    grouped.set(year, [...(grouped.get(year) || []), project]);
  });
  const groups = [...grouped.entries()].toSorted(([a], [b]) =>
    a === "Undated" ? 1 : b === "Undated" ? -1 : b.localeCompare(a),
  );
  return (
    <div className="timeline-view">
      {groups.map(([year, entries]) => (
        <section key={year} aria-labelledby={`year-${year}`}>
          <h2 id={`year-${year}`}>{year}</h2>
          <div className="timeline-items">
            {entries.map((project) => (
              <article key={project.slug}>
                <span className="timeline-dot" aria-hidden />
                <div className="timeline-date">
                  {formatResearchDateRange(project.startDate, project.endDate) ||
                    "Date unavailable"}
                </div>
                <Link prefetch={false} className="timeline-title" href={project.detailUrl}>
                  <strong>{project.title}</strong>
                  <ChevronRight aria-hidden />
                </Link>
                <div className="timeline-tags">
                  {project.researchAreas.slice(0, 2).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={selectedTags.some(
                        (value) => value.toLowerCase() === tag.toLowerCase(),
                      )}
                      onClick={() => onTagSelect(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
