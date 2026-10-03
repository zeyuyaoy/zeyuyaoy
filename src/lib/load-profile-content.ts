import "server-only";
import about from "@/content/profile/about.md";
import experience from "@/content/profile/experience.md";
import education from "@/content/profile/education.md";
import {
  parseAbout,
  parseEducation,
  parseExperience,
  type ProfileContent,
} from "./profile-content";

export async function loadProfileContent(): Promise<ProfileContent> {
  return {
    about: parseAbout(about),
    experience: parseExperience(experience),
    education: parseEducation(education),
  };
}
