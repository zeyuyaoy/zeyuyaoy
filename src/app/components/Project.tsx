import type {Project as GithubProject} from "@/lib/github";

import styles from "./Project.module.css";

export default function Project({project}: { project: GithubProject }) {
    return (
        <a
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.projectLink}
        >
            <div className={styles.project}>
                <h3 className={styles.project_title}>{project.name}</h3>
                {project.description && <p className={styles.project_description}>{project.description}</p>}
            </div>
        </a>
    );
}
