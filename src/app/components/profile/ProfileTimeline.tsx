import type { ExperienceEntry } from "@/lib/profile-content";
import ProfileLink from "./ProfileLink";
import ProfileMarkdown from "./ProfileMarkdown";
import styles from "../Profile.module.css";

export default function ProfileTimeline({
  entries,
  label,
}: {
  entries: readonly (ExperienceEntry & { subtitle?: string })[];
  label: string;
}) {
  return (
    <ol className={styles.timeline} aria-label={label} role="list">
      {entries.map((entry) => (
        <li key={entry.title}>
          <p className={styles.timelineDate}>{entry.dateLabel}</p>
          <div className={styles.timelineDetails}>
            <h3>
              {entry.href ? (
                <ProfileLink href={entry.href}>{entry.title}</ProfileLink>
              ) : (
                entry.title
              )}
            </h3>
            {entry.subtitle && <p className={styles.metadata}>{entry.subtitle}</p>}
            <ProfileMarkdown source={entry.body} />
          </div>
        </li>
      ))}
    </ol>
  );
}
