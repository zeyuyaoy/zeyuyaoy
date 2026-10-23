import { expect, test } from "@playwright/test";
import { tmpdir } from "node:os";
import path from "node:path";
import { readFile } from "node:fs/promises";
import baseline from "../tests/fixtures/research/baseline.json";
import { parseEducation, parseExperience } from "../src/lib/profile-content";

const adminHeaders = { "x-admin-key": "research-e2e-local-key" };
const slugs = baseline.entries
  .filter((entry) => entry.key.startsWith("link:"))
  .map((entry) => entry.key.slice(5));
let browserErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(message.text());
    }
  });
  await page.route("https://webring.hackclub.com/members.json", (route) =>
    route.fulfill({
      json: [{ url: "https://zeyuyaoy.com" }],
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  await page.route("**/api/spotify", (route) => route.fulfill({ json: { isPlaying: false } }));
  await page.route("**/_vercel/**", (route) =>
    route.fulfill({ body: "", contentType: "application/javascript" }),
  );
});

test.afterEach(() => {
  expect(browserErrors).toEqual([]);
});

test("every preserved project opens directly inside Research", async ({ page }) => {
  for (const slug of [...slugs, "migration-rich-project"]) {
    const response = await page.goto(`/?panel=research&project=${slug}`);
    expect(response?.status()).toBe(200);
    const dialog = page.getByRole("dialog", { name: "Research", exact: true });
    await expect(dialog.locator("[data-project-title]")).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://zeyuyaoy.com",
    );
    await page.reload();
    await expect(dialog.getByRole("link", { name: "All research", exact: true })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Collaborators" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Research outputs" })).toBeVisible();
});

