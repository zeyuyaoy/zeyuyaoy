import styles from "./page.module.css";
import ProfilePhoto from "./components/ProfilePhoto";
import Profile from "./components/Profile";
import ThemeProvider from "./components/ThemeProvider";
import Webrings from "./components/Webrings";
import AppearanceSettings from "./components/AppearanceSettings";
import StableHomeLayout from "./components/StableHomeLayout";

import SpotifyWidget from "./components/SpotifyWidget";
import PhotoMarqueeBackground from "./components/PhotoMarqueeBackground";
import { createPhotoMarqueeQueues } from "./components/photoMarqueeData";
import PersonalConsoleRuntime from "./components/PersonalConsoleRuntime";
import { webrings } from "@/lib/webrings";
import { loadProfileContent } from "@/lib/load-profile-content";

export const revalidate = 600;

export default function Home() {
  const profileContent = loadProfileContent();
  const photoQueues = createPhotoMarqueeQueues(profileContent);
  return (
    <div className={styles.page}>
      <PersonalConsoleRuntime />
      <>
        <PhotoMarqueeBackground photos={photoQueues.about} section="about" />
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
                  <nav
                    className={styles.socialMediaIcons}
                    aria-label="Peter's social media profiles"
                  >
                    <a
                      href="https://twitter.com/zeyuyaoy"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
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
                    <a href="https://github.com/zeyuyaoy" target="_blank" rel="noopener noreferrer">
                      <span
                        role="img"
                        aria-label="GitHub logo"
                        className={`${styles.socialMediaIcon} ${styles.githubIcon}`}
                      />
                    </a>
                  </nav>
                </div>
              </div>
            </section>

            <Profile content={profileContent} photos={photoQueues} music={<SpotifyWidget />} />

            <footer className={styles.footer} data-home-section="footer">
              <Webrings items={webrings} />
              <AppearanceSettings />
            </footer>
          </StableHomeLayout>
        </main>
      </>
    </div>
  );
}
