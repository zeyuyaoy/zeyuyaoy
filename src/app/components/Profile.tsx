import type { ReactNode } from "react";
import type { ProfileContent } from "@/lib/profile-content";
import PhotoMarqueeBackground from "./PhotoMarqueeBackground";
import type { PhotoMarqueeQueues } from "./photoMarqueeData";
import ProfileTabs from "./ProfileTabs";
import ProfileMarkdown from "./profile/ProfileMarkdown";
import ExperiencePanel from "./profile/ExperiencePanel";
import EducationTimeline from "./profile/EducationTimeline";
import styles from "./Profile.module.css";

export default function Profile({
  content,
  music,
  photos,
}: {
  content: ProfileContent;
  music: ReactNode;
  photos: PhotoMarqueeQueues;
}) {
  return (
    <ProfileTabs
      panels={{
        about: (
          <div className={styles.stack}>
            <ProfileMarkdown source={content.about} introduction />
          </div>
        ),
        experience: (
          <div className={styles.detailPanel}>
            <PhotoMarqueeBackground photos={photos.experience} section="experience" inline />
            <ExperiencePanel entries={content.experience} />
          </div>
        ),
        education: (
          <div className={styles.detailPanel}>
            <PhotoMarqueeBackground photos={photos.education} section="education" inline />
            <EducationTimeline group={content.education} />
          </div>
        ),
        music,
      }}
    />
  );
}
