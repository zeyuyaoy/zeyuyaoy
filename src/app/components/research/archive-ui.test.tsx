import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseArchiveState, type ProjectSummary } from "@/lib/research/archive";
import SearchableProjects from "./SearchableProjects";
import CopyLinkButton from "./CopyLinkButton";

const initialState = parseArchiveState(new URLSearchParams());

const projects: ProjectSummary[] = [
  {
    slug: "atlas",
    target: "https://example.org",
    targetType: "website",
    shortUrl: "/research/atlas",
    detailUrl: "/?panel=research&project=atlas",
    title: "Protein atlas",
    description: "Spatial biology",
    tags: ["Biology"],
    researchAreas: ["Biology", "Spatial omics"],
    source: "manual",
    createdAt: "2024-01-01T00:00:00.000Z",
    startDate: "2023",
    endDate: "2024",
    githubRepo: null,
    photoSetId: null,
    organizations: [],
    artifacts: [
      {
        type: "website",
        title: "Open website",
        url: "https://example.org",
        date: null,
        venue: null,
        featured: true,
      },
    ],
    searchText: "atlas spatial biology institute",
  },
];

beforeEach(() => {
  window.history.replaceState({}, "", "/?panel=research");
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});

describe("archive interactions", () => {
  it("focuses search with slash and keeps filters in the URL", async () => {
    window.history.replaceState({}, "", "/?panel=research");
    const { container } = render(
      <SearchableProjects
        initialLinks={projects}
        availability="ready"
        initialState={initialState}
      />,
    );
    expect(within(container).getByRole("link", { name: "Research" })).toHaveAttribute(
      "href",
      "/?panel=research",
    );
    expect(
      within(container).getByRole("heading", { level: 2, name: "Research" }),
    ).toHaveTextContent("Research");
    expect(within(container).queryByRole("combobox", { name: "Sort by" })).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: "/" });
    const input = within(container).getByRole("searchbox");
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: "atlas" } });
    await waitFor(() => expect(window.location.search).toContain("q=atlas"));
    fireEvent.click(within(container).getAllByRole("button", { name: "Biology" })[0]);
    expect(window.location.search).toContain("tag=Biology");
    expect(container.querySelector(".archive-count")).toHaveTextContent("1 of 1 projects");
  });

  it("announces copy success and failure", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<CopyLinkButton path="/?panel=research&project=atlas" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() => expect(screen.getByText("Link copied")).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith("https://zeyuyaoy.com/?panel=research&project=atlas");
    writeText.mockRejectedValueOnce(new Error("Clipboard denied"));
    fireEvent.click(screen.getByRole("button", { name: "Copy link, copied" }));
    await waitFor(() => expect(screen.getByText("Unable to copy link")).toBeInTheDocument());
  });

  it.each([
    ["ready", "No projects are available yet."],
    ["unconfigured", "The research directory is not configured yet."],
    ["unavailable", "The research directory is temporarily unavailable. Please try again later."],
  ] as const)("distinguishes the %s directory state", (availability, message) => {
    render(
      <SearchableProjects
        initialLinks={[]}
        availability={availability}
        initialState={initialState}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(message);
  });
});

describe("archive integration regressions", () => {
  it("preserves sorting and view state and restores the archive on history navigation", async () => {
    window.history.replaceState({}, "", "/?panel=research");
    render(
      <SearchableProjects
        initialLinks={projects}
        availability="ready"
        initialState={initialState}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "Sort by" }), {
      target: { value: "title-asc" },
    });
    expect(window.location.search).not.toContain("sort=");
    fireEvent.click(screen.getByRole("button", { name: "Show 1 project" }));
    expect(window.location.search).toContain("sort=title-asc");
    fireEvent.click(screen.getByRole("button", { name: "Timeline" }));
    expect(window.location.search).toContain("view=timeline");
    window.history.replaceState({}, "", "/research?q=atlas&tag=Biology");
    fireEvent.popState(window);
    expect(screen.getByRole("searchbox")).toHaveValue("atlas");
    expect(screen.getByRole("button", { name: "Projects" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getAllByRole("button", { name: "Biology", pressed: true })).not.toHaveLength(0);
  });

  it("includes search in filter counts and applies the same results", () => {
    render(
      <SearchableProjects
        initialLinks={projects}
        availability="ready"
        initialState={{ ...initialState, query: "unmatched" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
    expect(screen.getByRole("button", { name: "Show 0 projects" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show 0 projects" }));
    expect(screen.getByRole("heading", { name: "No matching research" })).toBeInTheDocument();
  });

  it("discards cancelled sorting and preserves committed sorting when clearing filters", () => {
    render(
      <SearchableProjects
        initialLinks={projects}
        availability="ready"
        initialState={{ ...initialState, sort: "oldest", tags: ["Biology"] }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "Sort by" }), {
      target: { value: "title-desc" },
    });
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: true, cancelable: true }));
    fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
    expect(screen.getByRole("combobox", { name: "Sort by" })).toHaveValue("oldest");
    fireEvent.change(screen.getByRole("combobox", { name: "Sort by" }), {
      target: { value: "title-asc" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Close filters" }));
    fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
    expect(screen.getByRole("combobox", { name: "Sort by" })).toHaveValue("oldest");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Clear all" }));
    expect(window.location.search).toBe("?panel=research&sort=oldest");
    expect(screen.getByRole("button", { name: /^Filters/ })).toHaveTextContent(/^Filters$/);
  });

  it.each([4, 5, 7])(
    "counts hidden topics without changing card indicators (%i topics)",
    (count) => {
      const topics = Array.from({ length: count }, (_, index) => `Topic ${index + 1}`);
      render(
        <SearchableProjects
          initialLinks={[{ ...projects[0], researchAreas: topics }]}
          availability="ready"
          initialState={initialState}
        />,
      );
      const overflow = screen.queryByRole("button", {
        name: /^\+\d+ topics? — show all topics$/,
      });
      if (count === 4) {
        expect(overflow).not.toBeInTheDocument();
      } else {
        expect(overflow).toHaveTextContent(`+${count - 4} ${count === 5 ? "topic" : "topics"}`);
        expect(
          screen.getByText(`+${count - 4}`, { selector: ".tag-row > span" }),
        ).toBeInTheDocument();
        fireEvent.click(overflow!);
        expect(
          screen.getByRole("dialog", { name: "Filter and sort research" }),
        ).toBeInTheDocument();
        expect(screen.getAllByRole("checkbox")).toHaveLength(count);
      }
    },
  );

  it("exposes every collection output, including the fifth and later entries", () => {
    const members = Array.from({ length: 6 }, (_, i) => ({
      ...projects[0],
      slug: `atlas-${i}`,
      title: `Study ${i + 1}`,
      detailUrl: `/?panel=research&project=atlas-${i}`,
    }));
    render(
      <SearchableProjects
        initialLinks={members}
        initialCollections={[
          {
            id: "atlas",
            name: "Atlas collection",
            description: "Research outputs",
            projects: members.map((p) => p.slug),
            tags: [],
            createdAt: "2025-01-01",
            updatedAt: null,
          },
        ]}
        availability="ready"
        initialState={initialState}
      />,
    );
    const outputLinks = screen.getAllByRole("link", { name: "Study 6" });
    expect(outputLinks).toHaveLength(2);
    outputLinks.forEach((link) =>
      expect(link).toHaveAttribute("href", "/?panel=research&project=atlas-5"),
    );
  });
});
