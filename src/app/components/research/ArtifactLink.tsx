import {
  Award,
  BookOpen,
  Code2,
  Database,
  ExternalLink,
  FileImage,
  FileText,
  Mic2,
  PlayCircle,
  Presentation,
} from "lucide-react";
import type { ArtifactType, ProjectArtifact } from "@/lib/research/models";

const ICONS: Record<ArtifactType, typeof FileText> = {
  publication: BookOpen,
  preprint: FileText,
  poster: FileImage,
  talk: Mic2,
  presentation: Presentation,
  award: Award,
  code: Code2,
  dataset: Database,
  video: PlayCircle,
  file: FileText,
  website: ExternalLink,
  other: FileText,
};

function artifactProvider(artifact: ProjectArtifact) {
  if (artifact.venue) {
    return artifact.venue;
  }
  if (!artifact.url) {
    return null;
  }
  try {
    const host = new URL(artifact.url).hostname.replace(/^www\./, "");
    if (host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com")) {
      return "YouTube";
    }
    if (host === "github.com") {
      return "GitHub";
    }
    if (host === "doi.org") {
      return "DOI";
    }
    return host;
  } catch {
    return null;
  }
}

export default function ArtifactLink({
  artifact,
  compact = false,
}: {
  artifact: ProjectArtifact;
  compact?: boolean;
}) {
  const Icon = ICONS[artifact.type];
  const provider = artifactProvider(artifact);
  const content = (
    <>
      <Icon aria-hidden />
      <span className="artifact-copy">
        <strong>{artifact.title}</strong>
        {!compact && provider ? <small>{provider}</small> : null}
      </span>
      {artifact.url ? <ExternalLink aria-hidden className="artifact-external" /> : null}
    </>
  );
  return artifact.url ? (
    <a
      className={`artifact-link ${compact ? "artifact-link-compact" : ""}`}
      href={artifact.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {content}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  ) : (
    <div className={`artifact-link ${compact ? "artifact-link-compact" : ""}`}>{content}</div>
  );
}
