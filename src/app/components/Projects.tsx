import {getGithubProjects, type Project as GithubProject} from "@/lib/github";
import {failureCode, reportUpstream} from "@/lib/upstream";
import styles from "./Projects.module.css";
import Project from "./Project";

export default async function Projects() {
    let projects: GithubProject[] = [];
    let unavailable = false;

    try {
        projects = (await getGithubProjects()).filter(project => project.name !== "zeyuyaoy");
    } catch (error) {
        unavailable = true;
        reportUpstream({service: "github", state: "degraded", reason: failureCode(error)});
    }

    return (
        <section className={styles.projectsContainer} aria-labelledby="projects-heading">
            <div className={styles.notebook}>
                <div className={styles.spiralBinding} aria-hidden="true">
                    {Array.from({length: 8}, (_, i) => <div key={i} className={styles.spiral}/>)}
                </div>
                <div className={styles.notebookContent}>
                    <h2 id="projects-heading" className={styles.projectText}>Here&apos;s what I&apos;ve been working on!</h2>
                    <div className={styles.projectsList}>
                        {unavailable ? (
                            <div className={styles.errorMessage}>
                                <p>Projects are unavailable right now.</p>
                                <p className={styles.errorFooter}>
                                    Contact me through <a href="mailto:novodoodle@gmail.com"
                                                          className={styles.link}>Email</a>
                                </p>
                            </div>
                        ) : projects.length ? (
                            <>
                                <Project project={projects[0]}/>
                                {projects[1] && (
                                    <div className={styles.projectPeek}>
                                        <Project project={projects[1]}/>
                                    </div>
                                )}
                            </>
                        ) : (
                            <p className={styles.emptyState}>No public projects at the moment. Check back later! 🌱</p>
                        )}
                    </div>
                    <div className={styles.footer}>
                        <a href="https://github.com/zeyuyaoy" target="_blank" rel="noopener noreferrer"
                           className={styles.viewMore}>
                            View more projects on GitHub →
                        </a>
                    </div>
                </div>
            </div>
        </section>
    );
}
