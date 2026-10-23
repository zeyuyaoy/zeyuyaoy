"use client";

import { Code2, ExternalLink, FileText, FilterX, Moon, Search, Tag, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { navigateHome } from "../useHomeLocation";
import { compareProjectSummaries, type ProjectSummary } from "@/lib/research/archive";
import { appearanceStore } from "@/lib/theme-store";
import { site } from "@/lib/research/site";

type PaletteItem = {
  id: string;
  group: "Projects" | "Filter by research area" | "Actions" | "External links";
  label: string;
  detail?: string;
  icon: typeof FileText;
  run: () => void;
};

const EXTERNAL_LINKS = [
  { label: "Resume", href: site.resumeUrl },
  { label: "GitHub", href: site.githubUrl },
  { label: "Portfolio", href: "/" },
];

export default function CommandPalette({
  open,
  onClose,
  projects,
  onTagSelect,
  onClearFilters,
  returnFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  projects: ProjectSummary[];
  onTagSelect?: (tag: string) => void;
  onClearFilters?: () => void;
  returnFocusRef?: { readonly current: HTMLElement | null };
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const dismiss = useCallback(() => {
    const previous = previousFocus.current;
    if (dialogRef.current?.open) {
      dialogRef.current.close();
    }
    onClose();
    window.setTimeout(() => previous?.focus(), 0);
  }, [onClose]);

  const items = (() => {
    const q = query.trim().toLowerCase();
    const closeThen = (run: () => void) => () => {
      onClose();
      run();
    };
    const projectItems: PaletteItem[] = projects
      .filter((project) => !q || q.split(/\s+/).every((term) => project.searchText.includes(term)))
      .toSorted((a, b) => compareProjectSummaries(a, b, "newest"))
      .slice(0, q ? 6 : 3)
      .map((project) => ({
        id: `project:${project.slug}`,
        group: "Projects",
        label: project.title,
        detail: [
          project.endDate || project.startDate,
          project.researchAreas.slice(0, 2).join(" · "),
        ]
          .filter(Boolean)
          .join(" · "),
        icon: FileText,
        run: closeThen(() => {
          const url = new URL(window.location.href);
          url.searchParams.set("panel", "research");
          url.searchParams.set("project", project.slug);
          navigateHome(`${url.pathname}${url.search}${url.hash}`);
        }),
      }));
    const tags = Array.from(new Set(projects.flatMap((project) => project.researchAreas)))
      .filter((tag) => !q || tag.toLowerCase().includes(q))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, q ? 6 : 3);
    const tagItems: PaletteItem[] = tags.map((value) => ({
      id: `tag:${value}`,
      group: "Filter by research area",
      label: value,
      icon: Tag,
      run: closeThen(() =>
        onTagSelect
          ? onTagSelect(value)
          : navigateHome(`/?panel=research&tag=${encodeURIComponent(value)}`),
      ),
    }));
    const actions: PaletteItem[] = (
      [
        {
          id: "clear",
          group: "Actions",
          label: "Clear all filters",
          icon: FilterX,
          run: closeThen(() =>
            onClearFilters ? onClearFilters() : navigateHome("/?panel=research"),
          ),
        },
        {
          id: "theme",
          group: "Actions",
          label: `Switch to ${appearanceStore.getSnapshot().resolvedMode === "dark" ? "light" : "dark"} theme`,
          icon: Moon,
          run: closeThen(appearanceStore.toggle),
        },
      ] satisfies PaletteItem[]
    ).filter((item) => !q || item.label.toLowerCase().includes(q));
    const links: PaletteItem[] = EXTERNAL_LINKS.filter(
      (link) => !q || link.label.toLowerCase().includes(q),
    ).map((link) => ({
      id: `link:${link.label}`,
      group: "External links",
      label: link.label,
      icon: link.label === "GitHub" ? Code2 : ExternalLink,
      run: closeThen(() =>
        link.label === "Portfolio"
          ? navigateHome("/")
          : window.open(link.href, "_blank", "noopener,noreferrer"),
      ),
    }));
    return [...projectItems, ...tagItems, ...actions, ...links];
  })();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    if (open && !dialog.open) {
      previousFocus.current =
        returnFocusRef?.current ?? (document.activeElement as HTMLElement | null);
      dialog.showModal();
      document.body.style.overflow = "hidden";
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } else if (!open && dialog.open) {
      dialog.close();
    }
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus.current?.focus();
    };
  }, [open, returnFocusRef]);

  const groups = ["Projects", "Filter by research area", "Actions", "External links"] as const;
  return (
    <dialog
      ref={dialogRef}
      className="command-dialog"
      aria-label="Research command palette"
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
    >
      <div className="command-search">
        <Search aria-hidden />
        <label className="sr-only" htmlFor="command-search">
          Search projects or run a command
        </label>
        <input
          ref={inputRef}
          id="command-search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          placeholder="Search projects or run a command…"
          autoComplete="off"
          role="combobox"
          aria-expanded="true"
          aria-controls="command-results"
          aria-activedescendant={items[active]?.id}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const next = Math.max(
                0,
                Math.min(active + (event.key === "ArrowDown" ? 1 : -1), items.length - 1),
              );
              setActive(next);
              if (items[next]) {
                document.getElementById(items[next].id)?.scrollIntoView({ block: "nearest" });
              }
            }
            if (event.key === "Enter" && items[active]) {
              event.preventDefault();
              items[active].run();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              dismiss();
            }
          }}
        />
        <button
          type="button"
          className="icon-button command-close"
          aria-label="Close command palette"
          title="Close (Esc)"
          onClick={dismiss}
        >
          <X aria-hidden />
        </button>
      </div>
      <div id="command-results" role="listbox" className="command-results">
        {groups.map((group) => {
          const entries = items.filter((item) => item.group === group);
          if (!entries.length) {
            return null;
          }
          return (
            <section key={group} aria-labelledby={`command-${group.replaceAll(" ", "-")}`}>
              <h2 id={`command-${group.replaceAll(" ", "-")}`}>{group}</h2>
              {entries.map((item) => {
                const index = items.indexOf(item);
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    id={item.id}
                    type="button"
                    role="option"
                    aria-selected={index === active}
                    className="command-item"
                    onMouseEnter={() => setActive(index)}
                    onClick={item.run}
                  >
                    <Icon aria-hidden />
                    <span>
                      <strong>{item.label}</strong>
                      {item.detail ? <small>{item.detail}</small> : null}
                    </span>
                    {item.group === "External links" ? (
                      <ExternalLink aria-hidden className="command-trailing" />
                    ) : null}
                  </button>
                );
              })}
            </section>
          );
        })}
        {!items.length ? <p className="command-empty">No matching projects or commands.</p> : null}
      </div>
      <footer className="command-help">
        <span>↑↓ Navigate</span>
        <span>↵ Select</span>
        <span>Esc Close</span>
      </footer>
    </dialog>
  );
}
