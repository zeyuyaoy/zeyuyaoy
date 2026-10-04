import type { EducationGroup } from "@/lib/profile-content";
import ProfileCarousel from "../ProfileCarousel";
import ProfileLink from "./ProfileLink";
import ProfileMarkdown from "./ProfileMarkdown";
import styles from "../Profile.module.css";

export default function EducationTimeline({ group }: { group: EducationGroup }) {
  return (
    <ProfileCarousel
      label={group.title}
      itemLabel="formal education entry"
      items={group.entries.map((entry, index) => ({
        title: entry.title,
        content: (
          <ol className={styles.timeline} start={index + 1} aria-label={group.title}>
            <li>
              <p className={styles.timelineDate}>{entry.dateLabel}</p>
              <h3>
                {entry.href ? (
                  <ProfileLink href={entry.href}>{entry.title}</ProfileLink>
                ) : (
                  entry.title
                )}
              </h3>
              {entry.subtitle && <p className={styles.metadata}>{entry.subtitle}</p>}
              <ProfileMarkdown source={entry.body} />
            </li>
          </ol>
        ),
      }))}
    />
  );
}