test("search, filters, details and history preserve archive state", async ({ page }) => {
  await page.goto("/?panel=research&utm_source=verification");
  const search = page.getByRole("searchbox");
  await expect(search).toBeVisible();
  await page.keyboard.press("/");
  await expect(search).toBeFocused();
  await search.fill("migration verification");
  await expect(page.getByRole("heading", { name: "Migration verification project" })).toBeVisible();
  await expect(page).toHaveURL(/q=migration\+verification/);
  await page.getByRole("button", { name: "Timeline", exact: true }).click();
  await page.goBack();
  await expect(
    page
      .getByRole("group", { name: "Archive view" })
      .getByRole("button", { name: "Projects", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goForward();
  await expect(page.getByRole("button", { name: "Timeline", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.reload();
  await expect(search).toHaveValue("migration verification");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Filter and sort research" });
  await drawer.getByLabel("Year").selectOption("2025");
  await drawer.getByRole("button", { name: /Show \d+ project/ }).click();
  await expect(page.getByRole("button", { name: "Filters, 1 active" })).toBeFocused();
  const archiveUrl = page.url();
  const viewport = page.locator("[data-notebook-body]");
  await viewport.evaluate((element) => {
    element.scrollTop = 100;
  });
  const archiveScroll = await viewport.evaluate((element) => element.scrollTop);
  await page.getByRole("link", { name: "Migration verification project", exact: true }).click();
  await expect(page).toHaveURL(/project=migration-rich-project/);
  await expect(page.locator("[data-project-title]")).toBeFocused();
  await page.getByRole("link", { name: "All research", exact: true }).click();
  await expect(page).toHaveURL(archiveUrl);
  await expect(search).toHaveValue("migration verification");
  await expect.poll(() => viewport.evaluate((element) => element.scrollTop)).toBe(archiveScroll);
  expect(page.url()).toContain("utm_source=verification");
});

test("nested dialogs, galleries and reduced motion work inside Research", async ({ page }) => {
  await page.goto("/?panel=research#collection-biorsp");
  const gallery = page.getByRole("region", { name: "Conference photos" });
  await expect(gallery).toBeVisible();
  await expect(gallery.getByRole("button", { name: /pause|resume|play/i })).toHaveCount(0);
  await gallery.getByRole("button", { name: "Next slide" }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(gallery.getByRole("button", { name: "Show slide 2" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  for (const n of [1, 2, 3, 4, 5]) {
    await gallery.getByRole("button", { name: `Show slide ${n}` }).click();
    const image = gallery.locator('[data-active="true"] img');
    await expect
      .poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
      .toBe(true);
  }
  await page.getByRole("button", { name: "Open command palette" }).click();
  const palette = page.getByRole("dialog", { name: "Research command palette" });
  await expect(palette.getByRole("combobox")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(palette).not.toBeVisible();
  await expect(page.getByRole("dialog", { name: "Research", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open command palette" })).toBeFocused();
  await page.keyboard.press("Control+k");
  await expect(palette).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Research", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Filters", exact: true })).toBeFocused();
});

test("section buttons open notebook dialogs and restore homepage focus and position", async ({
  page,
}) => {
  let researchRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/research/presentation")) {
      researchRequests++;
    }
  });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Profile sections" });
  expect(await nav.getByRole("button").allTextContents()).toHaveLength(5);
  expect(researchRequests).toBe(0);
  const about = page.locator('[data-home-section="bio"] > [class*="aboutContent"]');
  const before = await about.boundingBox();
  for (const name of ["Experience", "Education", "Research"]) {
    const opener = nav.getByRole("button", { name, exact: true });
    await opener.click();
    const dialog = page.getByRole("dialog", { name, exact: true });
    await expect(dialog).toBeVisible();
    if (name === "Research") {
      await expect(dialog.getByRole("searchbox")).toBeVisible();
    }
    expect(await about.boundingBox()).toEqual(before);
    await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
    expect(await about.boundingBox()).toEqual(before);
  }
  expect(researchRequests).toBe(1);
  await nav.getByRole("button", { name: "Experience", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Experience", exact: true });
  await page.keyboard.press("Shift+Tab");
  expect(await page.evaluate(() => !!document.activeElement?.closest("dialog"))).toBe(true);
  await page.mouse.click(1, 1);
  await expect(dialog).toHaveCount(0);
});

test("retired Projects links show the homepage without repository requests or console commands", async ({
  page,
}) => {
  const githubRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).hostname === "api.github.com") {
      githubRequests.push(request.url());
    }
  });
  await page.goto("/?panel=projects");
  await page.waitForLoadState("networkidle");
  const nav = page.getByRole("navigation", { name: "Profile sections" });
  expect(
    await nav
      .getByRole("button")
      .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label"))),
  ).toEqual(["About Me", "Research", "Experience", "Education", "Music"]);
  await expect(page.locator("[data-notebook-dialog]")).toHaveCount(0);
  await page.waitForFunction(() => !!window.peter);
  expect(await page.evaluate(() => Object.hasOwn(window.peter!, "projects"))).toBe(false);
  expect(githubRequests).toEqual([]);
});

test("outside arrows cycle section pop-ups without moving the homepage", async ({ page }) => {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: width === 390 ? "reduce" : "no-preference" });
    await page.goto("/");
    const opener = page
      .getByRole("navigation", { name: "Profile sections" })
      .getByRole("button", { name: "Experience", exact: true });
    await opener.click();
    const scroll = await page.evaluate(() => scrollY);
    const frame = await page.locator("[data-notebook-dialog]").boundingBox();
    for (const direction of ["next", "previous"]) {
      const names =
        direction === "next"
          ? ["Education", "Research", "Experience"]
          : ["Research", "Education", "Experience"];
      for (const name of names) {
        const arrow = page.getByRole("button", { name: new RegExp(`^Open ${direction} section:`) });
        await expect(arrow).toHaveAttribute("aria-label", `Open ${direction} section: ${name}`);
        await expect(arrow.locator("path")).toHaveAttribute(
          "d",
          direction === "previous" ? "m14 6-6 6 6 6" : "m10 6 6 6-6 6",
        );
        const box = (await arrow.boundingBox())!;
        expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
        expect(box.y + box.height).toBeLessThanOrEqual(height);
        if (width <= 600) {
          expect(box.y).toBeGreaterThanOrEqual(frame!.y + frame!.height);
        } else if (direction === "previous") {
          expect(box.x + box.width).toBeLessThanOrEqual(frame!.x);
        } else {
          expect(box.x).toBeGreaterThanOrEqual(frame!.x + frame!.width);
        }
        if (direction === "previous") {
          await arrow.focus();
          await page.keyboard.press("Enter");
        } else {
          await arrow.click();
        }
        const dialog = page.getByRole("dialog", { name, exact: true });
        await expect(dialog).toBeVisible();
        await expect(dialog).toHaveCount(1);
        expect(await dialog.boundingBox()).toEqual(frame);
        expect(new URL(page.url()).searchParams.get("panel")).toBe(name.toLowerCase());
        await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
        expect(await page.evaluate(() => scrollY)).toBe(scroll);
        if (direction === "previous") {
          await expect(arrow).toBeFocused();
        }
        expect(await page.evaluate(() => !!document.activeElement?.closest("dialog"))).toBe(true);
        expect(
          await dialog.locator("[data-notebook-body]").evaluate((body) => body.scrollTop),
        ).toBe(0);
        if (name === "Research") {
          await expect(dialog.getByRole("searchbox")).toBeVisible();
          await dialog.locator("[data-notebook-body]").evaluate((body) => {
            body.scrollTop = 200;
          });
        }
      }
    }
    await page.goBack();
    await expect(page.getByRole("dialog", { name: "Education", exact: true })).toBeVisible();
    await page.goForward();
    await expect(page.getByRole("dialog", { name: "Experience", exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(tmpdir(), `portfolio-popup-arrows-${width}.png`) });
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-notebook-dialog]")).toHaveCount(0);
    await expect(opener).toBeFocused();
  }
});

test("photo strips remain partitioned and independent of timeline scrolling", async ({ page }) => {
  const marqueeScript = await readFile(
    path.join(process.cwd(), "scripts/check-photo-marquee-layout.js"),
    "utf8",
  );
  const experience = parseExperience(
    await readFile(path.join(process.cwd(), "src/content/profile/experience.md"), "utf8"),
  );
  const education = parseEducation(
    await readFile(path.join(process.cwd(), "src/content/profile/education.md"), "utf8"),
  );
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const home = page.locator('[data-photo-section="about"]');
    await expect(home.locator("img")).toHaveCount(56);
    await expect(home.locator(":scope > div")).toHaveCSS("mask-image", /to right/);
    await page.evaluate(marqueeScript);
    for (const [name, section, count] of [
      ["Experience", "experience", 48],
      ["Education", "education", 28],
    ] as const) {
      await page
        .getByRole("navigation", { name: "Profile sections" })
        .getByRole("button", { name })
        .click();
      const dialog = page.getByRole("dialog", { name, exact: true });
      const strip = dialog.locator(`[data-photo-section="${section}"]`);
      await expect(strip).toBeVisible();
      await expect(strip.locator("img")).toHaveCount(count * 2);
      const row = strip.locator(":scope > div");
      await expect(row).toHaveCSS("mask-image", /^linear-gradient\(.*0\.75/);
      const fade = await row.evaluate((element) => getComputedStyle(element).maskImage);
      expect(fade).not.toContain("to right");
      const sources = await strip
        .locator("img")
        .evaluateAll((images) => images.map((img) => img.getAttribute("src")));
      await dialog.locator("[data-notebook-body]").evaluate((body) => {
        body.scrollTop = body.scrollHeight;
      });
      expect(
        await strip
          .locator("img")
          .evaluateAll((images) => images.map((img) => img.getAttribute("src"))),
      ).toEqual(sources);
      const timeline = dialog.getByRole("list", {
        name: section === "experience" ? "Experience timeline" : education.title,
        exact: true,
      });
      await expect(timeline.locator(":scope > li")).toHaveCount(
        section === "experience" ? experience.length : education.entries.length,
      );
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(strip).toHaveAttribute("data-marquee-mode", "reduced");
      await expect(strip.locator("[data-marquee-track]")).toHaveCSS(
        "animation-play-state",
        "paused",
      );
      await expect(row).toHaveCSS("mask-image", fade);
      await page.evaluate(marqueeScript);
      await page.screenshot({ path: path.join(tmpdir(), `portfolio-${section}-${width}.png`) });
      await page.keyboard.press("Escape");
      await page.emulateMedia({ reducedMotion: "no-preference" });
    }
  }
});

test("complete profile timelines preserve content and scroll naturally at every layout", async ({
  page,
}) => {
  const experience = parseExperience(
    await readFile(path.join(process.cwd(), "src/content/profile/experience.md"), "utf8"),
  );
  const education = parseEducation(
    await readFile(path.join(process.cwd(), "src/content/profile/education.md"), "utf8"),
  );
  for (const [width, height, largeText] of [
    [320, 844, false],
    [390, 844, true],
    [844, 390, false],
    [1440, 900, false],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.evaluate((large) => {
      localStorage.setItem(
        "portfolio-appearance",
        JSON.stringify({
          version: 1,
          preset: "sundaze",
          mode: large ? "dark" : "light",
          font: large ? "mono" : "rounded",
          size: large ? "larger" : "standard",
          motion: "reduce",
        }),
      );
    }, largeText);
    for (const [section, label, entries] of [
      ["experience", "Experience timeline", experience],
      ["education", education.title, education.entries],
    ] as const) {
      await page.goto(`/?panel=${section}`);
      await page.waitForLoadState("networkidle");
      const title = section === "experience" ? "Experience" : "Education";
      const dialog = page.getByRole("dialog", { name: title, exact: true });
      const body = dialog.getByRole("region", { name: `${title} content`, exact: true });
      const timeline = dialog.getByRole("list", { name: label, exact: true });
      const rows = timeline.locator(":scope > li");
      await expect(rows).toHaveCount(entries.length);
      await expect(
        dialog.locator('[aria-roledescription="carousel"], [aria-roledescription="slide"]'),
      ).toHaveCount(0);
      await expect(
        dialog.getByRole("button", { name: /^(Previous |Next |Show .* of)/ }),
      ).toHaveCount(0);
      await expect(timeline.locator('[hidden], [inert], [aria-hidden="true"]')).toHaveCount(0);
      for (const [index, entry] of entries.entries()) {
        const row = rows.nth(index);
        await expect(row).toBeVisible();
        await expect(row.getByRole("heading", { level: 3 })).toHaveText(entry.title);
        await expect(row.locator(":scope > p")).toHaveText(entry.dateLabel);
        if (entry.href) {
          await expect(row.getByRole("link", { name: entry.title, exact: true })).toHaveAttribute(
            "href",
            entry.href,
          );
        }
        if ("subtitle" in entry && typeof entry.subtitle === "string" && entry.subtitle) {
          await expect(row.getByText(entry.subtitle, { exact: true })).toBeVisible();
        }
      }
      const layout = await timeline.evaluate((element) => {
        const row = element.firstElementChild!;
        const date = row.firstElementChild!.getBoundingClientRect();
        const details = row.lastElementChild!.getBoundingClientRect();
        return { stacked: date.bottom <= details.top, sideBySide: date.right <= details.left };
      });
      expect(width <= 960 ? layout.stacked : layout.sideBySide).toBe(true);
      const scroll = await body.evaluate((element) => ({
        overflow: element.scrollHeight > element.clientHeight + 1,
        horizontal: element.scrollWidth > element.clientWidth + 1,
        nested: [...element.querySelectorAll("*")].some(
          (child) =>
            /^(auto|scroll)$/.test(getComputedStyle(child).overflowY) &&
            child.scrollHeight > child.clientHeight + 1,
        ),
      }));
      expect(scroll.horizontal).toBe(false);
      expect(scroll.nested).toBe(false);
      const before = await dialog.boundingBox();
      await body.focus();
      if (scroll.overflow) {
        await page.keyboard.press("PageDown");
        await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
        await body.evaluate((element) => {
          element.scrollTop = element.scrollHeight;
        });
        await expect(rows.last()).toBeInViewport();
        await body.evaluate((element) => {
          element.scrollTop = 0;
        });
        await body.hover({ position: { x: 20, y: 20 } });
        await page.mouse.wheel(0, 160);
        await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      } else {
        await expect(rows.last()).toBeInViewport();
      }
      expect(await dialog.boundingBox()).toEqual(before);
      await expect(dialog.getByRole("button", { name: `Close ${title}` })).toBeInViewport();
      await expect(rows).toHaveCount(entries.length);
      await body.evaluate((element) => {
        element.scrollTop = 0;
      });
      await page.screenshot({
        path: path.join(tmpdir(), `portfolio-timeline-${section}-${width}.png`),
      });
    }
  }
});

test.describe("touch profile timelines", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 600 } });
  test("all education entries remain available without entry controls", async ({ page }) => {
    await page.goto("/?panel=education");
    const dialog = page.getByRole("dialog", { name: "Education", exact: true });
    const timeline = dialog.getByRole("list", { name: "Formal education", exact: true });
    const body = dialog.getByRole("region", { name: "Education content", exact: true });
    await expect(timeline.locator(":scope > li")).toHaveCount(2);
    await expect(timeline.getByText("High School Diploma", { exact: true })).toBeVisible();
    await expect(
      timeline.getByText("Valedictorian, Class of 2026.", { exact: true }),
    ).toBeVisible();
    await expect(dialog.getByRole("button", { name: /^(Previous |Next |Show .* of)/ })).toHaveCount(
      0,
    );
    await body.focus();
    await page.keyboard.press("PageDown");
    await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await expect(
      timeline.getByRole("heading", {
        name: "Stamford American International School, Singapore",
        exact: true,
      }),
    ).toBeInViewport();
  });
});

