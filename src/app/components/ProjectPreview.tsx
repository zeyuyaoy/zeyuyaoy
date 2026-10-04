import type { ReactNode } from "react";
import styles from "./Projects.module.css";

export default function ProjectPreview({ children }: { children: ReactNode }) {
  return (
    <div className={styles.projectPeek}>
      <div className={styles.projectBackdrop}>{children}</div>
      <a
        href="https://github.com/zeyuyaoy"
        target="_blank"
        rel="noopener noreferrer"
        className={styles.githubButton}
        aria-label="Visit my GitHub profile"
      >
        <span className={styles.githubIcon} aria-hidden="true" />
        <span className={styles.githubLabel} aria-hidden="true">
          <span className={styles.githubLabelClip}>
            <span>Visit my GitHub profile</span>
          </span>
        </span>
      </a>
    </div>
  );
}
