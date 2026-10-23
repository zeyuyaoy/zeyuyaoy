import type { ExperienceEntry } from "@/lib/profile-content";
import ProfileTimeline from "./ProfileTimeline";

export default function ExperiencePanel({ entries }: { entries: readonly ExperienceEntry[] }) {
  return <ProfileTimeline label="Experience timeline" entries={entries} />;
}