test("music cassette fits viewports and only fetches while visible", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/spotify", (route) => {
    requests++;
    return route.fulfill({ json: { isPlaying: false } });
  });
  await page.clock.install();
  for (const [width, height] of [
    [320, 900],
    [390, 844],
    [768, 900],
    [1440, 900],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    const before = requests;
    const note = page.getByRole("button", { name: "Music", exact: true });
    await expect(note).not.toHaveAttribute("aria-haspopup", "dialog");
    expect(requests).toBe(before);
    await note.click();
    const cassette = page.getByRole("region", { name: "Music cassette", exact: true });
    await expect(cassette.getByText("Tape stopped", { exact: true })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
    expect(
      await cassette.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return (
          box.left >= 16 &&
          box.right <= innerWidth - 15 &&
          box.top >= 16 &&
          box.bottom <= innerHeight - 15
        );
      }),
    ).toBe(true);
    await cassette.getByRole("button", { name: "Remove cassette" }).click();
    await expect(note).toBeFocused();
    await expect(cassette).toHaveCount(0);
    const closedRequests = requests;
    await page.clock.fastForward(61_000);
    expect(requests).toBe(closedRequests);
  }
});

test("music cassette drags, cycles finishes, remembers style and ignores retired Music URLs", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/api/spotify", (route) => {
    requests++;
    return route.fulfill({ json: { isPlaying: false } });
  });
  await page.goto("/?panel=music&utm_source=cassette#contact");
  await expect(page).toHaveURL(/\/\?panel=music&utm_source=cassette#contact$/);
  await expect(page.getByRole("region", { name: "Music cassette", exact: true })).toHaveCount(0);
  expect(requests).toBe(0);
  await page.getByRole("button", { name: "Music", exact: true }).click();
  const cassette = page.getByRole("region", { name: "Music cassette", exact: true });
  const shell = page.getByRole("button", { name: "Change cassette finish" });
  await expect(cassette.getByText("Tape stopped", { exact: true })).toBeVisible();
  await expect(shell).toBeFocused();
  const historyLength = await page.evaluate(() => history.length);
  const first = (await cassette.boundingBox())!;
  await shell.press("ArrowLeft");
  await shell.press("Shift+ArrowUp");
  expect((await cassette.boundingBox())!.x).toBe(first.x - 10);
  expect((await cassette.boundingBox())!.y).toBe(first.y - 40);
  await shell.press("Enter");
  await expect(cassette).toHaveAttribute("data-finish", "1");
  const box = (await shell.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.75);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 100, box.y + box.height * 0.75 - 60, { steps: 5 });
  await page.mouse.up();
  await expect(cassette).toHaveAttribute("data-finish", "1");
  expect((await cassette.boundingBox())!.x).toBe(first.x - 110);
  await shell.click({ position: { x: 20, y: 130 } });
  await expect(cassette).toHaveAttribute("data-finish", "2");
  expect(requests).toBe(1);
  const moved = await cassette.boundingBox();
  await shell.press("Escape");
  const note = page.getByRole("button", { name: "Music", exact: true });
  await expect(note).toBeFocused();
  await note.click();
  await expect(cassette).toHaveAttribute("data-finish", "2");
  expect(await cassette.boundingBox()).toEqual(moved);
  await note.click();
  await expect(shell).toBeFocused();
  await expect(cassette).toHaveCount(1);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  await page.getByRole("button", { name: "Experience", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Experience", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(cassette).toBeVisible();
  await page.setViewportSize({ width: 320, height: 568 });
  await expect
    .poll(async () =>
      cassette.evaluate((element) => element.getBoundingClientRect().right <= innerWidth - 15),
    )
    .toBe(true);
  await page.screenshot({ path: path.join(tmpdir(), "music-cassette-mobile.png") });
  await page.reload();
  await expect(cassette).toHaveCount(0);
  await note.click();
  await expect(cassette).toHaveAttribute("data-finish", "2");
  await page.screenshot({ path: path.join(tmpdir(), "music-cassette-finish.png") });
});

