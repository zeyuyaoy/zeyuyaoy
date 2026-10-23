import "server-only";
import fs from "node:fs";
import path from "node:path";
import { load as loadYaml } from "js-yaml";
import { isValidDate, normalizeTags } from "./models";

export interface Slide {
  src: string;
  alt: string;
  caption?: string;
  date?: string;
}

export interface PhotoSet {
  id: string;
  title?: string;
  description?: string;
  date?: string;
  tags?: string[];
  slides: Slide[];
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function parsePhotoSets(value: unknown): Record<string, PhotoSet> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("photoSets.yml must contain a mapping");
  }
  const result: Record<string, PhotoSet> = {};
  for (const [rawKey, rawValue] of Object.entries(value)) {
    if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
      throw new Error(`photo set ${rawKey} must be a mapping`);
    }
    const item = rawValue as Record<string, unknown>;
    if (!Array.isArray(item.slides) || item.slides.length === 0) {
      throw new Error(`photo set ${rawKey} must include slides`);
    }
    const slides = item.slides
      .map((rawSlide, index): Slide => {
        if (!rawSlide || typeof rawSlide !== "object" || Array.isArray(rawSlide)) {
          throw new Error(`slide ${index + 1} in ${rawKey} must be a mapping`);
        }
        const slide = rawSlide as Record<string, unknown>;
        const src = optionalText(slide.src);
        const alt = optionalText(slide.alt);
        const date = optionalText(slide.date);
        if (!src?.startsWith("/") || !alt) {
          throw new Error(
            `slide ${index + 1} in ${rawKey} requires an absolute src and descriptive alt`,
          );
        }
        if (date && !isValidDate(date)) {
          throw new Error(`slide ${index + 1} in ${rawKey} has an invalid ISO date`);
        }
        return { src, alt, caption: optionalText(slide.caption), date };
      })
      .toSorted((a, b) => (b.date || "").localeCompare(a.date || "") || a.src.localeCompare(b.src));
    const key = rawKey.toLowerCase();
    const date = optionalText(item.date);
    if (date && !isValidDate(date)) {
      throw new Error(`photo set ${rawKey} has an invalid ISO date`);
    }
    result[key] = {
      id: optionalText(item.id) || key,
      title: optionalText(item.title),
      description: optionalText(item.description),
      date,
      tags: normalizeTags(item.tags),
      slides,
    };
  }
  return result;
}

const photoSetsFile = path.join(process.cwd(), "src", "content", "research", "photoSets.yml");
let photoSets: Record<string, PhotoSet> = {};
try {
  photoSets = parsePhotoSets(loadYaml(fs.readFileSync(photoSetsFile, "utf8")));
} catch (error) {
  console.error("Failed to load photoSets.yml:", error);
}

export function getPhotoSet(key?: string) {
  return key ? photoSets[key.toLowerCase()] : undefined;
}
