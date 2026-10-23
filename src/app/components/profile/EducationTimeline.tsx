import type { EducationGroup } from "@/lib/profile-content";
import ProfileTimeline from "./ProfileTimeline";

export default function EducationTimeline({ group }: { group: EducationGroup }) {
  return <ProfileTimeline label={group.title} entries={group.entries} />;
}