test("appearance and photo speed persist across pop-ups", async ({ page }) => {
  await page.goto("/");
  const home = page.locator('[data-photo-section="about"]');
  const track = home.locator("[data-marquee-track]");
  await expect(home).toHaveAttribute("data-marquee-mode", "looping");
  const before = await track.evaluate((element) =>
    parseFloat(getComputedStyle(element).animationDuration),
  );
  await page.getByRole("button", { name: "Appearance settings", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "Make yourself at home!" });
  await settings.getByRole("button", { name: "Dark", exact: true }).click();
  const speed = settings.getByLabel("Photo scroll speed");
  await speed.focus();
  await speed.press("End");
  await page.keyboard.press("Escape");
  await expect
    .poll(() =>
      track.evaluate((element) => parseFloat(getComputedStyle(element).animationDuration)),
    )
    .toBeLessThan(before);
  await page
    .getByRole("navigation", { name: "Profile sections" })
    .getByRole("button", { name: "Experience", exact: true })
    .click();
  const strip = page
    .getByRole("dialog", { name: "Experience", exact: true })
    .locator('[data-photo-section="experience"]');
  await expect(strip).toHaveAttribute("data-marquee-mode", "looping");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const duration = await strip
    .locator("[data-marquee-track]")
    .evaluate((element) => parseFloat(getComputedStyle(element).animationDuration));
  expect(duration).toBeLessThan(before);
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Appearance settings", exact: true }).click();
  await expect(page.getByLabel("Photo scroll speed")).toHaveValue("50");
});

