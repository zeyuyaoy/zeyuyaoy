import { loadProfileContent } from "@/lib/load-profile-content";
import ProfileTabs from "./ProfileTabs";
import AboutPanel from "./profile/AboutPanel";
import ExperiencePanel from "./profile/ExperiencePanel";
import EducationPanel from "./profile/EducationPanel";

export default async function Profile() {
  const content = await loadProfileContent();
  return (
    <ProfileTabs
      panels={{
        about: <AboutPanel markdown={content.about} />,
        experience: <ExperiencePanel entries={content.experience} />,
        education: <EducationPanel groups={content.education} />,
      }}
    />
  );
}
