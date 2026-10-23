import { ArrowUpRight } from "lucide-react";
import { site } from "@/lib/research/site";
import AppearanceSettings from "../AppearanceSettings";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <nav aria-label="More from Peter">
        <a href={site.resumeUrl}>
          Resume
          <ArrowUpRight aria-hidden />
        </a>
        <a href={site.githubUrl} target="_blank" rel="noopener noreferrer">
          GitHub
          <ArrowUpRight aria-hidden />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </nav>
      <AppearanceSettings showPhotoControls={false} />
    </footer>
  );
}