test("research pop-up preserves mobile controls and large text", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "portfolio-appearance",
      JSON.stringify({
        version: 1,
        preset: "everyday",
        mode: "dark",
        font: "mono",
        size: "larger",
        motion: "reduce",
      }),
    ),
  );
  for (const width of [320, 390, 768, 960, 980, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/?panel=research");
    const dialog = page.getByRole("dialog", { name: "Research", exact: true });
    await expect(dialog.getByRole("searchbox")).toBeVisible();
    const body = dialog.locator("[data-notebook-body]");
    expect(await body.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
      true,
    );
    expect(
      await dialog.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return (
          box.top >= 0 && box.bottom <= innerHeight && box.left >= 0 && box.right <= innerWidth
        );
      }),
    ).toBe(true);
    await dialog.getByRole("button", { name: "Filters", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Filter and sort research" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.screenshot({ path: path.join(tmpdir(), `research-popup-${width}.png`) });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const disclosure = page.locator("#collection-biorsp-outputs");
  await disclosure.locator("summary").click();
  await expect(disclosure.getByRole("link")).toHaveCount(4);
});

test("project and collection sharing use homepage pop-up links", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (value: string) => {
          (window as unknown as { copied: string }).copied = value;
        },
      },
    }),
  );
  await page.goto("/?panel=research");
  await page
    .locator("#collection-biorsp")
    .getByRole("button", { name: "Copy link", exact: true })
    .click();
  expect(await page.evaluate(() => (window as unknown as { copied: string }).copied)).toBe(
    "https://zeyuyaoy.com/?panel=research#collection-biorsp",
  );
  await page.goto("/?panel=research&project=garcia");
  await page.getByRole("button", { name: "Copy link", exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { copied: string }).copied)).toBe(
    "https://zeyuyaoy.com/?panel=research&project=garcia",
  );
});

