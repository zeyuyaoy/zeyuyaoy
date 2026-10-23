import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PublicProject } from "@/lib/research/models";
import { toProjectSummary } from "@/lib/research/archive";
import ConferenceCarousel from "./ConferenceCarousel";
import ProjectCard from "./ProjectCard";

const project: PublicProject = {
  slug: "safe-project",
  target: "https://example.org",
  targetType: "website",
  shortUrl: "/research/safe-project",
  title: "Safe <script>title</script>",
  description: "Research description",
  longDescription: null,
  tags: ["biology"],
  researchAreas: [],
  technologies: [],
  methods: [],
  organizations: [],
  collaborators: [],
  artifacts: [],
  source: "manual",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: null,
  startDate: "2024",
  endDate: "2025",
  githubRepo: "https://github.com/example/repo",
  photoSetId: null,
};

describe("public controls", () => {
  it("renders highlighted stored text as inert text", () => {
    const { container } = render(
      <ProjectCard project={toProjectSummary(project)} highlights={["safe"]} />,
    );
    expect(screen.getByRole("heading")).toHaveTextContent("Safe <script>title</script>");
    expect(container.querySelector("script")).toBeNull();
  });

  it("only advances through manual controls", () => {
    vi.useFakeTimers();
    try {
      render(
        <ConferenceCarousel
          slides={[
            { src: "/first.jpeg", alt: "First study presentation" },
            { src: "/second.jpeg", alt: "Second study presentation" },
          ]}
        />,
      );
      expect(screen.queryByRole("button", { name: /pause|resume|play/i })).not.toBeInTheDocument();
      act(() => vi.advanceTimersByTime(15_000));
      expect(screen.queryByAltText("Second study presentation")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Next slide" }));
      expect(screen.getByAltText("Second study presentation").parentElement).toHaveAttribute(
        "aria-hidden",
        "false",
      );
      fireEvent.keyDown(screen.getByRole("region", { name: "Conference photos" }), {
        key: "ArrowLeft",
      });
      expect(screen.getByRole("button", { name: "Show slide 1" })).toHaveAttribute(
        "aria-current",
        "true",
      );
      fireEvent.click(screen.getByRole("button", { name: "Show slide 2" }));
      expect(screen.getByRole("button", { name: "Show slide 2" })).toHaveAttribute(
        "aria-current",
        "true",
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
