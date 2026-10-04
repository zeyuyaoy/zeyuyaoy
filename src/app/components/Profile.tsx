import type { ProfileContent } from "@/lib/profile-content";
import ProfileTabs from "./ProfileTabs";
import ProfileMarkdown from "./profile/ProfileMarkdown";
import ExperiencePanel from "./profile/ExperiencePanel";
import EducationTimeline from "./profile/EducationTimeline";
import styles from "./Profile.module.css";

export default function Profile({ content }: { content: ProfileContent }) {
  return (
    <ProfileTabs
      panels={{
        about: (
          <div className={styles.stack}>
            <ProfileMarkdown source={content.about} introduction />
          </div>
        ),
        experience: <ExperiencePanel entries={content.experience} />,
        education: <EducationTimeline group={content.education} />,
      }}
    />
  );
}