test("research handles unavailable, retry, empty and missing projects", async ({ page }) => {
  let unavailable = true;
  await page.route("**/api/research/presentation", (route) =>
    route.fulfill({
      json: { availability: unavailable ? "unconfigured" : "ready", projects: [], collections: [] },
    }),
  );
  await page.goto("/?panel=research");
  await expect(page.getByRole("button", { name: "Retry research" })).toBeVisible();
  unavailable = false;
  await page.getByRole("button", { name: "Retry research" }).click();
  await expect(page.getByText("No projects are available yet.")).toBeVisible();
  await page.goto("/?panel=research&project=unknown");
  await expect(page.getByRole("heading", { name: "Project not found" })).toBeVisible();
  await page.getByRole("link", { name: "All research", exact: true }).click();
  await expect(page.getByRole("searchbox")).toBeVisible();
});

test("all notebook dialogs share the same dimensions, margins and padding", async ({ page }) => {
  for (const [width, height] of [
    [320, 844],
    [390, 844],
    [1440, 900],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    const frames: {
      left: number;
      top: number;
      width: number;
      height: number;
      headerHeight: number;
      bodyHeight: number;
    }[] = [];
    for (const section of ["experience", "education", "research"]) {
      await page.goto(`/?panel=${section}`);
      const name = section[0].toUpperCase() + section.slice(1);
      const dialog = page.getByRole("dialog", { name, exact: true });
      await expect(dialog).toBeVisible();
      if (section === "research") {
        await expect(dialog.getByRole("searchbox")).toBeVisible();
      }
      const metrics = await dialog.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const header = element.querySelector(":scope > header")!;
        const body = element.querySelector<HTMLElement>("[data-notebook-body]")!;
        const close = header.querySelector('button[aria-label^="Close "]')!.getBoundingClientRect();
        const hStyle = getComputedStyle(header);
        const bStyle = getComputedStyle(body);
        const content = body.firstElementChild!.getBoundingClientRect();
        const root = getComputedStyle(element);
        return {
          width: box.width,
          height: box.height,
          headerHeight: header.getBoundingClientRect().height,
          bodyHeight: body.getBoundingClientRect().height,
          left: box.left,
          right: innerWidth - box.right,
          top: box.top,
          bottom: innerHeight - box.bottom,
          headerPadding: [hStyle.paddingLeft, hStyle.paddingRight],
          bodyPadding: [bStyle.paddingLeft, bStyle.paddingRight],
          contentInset: content.left - body.getBoundingClientRect().left,
          expectedInset: parseFloat(bStyle.paddingLeft),
          overflow: body.scrollWidth > body.clientWidth + 1,
          closeSize: Math.min(close.width, close.height),
          radius: root.borderTopLeftRadius,
          expectedRadius: root.getPropertyValue("--radius-lg").trim(),
          closeRadius: getComputedStyle(header.querySelector('button[aria-label^="Close "]')!)
            .borderRadius,
          expectedControlRadius: root.getPropertyValue("--radius-md").trim(),
        };
      });
      frames.push(metrics);
      if (section === "experience" || section === "education") {
        await dialog.locator("[data-notebook-body]").evaluate((body) => {
          body.scrollTop = body.scrollHeight;
        });
        const nextFrame = await dialog.boundingBox();
        expect(nextFrame?.width).toBe(metrics.width);
        expect(nextFrame?.height).toBe(metrics.height);
      }
      const clearance = height <= 500 ? 12 : width <= 600 ? 16 : 32;
      expect(
        Math.min(metrics.left, metrics.right, metrics.top, metrics.bottom),
      ).toBeGreaterThanOrEqual(clearance - 1);
      expect(metrics.headerPadding).toEqual(metrics.bodyPadding);
      expect(Math.abs(metrics.contentInset - metrics.expectedInset)).toBeLessThanOrEqual(1);
      expect(metrics.overflow).toBe(false);
      expect(metrics.closeSize).toBeGreaterThanOrEqual(44);
      expect(metrics.radius).toBe(metrics.expectedRadius);
      expect(metrics.closeRadius).toBe(metrics.expectedControlRadius);
      if (section === "research") {
        await expect(dialog.getByRole("heading", { name: "Research", exact: true })).toHaveCount(1);
      }
    }
    for (const frame of frames.slice(1)) {
      for (const key of ["left", "top", "width", "height", "headerHeight", "bodyHeight"] as const) {
        expect(
          Math.abs(frame[key] - frames[0][key]),
          `${key} differs between pop-ups at ${width} × ${height}`,
        ).toBeLessThanOrEqual(1);
      }
    }
  }
});

