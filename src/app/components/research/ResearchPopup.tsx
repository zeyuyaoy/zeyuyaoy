"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { parseArchiveState } from "@/lib/research/archive";
import type { ResearchPresentation } from "@/lib/research/presentation";
import useHomeLocation from "../useHomeLocation";
import ResearchProjectDetail from "./ResearchProjectDetail";
import SearchableProjects from "./SearchableProjects";
import "../../research/research.css";

export default function ResearchPopup() {
  const current = useHomeLocation();
  const url = new URL(current, "https://zeyuyaoy.com");
  const slug = url.searchParams.get("project");
  const hash = url.hash;
  url.searchParams.delete("project");
  const archiveUrl = `${url.pathname}${url.search}${url.hash}`;
  const [data, setData] = useState<ResearchPresentation | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const archiveScroll = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/research/presentation", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Research unavailable");
        }
        return response.json() as Promise<ResearchPresentation>;
      })
      .then((payload) => {
        setData(payload);
        setFailed(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFailed(true);
        }
      });
    return () => controller.abort();
  }, [attempt]);
  useLayoutEffect(() => {
    const viewport = root.current?.closest<HTMLElement>("[data-notebook-body]");
    if (!viewport) {
      return;
    }
    viewport.scrollTop = slug ? 0 : archiveScroll.current;
    if (slug && data) {
      root.current
        ?.querySelector<HTMLElement>("[data-project-title]")
        ?.focus({ preventScroll: true });
    } else if (data && hash) {
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (target && root.current?.contains(target)) {
        viewport.scrollTop +=
          target.getBoundingClientRect().top - viewport.getBoundingClientRect().top;
      }
    }
    const remember = () => {
      if (!slug) {
        archiveScroll.current = viewport.scrollTop;
      }
    };
    viewport.addEventListener("scroll", remember);
    return () => viewport.removeEventListener("scroll", remember);
  }, [slug, data, hash]);
  const summaries = useMemo(() => data?.projects.map((project) => project.summary) ?? [], [data]);
  const project = data?.projects.find((project) => project.detail.slug === slug);
  return (
    <div ref={root} className="research-scope research-popup">
      {failed || data?.availability === "unconfigured" ? (
        <div className="empty-state" role="status">
          <h3>Research is unavailable right now.</h3>
          <p>Please try again in a moment.</p>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setFailed(false);
              setData(null);
              setAttempt((value) => value + 1);
            }}
          >
            Retry research
          </button>
        </div>
      ) : !data ? (
        <p role="status">Loading research…</p>
      ) : (
        <>
          <div hidden={!!slug}>
            <SearchableProjects
              initialLinks={summaries}
              initialCollections={data.collections}
              availability={data.availability}
              initialState={parseArchiveState(url.searchParams)}
              active={!slug}
            />
          </div>
          {slug ? (
            project ? (
              <ResearchProjectDetail
                project={project.detail}
                summary={project.summary}
                allSummaries={summaries}
                photoSet={project.photoSet}
                archiveUrl={archiveUrl}
              />
            ) : (
              <div className="empty-state">
                <h3 data-project-title tabIndex={-1}>
                  Project not found
                </h3>
                <p>This research project is no longer available.</p>
                <a href={archiveUrl} className="back-link">
                  All research
                </a>
              </div>
            )
          ) : null}
        </>
      )}
    </div>
  );
}
