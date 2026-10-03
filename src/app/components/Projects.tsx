import type { ProjectData } from "@/lib/github";
import styles from "./Projects.module.css";
import Project from "./Project";
import ProjectPreview from "./ProjectPreview";

export default function Projects({ data: { projects, status } }: { data: ProjectData }) {
  return (
    <section className={styles.projectsContainer} aria-labelledby="projects-heading">
      <div className={styles.notebook}>
        <div className={styles.spiralBinding} aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className={styles.spiral} />
          ))}
        </div>
        <div className={styles.notebookContent}>
          <h2 id="projects-heading" className={styles.projectText}>
            Here&apos;s what I&apos;ve been working on!
          </h2>
          <div className={styles.projectsList}>
            {status === "unavailable" ? (
              <div className={styles.errorMessage}>
                <p>Projects are unavailable right now.</p>
                <p className={styles.errorFooter}>
                  Contact me through{" "}
                  <a href="mailto:cytronicoder+hi@gmail.com" className={styles.link}>
                    Email
                  </a>
                </p>
              </div>
            ) : projects.length ? (
              <>
                <Project project={projects[0]} />
                {projects[1] && (
                  <ProjectPreview>
                    <Project project={projects[1]} />
                  </ProjectPreview>
                )}
              </>
            ) : (
              <p className={styles.emptyState}>
                No public projects at the moment. Check back later! 🌱
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