test("all shared palettes keep research text readable and accept legacy preference shapes", async ({
  page,
}) => {
  await page.goto("/?panel=research");
  await page.waitForLoadState("networkidle");
  for (const [preset, accent] of [
    ["sundaze", "sage"],
    ["everyday", "ocean"],
    ["editorial", "terracotta"],
    ["goofball", "lavender"],
    ["bw", "neutral"],
    ["cyberpunk", "neon"],
  ]) {
    for (const mode of ["light", "dark"]) {
      await page.evaluate(
        (preference) => localStorage.setItem("portfolio-appearance", JSON.stringify(preference)),
        {
          version: 1,
          preset,
          accent,
          mode,
          font: "rounded",
          size: "standard",
          motion: "reduce",
          cyberpunkUnlocked: true,
        },
      );
      await page.reload();
      await page.waitForLoadState("networkidle");
      await expect(page.locator("html")).toHaveAttribute("data-palette", preset);
      await expect(page.locator("html")).toHaveAttribute("data-theme", mode);
      const chrome = await page.locator("[data-notebook-dialog]").evaluate((dialog) => {
        const homeHeader = document.querySelector(
          '[aria-label="Profile sections"]',
        )!.parentElement!;
        const header = dialog.querySelector("header")!;
        return {
          homeBackground: getComputedStyle(homeHeader).backgroundColor,
          popupBackground: getComputedStyle(header).backgroundColor,
          homeBorder: getComputedStyle(homeHeader.parentElement!).borderColor,
          popupBorder: getComputedStyle(dialog).borderColor,
          backdrop: getComputedStyle(dialog, "::backdrop").backgroundColor,
          backdropBlur: getComputedStyle(dialog, "::backdrop").backdropFilter,
          controlRadius: getComputedStyle(dialog).getPropertyValue("--radius-md").trim(),
          panelRadius: getComputedStyle(dialog).borderRadius,
          mediumRadii: [
            ...dialog.querySelectorAll(
              "header button, :scope > button, .filter-button, .quick-filters button, .view-switch button, .copy-link, .search-field, .project-card, .collection-card",
            ),
          ].map((item) => getComputedStyle(item).borderRadius),
        };
      });
      expect(chrome.popupBackground).toBe(chrome.homeBackground);
      expect(chrome.popupBorder).toBe(chrome.homeBorder);
      expect(chrome.backdrop).not.toBe("rgba(0, 0, 0, 0)");
      expect(chrome.backdropBlur).toBe("blur(4px)");
      expect(chrome.controlRadius).toBe(preset === "cyberpunk" ? "4px" : "10px");
      expect(chrome.panelRadius).toBe(preset === "cyberpunk" ? "6px" : "14px");
      expect(chrome.mediumRadii.length).toBeGreaterThan(10);
      expect(chrome.mediumRadii.every((radius) => radius === chrome.controlRadius)).toBe(true);
      const filter = page.getByRole("button", { name: "Filters", exact: true });
      await filter.focus();
      await expect(filter).toHaveCSS("border-radius", chrome.controlRadius);
      const contrast = await page
        .locator(".project-card h2 a")
        .first()
        .evaluate((link) => {
          const luminance = (color: string) => {
            const channels = color
              .match(/[\d.]+/g)!
              .slice(0, 3)
              .map(Number)
              .map((value) => {
                const channel = value / 255;
                return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
              });
            return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
          };
          const foreground = luminance(getComputedStyle(link).color);
          const background = luminance(
            getComputedStyle(link.closest(".project-card")!).backgroundColor,
          );
          return (
            (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
          );
        });
      expect(contrast).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test("admin editing and exports use only the isolated prefixed APIs", async ({ page, request }) => {
  const slug = "e2e-editor-project";
  await page.goto("/research/admin");
  await page.getByLabel("Admin key", { exact: false }).fill("research-e2e-local-key");
  await page.getByRole("button", { name: /sign in|log in|unlock/i }).click();
  await expect(page.getByRole("button", { name: "Add project", exact: true })).toBeVisible();
  try {
    await page.getByRole("button", { name: "Add project", exact: true }).click();
    await page.getByLabel("Slug", { exact: false }).fill(slug);
    await page.getByLabel("Target URL", { exact: false }).fill("https://example.org/e2e");
    await page.getByLabel("Title", { exact: true }).fill("Browser editor verification");
    await page.getByRole("button", { name: "Save project", exact: true }).click();
    await expect(page.getByText("Project created.", { exact: true })).toBeVisible();
    const saved = await request.get(`/api/research/links?slug=${slug}`, { headers: adminHeaders });
    expect((await saved.json()).metadata.title).toBe("Browser editor verification");
    for (const format of ["json", "csv", "yaml"]) {
      const result = await request.get(`/api/research/export?format=${format}`, {
        headers: adminHeaders,
      });
      expect(result.status()).toBe(200);
      expect(await result.text()).toContain("Browser editor verification");
    }
  } finally {
    await request.delete(`/api/research/links?slug=${slug}`, { headers: adminHeaders });
  }
});

test("former pages return 404 while short links, APIs and crawlers retain their contracts", async ({
  request,
}) => {
  const before = await request
    .get("/api/research/links?slug=garcia", { headers: adminHeaders })
    .then((r) => r.json());
  const redirect = await request.get("/research/garcia", { maxRedirects: 0 });
  expect(redirect.status()).toBe(308);
  expect(redirect.headers()["location"]).toBe(before.target);
  const after = await request
    .get("/api/research/links?slug=garcia", { headers: adminHeaders })
    .then((r) => r.json());
  expect(after.clicks).toBe(before.clicks + 1);
  expect((await request.get("/api/research/links")).status()).toBe(401);
  for (const url of [
    "/research",
    "/research/projects/garcia",
    "/research/projects/not-a-project",
    "/research/sitemap.xml",
    "/research/not-a-project",
  ]) {
    expect((await request.get(url, { maxRedirects: 0 })).status(), url).toBe(404);
  }
  const root = await request.get("/sitemap.xml").then((r) => r.text());
  expect(root).not.toContain("/research/projects/");
  expect(await request.get("/robots.txt").then((r) => r.text())).not.toContain(
    "/research/sitemap.xml",
  );
});

test.describe("touch cassette", () => {
  test.use({ hasTouch: true });
  test("supports touch movement, unavailable status and invalid saved finishes", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => localStorage.setItem("portfolio:cassette-finish", "invalid"));
    await page.route("**/api/spotify", (route) =>
      route.fulfill({
        json: { isPlaying: false, fallback: true, title: "Spotify status unavailable" },
      }),
    );
    await page.goto("/");
    await page.getByRole("button", { name: "Music", exact: true }).tap();
    const cassette = page.getByRole("region", { name: "Music cassette", exact: true });
    const shell = page.getByRole("button", { name: "Change cassette finish" });
    await expect(cassette).toHaveAttribute("data-finish", "0");
    await expect(cassette.getByText("Spotify status unavailable", { exact: true })).toBeVisible();
    const box = (await shell.boundingBox())!;
    await page.touchscreen.tap(box.x + 30, box.y + box.height * 0.75);
    await expect(cassette).toHaveAttribute("data-finish", "1");
    await shell.evaluate((element) => {
      element.setPointerCapture = () => {};
      const base = {
        bubbles: true,
        pointerId: 7,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        clientX: 100,
      };
      element.dispatchEvent(new PointerEvent("pointerdown", { ...base, clientY: 700 }));
      element.dispatchEvent(new PointerEvent("pointermove", { ...base, clientY: 600 }));
      element.dispatchEvent(new PointerEvent("pointerup", { ...base, clientY: 600 }));
      element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await expect(cassette).toHaveAttribute("data-finish", "1");
    expect((await shell.boundingBox())!.y).toBeCloseTo(box.y - 100);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(shell).toHaveCSS("touch-action", "none");
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
    await cassette.getByRole("button", { name: "Remove cassette" }).tap();
    await expect(cassette).toHaveCount(0);
  });
});

test("cassette preserves live track links and works without local storage", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem;
    const set = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) {
      if (key === "portfolio:cassette-finish") {
        throw new Error("Storage unavailable");
      }
      return get.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (key === "portfolio:cassette-finish") {
        throw new Error("Storage unavailable");
      }
      return set.call(this, key, value);
    };
  });
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  await page.route("**/api/spotify", async (route) => {
    requests++;
    await ready;
    await route.fulfill({
      json: {
        isPlaying: true,
        title: "A test track",
        artist: "A test artist",
        songUrl: "https://open.spotify.com/track/test",
        durationMs: 180000,
        progressMs: 60000,
        progressCapturedAt: Date.now(),
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Music", exact: true }).click();
  const cassette = page.getByRole("region", { name: "Music cassette", exact: true });
  await expect(cassette.getByText("Loading music player…")).toBeVisible();
  await expect(cassette).toHaveAttribute("data-finish", "0");
  release();
  const link = cassette.getByRole("link", {
    name: "Open A test track by A test artist on Spotify",
  });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "https://open.spotify.com/track/test");
  await expect(link).toHaveAttribute("target", "_blank");
  await link.click({ trial: true });
  const shell = cassette.getByRole("button", { name: "Change cassette finish" });
  await shell.focus();
  await shell.press("Space");
  await expect(cassette).toHaveAttribute("data-finish", "1");
  await page.screenshot({ path: path.join(tmpdir(), "music-cassette-desktop.png") });
  await shell.press("Space");
  await shell.press("Space");
  await expect(cassette).toHaveAttribute("data-finish", "0");
  expect(requests).toBe(1);
});
