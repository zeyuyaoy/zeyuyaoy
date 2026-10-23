"use client";

import dynamic from "next/dynamic";
import { type MouseEvent, type ReactNode, useRef, useState } from "react";
import { panelUrl, parseHomePanel } from "@/lib/home-panels";
import MusicOverlay from "./MusicOverlay";
import NotebookDialog from "./NotebookDialog";
import useHomeLocation, { navigateHome } from "./useHomeLocation";
import styles from "./Profile.module.css";

const ResearchPopup = dynamic(() => import("./research/ResearchPopup"), {
  loading: () => <p role="status">Loading research…</p>,
});
const sections = [
  { id: "about", label: "About Me" },
  { id: "research", label: "Research" },
  { id: "experience", label: "Experience" },
  { id: "education", label: "Education" },
  { id: "music", label: "Music" },
] as const;
const popupSections = sections.filter(
  (section) => section.id !== "about" && section.id !== "music",
);

export default function ProfileTabs({
  panels,
}: {
  panels: Record<"about" | "experience" | "education" | "music", ReactNode>;
}) {
  const current = useHomeLocation();
  const selected = parseHomePanel(new URL(current, "https://zeyuyaoy.com").search);
  const [musicOpen, setMusicOpen] = useState(false);
  const musicTrigger = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const title = sections.find((section) => section.id === selected)?.label ?? "";
  const selectedIndex = popupSections.findIndex((section) => section.id === selected);
  const previous = popupSections[(selectedIndex + popupSections.length - 1) % popupSections.length];
  const next = popupSections[(selectedIndex + 1) % popupSections.length];
  function close() {
    navigateHome(panelUrl(location.href, null));
  }
  function followPanelLink(event: MouseEvent<HTMLElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const link = (event.target as Element).closest("a");
    if (!link || link.target === "_blank" || link.hasAttribute("download")) {
      return;
    }
    const url = new URL(link.href, location.href);
    if (
      url.origin === location.origin &&
      url.pathname === "/" &&
      (parseHomePanel(url.search) || (selected && !url.search && !url.hash))
    ) {
      event.preventDefault();
      if (!selected) {
        opener.current = link;
      }
      if (selected === "research" && parseHomePanel(url.search) === "research") {
        const destination = new URL(location.href);
        destination.searchParams.delete("project");
        for (const key of new Set(url.searchParams.keys())) {
          const values = url.searchParams.getAll(key);
          destination.searchParams.set(key, values[0]);
          for (const value of values.slice(1)) {
            destination.searchParams.append(key, value);
          }
        }
        if (url.hash) {
          destination.hash = url.hash;
        }
        navigateHome(`${destination.pathname}${destination.search}${destination.hash}`);
      } else {
        navigateHome(`${url.pathname}${url.search}${url.hash}`);
      }
    }
  }
  return (
    <section
      className={styles.profile}
      aria-label="Profile"
      data-home-section="bio"
      onClickCapture={followPanelLink}
    >
      <div className={styles.header}>
        <div className={styles.windowDots} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <nav className={styles.tabs} aria-label="Profile sections">
          {sections.map((section) => (
            <button
              key={section.id}
              ref={(element) => {
                if (section.id === "music") {
                  musicTrigger.current = element;
                }
                if (section.id === selected && !opener.current) {
                  opener.current = element;
                }
              }}
              type="button"
              className={styles.tab}
              aria-label={section.label}
              aria-current={section.id === "about" ? "page" : undefined}
              aria-haspopup={
                section.id === "about" || section.id === "music" ? undefined : "dialog"
              }
              aria-expanded={
                section.id === "music"
                  ? musicOpen
                  : section.id === "about"
                    ? undefined
                    : selected === section.id
              }
              aria-controls={section.id === "music" && musicOpen ? "homepage-cassette" : undefined}
              onClick={(event) => {
                if (section.id === "music") {
                  setMusicOpen(true);
                  document
                    .querySelector<HTMLButtonElement>(
                      '#homepage-cassette button[aria-label="Change cassette finish"]',
                    )
                    ?.focus({ preventScroll: true });
                  return;
                }
                if (section.id === "about") {
                  close();
                  return;
                }
                opener.current = event.currentTarget;
                navigateHome(panelUrl(location.href, section.id));
              }}
            >
              {section.id === "music" ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              ) : (
                section.label
              )}
            </button>
          ))}
        </nav>
      </div>
      <div className={styles.aboutContent}>{panels.about}</div>
      <MusicOverlay open={musicOpen} onClose={() => setMusicOpen(false)} trigger={musicTrigger}>
        {panels.music}
      </MusicOverlay>
      {selected ? (
        <NotebookDialog
          title={title}
          onClose={close}
          returnFocus={opener}
          previousTitle={previous.label}
          nextTitle={next.label}
          onNavigate={(direction) => {
            const section =
              popupSections[
                (selectedIndex + direction + popupSections.length) % popupSections.length
              ];
            navigateHome(panelUrl(location.href, section.id));
          }}
        >
          {selected === "research" ? <ResearchPopup /> : panels[selected]}
        </NotebookDialog>
      ) : null}
    </section>
  );
}
