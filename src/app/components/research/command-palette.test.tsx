import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectSummary } from "@/lib/research/archive";
import CommandPalette from "./CommandPalette";

const project: ProjectSummary = {
  slug: "atlas",
  target: "https://example.org",
  targetType: "website",
  shortUrl: "/research/atlas",
  detailUrl: "/?panel=research&project=atlas",
  title: "Protein atlas",
  description: "Spatial biology",
  tags: ["Biology"],
  researchAreas: ["Biology"],
  source: "manual",
  createdAt: "2025-01-01T00:00:00.000Z",
  startDate: "2024",
  endDate: "2025",
  githubRepo: null,
  photoSetId: null,
  organizations: [],
  artifacts: [],
  searchText: "protein atlas biology",
};

describe("command palette", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute("open");
    };
  });

  it.each([
    ["GitHub", "https://github.com/zeyuyaoy"],
    ["Resume", "https://zeyuyaoy.com/resume"],
  ])("opens the configured %s destination", (label, url) => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<CommandPalette open onClose={vi.fn()} projects={[]} />);
    fireEvent.click(screen.getByRole("option", { name: label }));
    expect(open).toHaveBeenCalledWith(url, "_blank", "noopener,noreferrer");
    open.mockRestore();
  });

  it("navigates to the portfolio without opening a separate site", () => {
    render(<CommandPalette open onClose={vi.fn()} projects={[]} />);
    fireEvent.click(screen.getByRole("option", { name: "Portfolio" }));
    expect(window.location.pathname + window.location.search).toBe("/");
  });

  it("supports keyboard selection and restores focus on Escape", async () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Trigger";
    document.body.append(trigger);
    trigger.focus();
    const close = vi.fn();
    render(<CommandPalette open onClose={close} projects={[project]} />);
    const input = await screen.findByRole("combobox", {
      name: "Search projects or run a command",
    });
    await waitFor(() => expect(input).toHaveFocus());
    fireEvent.change(input, { target: { value: "biology" } });
    const selected = screen.getByRole("option", { name: "Biology" });
    const scrollIntoView = vi.fn();
    selected.scrollIntoView = scrollIntoView;
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant", selected.id);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(close).toHaveBeenCalledOnce();
    trigger.remove();
  });

  it("can be dismissed with a touch control without choosing a command", () => {
    const close = vi.fn();
    render(<CommandPalette open onClose={close} projects={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Close command palette" }));
    expect(close).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
