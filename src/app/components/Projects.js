"use client";

import { useState, useEffect } from "react";
import styles from "./Projects.module.css";
import Project from "./Project";

export default function Projects() {
    const fetcher = (url) => fetch(url).then((r) => r.json());
    const [projects, setProjects] = useState([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetcher("/api/github")
            .then((data) => {
                const projectList = Array.isArray(data) ? data : data.projects || [];
                const filteredProjects = projectList.filter((project) => project.name !== "zeyuyaoy");
                setProjects(filteredProjects);
                setIsLoaded(true);
                if (data.fallback) {
                    setError(new Error(data.message || "Projects are unavailable right now."));
                }
            })
            .catch((error) => {
                setIsLoaded(true);
                setError(error);
            });
    }, []);

    return (
        <div className={styles.projectsContainer}>
            <div className={styles.notebook}>
                <div className={styles.spiralBinding}>
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className={styles.spiral}></div>
                    ))}
                </div>

                {isLoaded ? (
                    <div className={styles.notebookContent}>
                        {error ? (
                            <div className={styles.errorMessage}>
                                <p>{error.message || "Projects are unavailable right now."}</p>
                                <p className={styles.errorFooter}>
                                    Contact me through{" "}
                                    <a
                                        href="mailto:novodoodle@gmail.com"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={styles.link}
                                    >
                                        Email
                                    </a>
                                </p>
                            </div>
                        ) : (
                            <>
                                <p className={styles.projectText}>Here&apos;s something I made:</p>
                                <div className={styles.projectsList}>
                                    {projects.length > 0 ? (
                                        projects
                                            .slice(0, 1)
                                            .map((project, index) => (
                                                <Project
                                                    project={project}
                                                    key={project.id || `${project.name}-${index}`}
                                                />
                                            ))
                                    ) : (
                                        <p className={styles.emptyState}>
                                            No public projects at the moment. Check back later! 🌱
                                        </p>
                                    )}
                                </div>
                                <div className={styles.footer}>
                                    <a
                                        href="https://github.com/zeyuyaoy"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={styles.viewMore}
                                    >
                                        View more projects on GitHub →
                                    </a>
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <div className={styles.loading}>
                        <p>Loading projects...</p>
                    </div>
                )}
            </div>
        </div>
    );
}
