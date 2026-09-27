import type { Project as GithubProject } from "@/lib/github";

import styles from "./Project.module.css";

export default function Project({ project }: { project: GithubProject }) {
  return (
    <a href={project.url} target="_blank" rel="noopener noreferrer" className={styles.projectLink}>
      <div className={styles.project}>
        <div className={styles.projectHeader}>
          <h3 className={styles.project_title}>{project.name}</h3>
          <span
            className={styles.stars}
            aria-label={`${project.stars} GitHub ${project.stars === 1 ? "star" : "stars"}`}
          >
            <span aria-hidden="true">{project.stars.toLocaleString("en-US")}</span>
            <svg
              className={styles.starIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m12 3 2.78 5.63 6.22.91-4.5 4.38 1.06 6.19L12 17.19l-5.56 2.92 1.06-6.19L3 9.54l6.22-.91L12 3Z" />
            </svg>
          </span>
        </div>
        {project.description && <p className={styles.project_description}>{project.description}</p>}
      </div>
    </a>
  );
}
