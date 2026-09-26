import styles from "./page.module.css";
import ProfileImage from "./components/ProfileImage";
import ProfilePic from "../../public/profile.jpg";
import ThemeProvider from "./components/ThemeProvider";
import Webring from "./components/Webring";
import AppearanceSettings from "./components/AppearanceSettings";

import SpotifyWidget from "./components/SpotifyWidget";
import Projects from "./components/Projects";

export const revalidate = 600;

export default function Home() {
    return (
        <div className={styles.page}>
            <main className={styles.main}>
                <div className={styles.contentContainer}>
                    <section className={styles.intro}>
                        <ProfileImage
                            className={styles.profileImage}
                            fallbackSrc={ProfilePic}
                            alt="Zeyu Yao's profile picture"
                            width={125}
                            height={125}
                        />
                        <div className={styles.introText}>
                            <h1 className={styles.name}>
                                <span>Zeyu Yao 姚则禹</span>
                                <ThemeProvider/>
                            </h1>
                            <p className={styles.subtitle}>
                                Currently serving National Service!
                            </p>
                            <div className={styles.socialMedia}>
                                <nav className={styles.socialMediaIcons} aria-label="Social profiles">
                                    <a
                                        href="https://github.com/zeyuyaoy"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <span
                                            role="img"
                                            aria-label="GitHub logo"
                                            className={`${styles.socialMediaIcon} ${styles.githubIcon}`}
                                        />
                                    </a>
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
                                </nav>
                                <a
                                    href="https://research.cytronicoder.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.blogWidget}
                                >
                                    Check out my research projects! →
                                </a>
                            </div>
                        </div>
                    </section>

                    <section className={styles.bio} aria-labelledby="research-heading">
                        <h2 id="research-heading" className={styles.bioHeading}>Hello! I&apos;m Peter.</h2>
                        <p className={styles.bioText}>
                            I love working on{" "}
                            <a href="https://research.cytronicoder.com/orcid-162573947" className={styles.link}
                               target="_blank" rel="noopener noreferrer">single-cell analytics</a>,{" "}
                            <a href="https://research.cytronicoder.com/biorsp-posters" className={styles.link}
                               target="_blank" rel="noopener noreferrer">gene-expression dynamics</a>, and{" "}
                            <a href="https://research.cytronicoder.com/garcia" className={styles.link} target="_blank"
                               rel="noopener noreferrer">AI-driven discovery tools</a>{" "}
                            to understand how complex cellular systems change, adapt, and break.
                            My work has been presented at IEEE BHI, GIW Asia, and ISMB/ECCB, among
                            other major bioinformatics conferences. I dabble in jazz guitar playing
                            and chess during my free time.
                        </p>
                        <p className={styles.bioText}>
                            I also care deeply about inclusive STEM education. My goal is to build{" "}
                            <a href="https://github.com/orgs/hackclub/repositories" className={styles.link}
                               target="_blank" rel="noopener noreferrer">tools</a>{" "}
                            and{" "}
                            <a href="https://ijhscommunity.org" className={styles.link} target="_blank"
                               rel="noopener noreferrer">communities</a>{" "}
                            that make computational education more accessible, equitable, and impactful for all.
                        </p>
                    </section>

                    <section className={styles.section}>
                        <Projects/>
                        <SpotifyWidget/>
                    </section>

                    <footer className={styles.footer}>
                        <Webring/>
                        <AppearanceSettings/>
                    </footer>
                </div>
            </main>
        </div>
    );
}
