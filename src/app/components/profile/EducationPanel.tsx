import type { EducationGroup } from "@/lib/profile-content";
import EducationTimeline from "./EducationTimeline";
import styles from "../Profile.module.css";

export default function EducationPanel({
  groups,
}: {
  groups: readonly [EducationGroup, EducationGroup];
}) {
  return (
    <div className={styles.educationColumns}>
      <EducationTimeline group={groups[0]} itemLabel="formal education entry" />
      <EducationTimeline group={groups[1]} itemLabel="summer experience" />
    </div>
  );
}
