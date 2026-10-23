"use client";

import { ArrowLeft, Search } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectSummary } from "@/lib/research/archive";
import { site } from "@/lib/research/site";
import { NotebookActions } from "../NotebookDialog";
import StarryMotto from "./StarryMotto";

const CommandPalette = dynamic(() => import("./CommandPalette"));

export default function SiteHeader({
  projects,
  onTagSelect,
  onClearFilters,
  showIntro = false,
  active = true,
  backHref,
}: {
  projects: ProjectSummary[];
  onTagSelect?: (tag: string) => void;
  onClearFilters?: () => void;
  showIntro?: boolean;
  active?: boolean;
  backHref?: string;
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteReturnFocus = useRef<HTMLElement | null>(null);
  const closePalette = useCallback(() => setPaletteOpen(false), []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!active) {
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        if (document.querySelector(".filter-dialog[open], .command-dialog[open]")) {
          return;
        }
        event.preventDefault();
        paletteReturnFocus.current = document.activeElement as HTMLElement | null;
        setPaletteOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active]);
  return (
    <>
      <header className="site-header">
        {backHref ? (
          <Link prefetch={false} href={backHref} className="back-link">
            <ArrowLeft aria-hidden />
            All research
          </Link>
        ) : (
          <div className="site-brand">
            {showIntro ? (
              <h2>
                <Link prefetch={false} href="/?panel=research">
                  {site.name}
                </Link>
              </h2>
            ) : (
              <Link prefetch={false} href="/?panel=research">
                <strong>{site.name}</strong>
              </Link>
            )}
          </div>
        )}
        <NotebookActions active={active}>
          <nav aria-label="Research navigation">
            <Link prefetch={false} href="/" className="portfolio-link">
              Portfolio
            </Link>
            <button
              type="button"
              className="icon-button command-trigger"
              aria-label="Open command palette"
              aria-keyshortcuts="Meta+K Control+K"
              title="Search commands (⌘/Ctrl K)"
              aria-haspopup="dialog"
              aria-expanded={paletteOpen}
              onClick={(event) => {
                paletteReturnFocus.current = event.currentTarget;
                setPaletteOpen(true);
              }}
            >
              <Search aria-hidden />
            </button>
          </nav>
        </NotebookActions>
        {showIntro ? (
          <p className="archive-description">
            Research projects, publications, and the exploration behind them.
            <StarryMotto />
          </p>
        ) : null}
      </header>
      {paletteOpen ? (
        <CommandPalette
          open={paletteOpen}
          onClose={closePalette}
          returnFocusRef={paletteReturnFocus}
          projects={projects}
          onTagSelect={onTagSelect}
          onClearFilters={onClearFilters}
        />
      ) : null}
    </>
  );
}
