import type { ProfileEntry } from "@/lib/profile-content";
import ProfileCarousel from "../ProfileCarousel";
import ProfileLink from "./ProfileLink";
import ProfileMarkdown from "./ProfileMarkdown";
import styles from "../Profile.module.css";

export default function ExperiencePanel({ entries }: { entries: readonly ProfileEntry[] }) {
  return (
    <ProfileCarousel
      label="Experience highlights"
      itemLabel="experience"
      items={entries.map((entry) => ({
        title: entry.title,
        content: (
          <div className={styles.experienceContent}>
            <h3>
              {entry.href ? (
                <ProfileLink href={entry.href}>{entry.title}</ProfileLink>
              ) : (
                entry.title
              )}
            </h3>
            <ProfileMarkdown source={entry.body} />
          </div>
        ),
      }))}
    />
  );
}
