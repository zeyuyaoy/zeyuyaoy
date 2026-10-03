import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  parseAbout,
  parseEducation,
  parseExperience,
  type ProfileContent,
} from "./profile-content";

export async function loadProfileContent(): Promise<ProfileContent> {
  const directory = path.join(process.cwd(), "src/content/profile");
  const [about, experience, education] = await Promise.all(
    ["about.md", "experience.md", "education.md"].map((file) =>
      readFile(path.join(directory, file), "utf8"),
    ),
  );
  return {
    about: parseAbout(about),
    experience: parseExperience(experience),
    education: parseEducation(education),
  };
}
