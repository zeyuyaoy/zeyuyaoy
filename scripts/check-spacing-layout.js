(() => {
  const assert = (condition, message) => {
    if (!condition) {
      throw new Error(`Spacing layout: ${message}`);
    }
  };
  const near = (a, b) => Math.abs(a - b) <= 1;
  const style = (element) => getComputedStyle(element);
  const box = (element) => element.getBoundingClientRect();
  const px = (value) => Number.parseFloat(value);
  const visible = (element) =>
    element.getClientRects().length > 0 &&
    style(element).visibility !== "hidden" &&
    !element.closest('[aria-hidden="true"], [inert]');
  const inside = (inner, outer) => inner.left >= outer.left - 1 && inner.right <= outer.right + 1;
  const centered = (inner, outer) =>
    near(inner.left + inner.width / 2, outer.left + outer.width / 2);
  const viewport = { left: 0, right: document.documentElement.clientWidth };
  const rootSize = px(style(document.documentElement).fontSize);
  const intro = document.querySelector('main [data-home-section="intro"]');
  assert(intro, "homepage intro is missing");
  const layout = intro.parentElement;
  const sections = [...layout.children].filter((element) =>
    element.hasAttribute("data-home-section"),
  );
  assert(sections.length === 3, "expected intro, profile, and footer");
  const gap = px(style(layout).rowGap);
  const gaps = sections
    .slice(1)
    .map((section, index) => box(section).top - box(sections[index]).bottom);
  assert(
    gaps.every((value) => near(value, gap)),
    "major sections have unequal gaps",
  );
  assert(
    sections.every((section) => inside(box(section), viewport)),
    "section escapes viewport",
  );
  assert(document.documentElement.scrollWidth <= viewport.right, "document overflows horizontally");
  assert(
    sections.every(
      (section) =>
        near(box(section).left, box(layout).left) && near(box(section).right, box(layout).right),
    ),
    "major sections have different outer edges",
  );

  const profile = sections.find((section) => section.dataset.homeSection === "bio");
  const notebook = document.querySelector("[data-notebook-body]") ?? profile;
  assert(profile && notebook, "profile or notebook is missing");
  const panelPadding = px(style(profile).paddingLeft);
  const notebookPadding =
    notebook === profile
      ? panelPadding
      : px(style(notebook.closest("dialog")).getPropertyValue("--popup-padding"));
  assert(
    near(notebookPadding, px(style(notebook).paddingLeft)),
    "notebook padding differs from its shared spacing token",
  );
  assert(near(panelPadding, px(style(profile).paddingRight)), "profile padding is asymmetric");
  assert(near(notebookPadding, px(style(notebook).paddingRight)), "notebook padding is asymmetric");
  const expectedPanelPadding = rootSize * (viewport.right <= 560 ? 1 : 1.25);
  assert(
    near(panelPadding, expectedPanelPadding),
    "panel padding does not follow text size/breakpoint",
  );

  if (viewport.right <= 960) {
    assert(near(gap, px(style(intro).gap)), "intro diverges from stacked section rhythm");
    const introItems = [
      intro.firstElementChild,
      intro.querySelector("h1"),
      intro.querySelector("p"),
      intro.querySelector("nav"),
    ];
    assert(
      introItems.every((item) => centered(box(item), box(intro))),
      "intro items are off-center",
    );
    assert(
      sections
        .filter((section) => section !== profile)
        .every(
          (section) => style(section).minHeight === "auto" || px(style(section).minHeight) === 0,
        ),
      "desktop section-height reservations leaked into mobile",
    );
  }

  const widget = profile.querySelector('[data-profile-widget="true"][aria-hidden="false"]');
  if (widget) {
    assert(
      near(box(widget).height, box(widget.firstElementChild).height),
      "widget panel reserves unrelated content height",
    );
    assert(
      box(widget).bottom <= box(profile).bottom - panelPadding + 1,
      "widget escapes its panel vertically",
    );
  }

  const tabstrip = profile.querySelector('nav[aria-label="Profile sections"]');
  const tabs = [...tabstrip.querySelectorAll("button")];
  assert(inside(box(tabstrip), box(profile)), "tab strip escapes profile");
  if (viewport.right <= 960) {
    assert(
      tabs.every((tab) => box(tab).height >= 44),
      "profile tabs have small touch targets",
    );
    if (tabstrip.scrollWidth <= tabstrip.clientWidth + 1) {
      const group = { left: box(tabs[0]).left, width: box(tabs.at(-1)).right - box(tabs[0]).left };
      assert(centered(group, box(profile)), "profile tabs are off-center");
    } else {
      assert(
        box(tabs[0]).left + tabstrip.scrollLeft >= box(tabstrip).left - 1,
        "first tab is inaccessible at the start of the scroll strip",
      );
      assert(
        box(tabs.at(-1)).right + tabstrip.scrollLeft <=
          box(tabstrip).left + tabstrip.scrollWidth + 1,
        "last tab is inaccessible at the end of the scroll strip",
      );
    }
    for (const content of profile.querySelectorAll(
      '[class*="aboutContent"], [class*="experienceContent"]',
    )) {
      if (visible(content) && !content.closest("dialog")) {
        assert(style(content).textAlign === "center", "profile prose is not centered");
        assert(centered(box(content), box(profile)), "profile prose block is off-center");
      }
    }
  }
  for (const list of profile.querySelectorAll("ul, ol")) {
    if (visible(list)) {
      assert(style(list).textAlign === "left", "profile list or timeline is not left-aligned");
    }
  }
  const descendants = [...layout.querySelectorAll("p, h1, h2, h3, h4, li, button, a")].filter(
    (element) =>
      visible(element) &&
      !element.closest(
        'dialog, nav[aria-label="Profile sections"], [class*="trackLabel"], [class*="srOnly"]',
      ),
  );
  for (const element of descendants) {
    if (element === intro.firstElementChild) {
      assert(inside(box(element), viewport), "profile photo escapes viewport");
      continue;
    }
    const container = element.closest("[data-home-section]");
    if (container) {
      assert(
        inside(box(element), box(container)),
        `${element.tagName} escapes its section: ${element.textContent.trim().slice(0, 60)}`,
      );
    }
  }

  const footer = sections.find((section) => section.dataset.homeSection === "footer");
  const footerControls = [...footer.querySelectorAll('nav, button[aria-haspopup="dialog"]')];
  assert(
    footerControls.every((element) => inside(box(element), box(footer))),
    "expanded footer controls escape their panel",
  );
  if (viewport.right <= 960) {
    const rows = new Map();
    for (const element of [...footer.children].filter(
      (element) => element.tagName !== "DIALOG" && visible(element),
    )) {
      const bounds = box(element);
      const key = Math.round(bounds.top);
      const row = rows.get(key);
      rows.set(
        key,
        row
          ? { left: Math.min(row.left, bounds.left), right: Math.max(row.right, bounds.right) }
          : bounds,
      );
    }
    assert(
      [...rows.values()].every((row) =>
        centered({ left: row.left, width: row.right - row.left }, box(footer)),
      ),
      "footer controls are off-center",
    );
  }

  const trackLabel = profile.querySelector('[class*="trackLabel"]');
  const trackCopy = trackLabel?.querySelector('[class*="trackCopy"]');
  if (trackCopy && visible(trackCopy) && viewport.right <= 960) {
    const artwork = trackLabel.querySelector('[class*="albumArtwork"]');
    const group = {
      left: box(trackCopy).left,
      width: box(artwork ?? trackCopy).right - box(trackCopy).left,
    };
    assert(centered(group, box(trackLabel)), "cassette text and artwork group is off-center");
    assert(inside(box(trackCopy), box(trackLabel)), "cassette text column escapes label");
    for (const line of trackCopy.children) {
      assert(
        near(box(line).left, box(trackCopy).left),
        "cassette text lines have different left edges",
      );
      assert(style(line).textAlign === "left", "cassette text is not left-aligned");
    }
    if (artwork) {
      assert(box(artwork).left >= box(trackCopy).right - 1, "cassette text overlaps artwork");
      assert(inside(box(artwork), box(trackLabel)), "cassette artwork escapes label");
    }
  }

  const tracks = [...document.querySelectorAll('[class*="marqueeTrack"]')];
  const marquee = tracks.filter(visible).map((track) => {
    const trackStyle = style(track);
    const computedGap = px(trackStyle.columnGap);
    assert(near(computedGap, rootSize * 2), "text marquee gap does not scale with text");
    if (trackStyle.display === "flex") {
      const travel = -px(trackStyle.getPropertyValue("--marquee-distance"));
      assert(
        near(travel, track.firstElementChild.scrollWidth + computedGap),
        "marquee travel differs from text width plus gap",
      );
      return { gap: computedGap, travel };
    }
    return { gap: computedGap, active: false };
  });

  const dialog = document.querySelector("dialog[open]");
  let settings = null;
  if (dialog) {
    const dialogBox = box(dialog);
    assert(inside(dialogBox, viewport), "dialog escapes viewport horizontally");
    assert(
      dialogBox.top >= -1 && dialogBox.bottom <= innerHeight + 1,
      "dialog escapes viewport vertically",
    );
    const dialogContent = dialog.querySelector("[data-notebook-body]") ?? dialog;
    assert(
      dialogContent.scrollWidth <= dialogContent.clientWidth + 1,
      "dialog contents overflow horizontally",
    );
    const regions = [...dialog.children].filter((element) =>
      /^(HEADER|DIV|SECTION|FOOTER)$/.test(element.tagName),
    );
    if (dialog.hasAttribute("data-notebook-dialog")) {
      return { viewport: viewport.right, sectionGaps: gaps, panelPadding, dialog: true };
    }
    assert(regions.length === 4, "expected settings header, body, controller, and footer");
    const inset = px(style(regions[0]).paddingLeft);
    assert(
      regions.every(
        (region) =>
          near(px(style(region).paddingLeft), inset) && near(px(style(region).paddingRight), inset),
      ),
      "settings sections have inconsistent horizontal padding",
    );
    assert(
      near(inset, rootSize * (viewport.right <= 600 ? 1 : 1.25)),
      "settings inset ignores breakpoint/text size",
    );
    const controls = regions[1];
    const fieldsets = [...controls.children].filter(visible);
    assert(
      near(px(style(controls).rowGap), rootSize * 1.5),
      "settings group spacing ignores text size",
    );
    assert(
      fieldsets.every((fieldset) => inside(box(fieldset), dialogBox)),
      "settings group escapes panel",
    );
    settings = { inset, groups: fieldsets.length };
  }

  const result = {
    viewport: viewport.right,
    rootSize,
    sectionGaps: gaps,
    panelPadding,
    settings,
    marquee,
  };
  console.info("Spacing layout passed", result);
  return result;
})();
