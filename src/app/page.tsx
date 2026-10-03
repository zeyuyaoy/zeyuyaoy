import styles from "./page.module.css";
import ProfilePhoto from "./components/ProfilePhoto";
import ThemeProvider from "./components/ThemeProvider";
import Webrings from "./components/Webrings";
import AppearanceSettings from "./components/AppearanceSettings";
import StableHomeLayout from "./components/StableHomeLayout";

import SpotifyWidget from "./components/SpotifyWidget";
import Projects from "./components/Projects";
import PhotoMarqueeBackground from "./components/PhotoMarqueeBackground";
import PersonalConsoleRuntime from "./components/PersonalConsoleRuntime";
import { getGithubProjects, type ProjectData } from "@/lib/github";
import { failureCode } from "@/lib/upstream";
import { getWebrings } from "@/lib/webrings";

export const revalidate = 600;

export default async function Home() {
  const webrings = getWebrings();
  let projectData: ProjectData;
  try {
    projectData = {
      status: "ready",
      projects: (await getGithubProjects()).filter((project) => project.name !== "zeyuyaoy"),
    };
  } catch (error) {
    projectData = { status: "unavailable", projects: [] };
    console.warn("Portfolio upstream", {
      service: "github",
      state: "degraded",
      reason: failureCode(error),
    });
  }
  return (
    <div className={styles.page}>
      <PersonalConsoleRuntime data={projectData} />
      <PhotoMarqueeBackground />
      <main className={styles.main}>
        <StableHomeLayout className={styles.contentContainer}>
          <section className={styles.intro} data-home-section="intro">
            <ProfilePhoto />
            <div className={styles.introText}>
              <h1 className={styles.name}>
                <span>Zeyu Yao 姚则禹</span>
                <ThemeProvider />
              </h1>
              <p className={styles.subtitle}>
                Currently serving National Service! Soon-to-be Class of 2032 @ Carnegie Mellon
                University
              </p>
              <div className={styles.socialMedia}>
                <nav className={styles.socialMediaIcons} aria-label="Peter's social media profiles">
                  <a href="https://github.com/zeyuyaoy" target="_blank" rel="noopener noreferrer">
                    <span
                      role="img"
                      aria-label="GitHub logo"
                      className={`${styles.socialMediaIcon} ${styles.githubIcon}`}
                    />
                  </a>
                  <a href="https://twitter.com/zeyuyaoy" target="_blank" rel="noopener noreferrer">
                    <span
                      role="img"
                      aria-label="Twitter logo"
                      className={`${styles.socialMediaIcon} ${styles.twitterIcon}`}
                    />
                  </a>
                  <a
                    href="https://www.instagram.com/zeyuyaoy/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span
                      role="img"
                      aria-label="Instagram logo"
                      className={`${styles.socialMediaIcon} ${styles.instagramIcon}`}
                    />
                  </a>
                  <a
                    href="https://linkedin.com/in/zeyuyaoy"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span
                      role="img"
                      aria-label="LinkedIn logo"
                      className={`${styles.socialMediaIcon} ${styles.linkedinIcon}`}
                    />
                  </a>
                </nav>
                <a
                  href="https://research.zeyuyaoy.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.blogWidget}
                >
                  Check out my research projects! →
                </a>
              </div>
            </div>
          </section>

          <section
            className={styles.bio}
            aria-labelledby="research-heading"
            data-home-section="bio"
          >
            <h2 id="research-heading" className={styles.bioHeading}>
              Hello! I&apos;m Peter. I&apos;m interested in{" "}
              <a
                href="https://research.zeyuyaoy.com/garcia"
                className={styles.link}
                target="_blank"
                rel="noopener noreferrer"
              >
                using computational tools
              </a>{" "}
              (and{" "}
              <a
                href="https://research.zeyuyaoy.com/orcid-162573947"
                className={styles.link}
                target="_blank"
                rel="noopener noreferrer"
              >
                building new ones!
              </a>
              ) to{" "}
              <a
                href="https://research.zeyuyaoy.com/biorsp-posters"
                className={styles.link}
                target="_blank"
                rel="noopener noreferrer"
              >
                better understand
              </a>{" "}
              complex biological systems—how they change, adapt, and sometimes break down.
            </h2>

            <p className={styles.bioText}>
              Growing up in Singapore, I&apos;ve been fortunate to learn across many areas of STEM
              and from mentors who have shaped the way I think and work. Alongside research, I enjoy
              building{" "}
              <a
                href="https://ijhscommunity.org"
                className={styles.link}
                target="_blank"
                rel="noopener noreferrer"
              >
                inclusive communities
              </a>{" "}
              and helping more people{" "}
              <a
                href="https://buildingblocs.sg"
                className={styles.link}
                target="_blank"
                rel="noopener noreferrer"
              >
                learn
              </a>
              ,{" "}
              <a
                href="https://hackclub.com/"
                className={styles.link}
                target="_blank"
                rel="noopener noreferrer"
              >
                create
              </a>
              , and{" "}
              <a
                href="https://www.iscb.org/ybs2026/home"
                className={styles.link}
                target="_blank"
                rel="noopener noreferrer"
              >
                find opportunities
              </a>{" "}
              through computing.
            </p>

            <p className={styles.bioText}>
              Outside of research and building things, I enjoy playing jazz guitar, running,
              swimming, and photography.
            </p>
          </section>

          <section className={styles.section} data-home-section="widgets">
            <Projects data={projectData} />
            <SpotifyWidget />
          </section>

          <footer className={styles.footer} data-home-section="footer">
            <Webrings items={webrings} />
            <AppearanceSettings />
          </footer>
        </StableHomeLayout>
      </main>
    </div>
  );
}
