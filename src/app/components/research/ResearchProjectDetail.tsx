"use client";

import { ArrowUpRight, CalendarDays, FlaskConical, Users } from "lucide-react";
import Link from "next/link";
import ArtifactLink from "./ArtifactLink";
import ConferenceCarousel from "./ConferenceCarousel";
import CopyLinkButton from "./CopyLinkButton";
import SiteHeader from "./SiteHeader";
import { archiveTagPath } from "@/lib/research/paths";
import { effectiveArtifacts, type ProjectSummary, relatedProjects } from "@/lib/research/archive";
import type { PhotoSet } from "@/lib/research/conferenceSlides";
import {
  artifactTypeLabel,
  formatResearchDateRange,
  type PublicProject,
} from "@/lib/research/models";

export default function ResearchProjectDetail({
  project,
  summary,
  allSummaries,
  photoSet,
  archiveUrl,
}: {
  project: PublicProject;
  summary: ProjectSummary;
  allSummaries: ProjectSummary[];
  photoSet?: PhotoSet;
  archiveUrl: string;
}) {
  const related = relatedProjects(summary, allSummaries);
  const artifacts = effectiveArtifacts(project);
  const date = formatResearchDateRange(project.startDate, project.endDate);
  const areas = Array.from(new Set([...project.researchAreas, ...project.tags]));
  const methods = [...project.methods, ...project.technologies];
  return (
    <>
      <SiteHeader projects={allSummaries} backHref={archiveUrl} />
      <section aria-label="Research project details" className="project-detail">
        <header className="detail-hero">
          <div className="detail-kicker">Research project</div>
          <h2 tabIndex={-1} data-project-title>
            {project.title}
          </h2>
          {project.description ? <p className="detail-lede">{project.description}</p> : null}
          {date || project.organizations.length ? (
            <div className="detail-meta">
              {date ? (
                <span>
                  <CalendarDays aria-hidden />
                  {date}
                </span>
              ) : null}
              {project.organizations.map((organization) => (
                <span key={organization.name}>{organization.name}</span>
              ))}
            </div>
          ) : null}
          {areas.length ? (
            <div className="tag-row detail-tags">
              {areas.map((tag) => (
                <Link prefetch={false} key={tag} href={archiveTagPath(archiveUrl, tag)}>
                  {tag}
                </Link>
              ))}
            </div>
          ) : null}
          <div className="detail-actions">
            <a
              href={project.target}
              target="_blank"
              rel="noopener noreferrer"
              className="primary-button"
            >
              Open {artifactTypeLabel(project.targetType)} <ArrowUpRight aria-hidden />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <CopyLinkButton path={summary.detailUrl} />
          </div>
        </header>

        <div className="detail-layout">
          <div className="detail-main">
            {project.longDescription ? (
              <section>
                <h2>About this research</h2>
                <div className="prose-copy">
                  {project.longDescription
                    .split("\n")
                    .map((line, index) => (line ? <p key={index}>{line}</p> : null))}
                </div>
              </section>
            ) : null}
            {photoSet?.slides.length ? (
              <section>
                <h2>Project gallery</h2>
                <ConferenceCarousel slides={photoSet.slides} caption={photoSet.title} />
              </section>
            ) : null}
            {artifacts.length ? (
              <section>
                <h2>Research outputs</h2>
                <div className="artifact-grid">
                  {artifacts.map((artifact) => (
                    <ArtifactLink
                      key={`${artifact.type}:${artifact.title}:${artifact.url}`}
                      artifact={artifact}
                    />
                  ))}
                </div>
              </section>
            ) : null}
            {project.collaborators.length ? (
              <section>
                <h2>Collaborators</h2>
                <div className="people-list">
                  {project.collaborators.map((person) => (
                    <div key={person.name}>
                      <Users aria-hidden />
                      <p>
                        <strong>{person.name}</strong>
                        {person.role ? <span>{person.role}</span> : null}
                      </p>
                      {person.url ? (
                        <a href={person.url} target="_blank" rel="noopener noreferrer">
                          Profile <ArrowUpRight aria-hidden />
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
          <aside className="detail-aside" aria-label="Project facts">
            {areas.length ? (
              <section>
                <h2>Research areas</h2>
                <ul>
                  {areas.map((area) => (
                    <li key={area}>
                      <Link prefetch={false} href={archiveTagPath(archiveUrl, area)}>
                        {area}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {methods.length ? (
              <section>
                <h2>
                  <FlaskConical aria-hidden />
                  Methods &amp; technologies
                </h2>
                <ul>
                  {methods.map((method) => (
                    <li key={method}>{method}</li>
                  ))}
                </ul>
              </section>
            ) : null}
            {project.organizations.length ? (
              <section>
                <h2>Organizations</h2>
                <ul>
                  {project.organizations.map((organization) => (
                    <li key={organization.name}>
                      {organization.url ? (
                        <a href={organization.url} target="_blank" rel="noopener noreferrer">
                          {organization.name}
                        </a>
                      ) : (
                        organization.name
                      )}
                      {organization.role ? <small>{organization.role}</small> : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </aside>
        </div>

        {related.length ? (
          <section className="related-research">
            <div>
              <p className="section-kicker">Continue exploring</p>
              <h2>Related research</h2>
            </div>
            <div className="related-grid">
              {related.map((item) => (
                <Link prefetch={false} key={item.slug} href={item.detailUrl}>
                  <span>
                    {item.researchAreas
                      .filter((area) =>
                        areas.some((value) => value.toLowerCase() === area.toLowerCase()),
                      )
                      .slice(0, 2)
                      .join(" · ")}
                  </span>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                  <em>
                    View project <ArrowUpRight aria-hidden />
                  </em>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </>
  );
}
