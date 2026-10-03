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
    element.getClientRects().length > 0 && style(element).visibility !== "hidden";
  const inside = (inner, outer) => inner.left >= outer.left - 1 && inner.right <= outer.right + 1;
  const viewport = { left: 0, right: document.documentElement.clientWidth };
  const rootSize = px(style(document.documentElement).fontSize);
  const intro = document.querySelector('main [data-home-section="intro"]');
  assert(intro, "homepage intro is missing");
  const layout = intro.parentElement;
  const sections = [...layout.children].filter((element) =>
    element.hasAttribute("data-home-section"),
  );
  assert(sections.length === 4, "expected intro, profile, widgets, and footer");
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

  const profile = sections.find((section) => section.dataset.homeSection === "bio");
  const widgets = sections.find((section) => section.dataset.homeSection === "widgets");
  const notebook = widgets.querySelector('[class*="notebookContent"]');
  assert(profile && notebook, "profile or project panel is missing");
  const panelPadding = px(style(profile).paddingLeft);
  assert(near(panelPadding, px(style(notebook).paddingLeft)), "outer panels use different padding");
  assert(near(panelPadding, px(style(profile).paddingRight)), "profile padding is asymmetric");
  assert(near(panelPadding, px(style(notebook).paddingRight)), "notebook padding is asymmetric");
  const expectedPanelPadding = rootSize * (viewport.right <= 560 ? 1 : 1.25);
  assert(
    near(panelPadding, expectedPanelPadding),
    "panel padding does not follow text size/breakpoint",
  );

  if (viewport.right <= 960) {
    assert(near(gap, px(style(widgets).rowGap)), "stacked widgets diverge from section rhythm");
    assert(near(gap, px(style(intro).gap)), "intro diverges from stacked section rhythm");
    const widgetChildren = [...widgets.children];
    assert(
      near(box(widgetChildren[1]).top - box(widgetChildren[0]).bottom, gap),
      "rendered stacked widgets have extra space",
    );
    assert(
      sections
        .filter((section) => section !== profile)
        .every(
          (section) => style(section).minHeight === "auto" || px(style(section).minHeight) === 0,
        ),
      "desktop section-height reservations leaked into mobile",
    );
  } else {
    const [projects, spotify] = [...widgets.children];
    assert(near(box(projects).top, box(spotify).top), "desktop widgets are not aligned");
    assert(near(box(projects).width, box(spotify).width), "desktop widget columns differ");
  }

  const cards = [...notebook.querySelectorAll('[class*="projectLink"] > [class*="project"]')];
  const expectedCardPadding = rootSize * (viewport.right <= 560 ? 0.75 : 1);
  assert(
    cards.every((card) => near(px(style(card).paddingLeft), expectedCardPadding)),
    "nested card padding is inconsistent",
  );

  const footer = sections.find((section) => section.dataset.homeSection === "footer");
  const footerControls = [...footer.querySelectorAll('nav, button[aria-haspopup="dialog"]')];
  assert(
    footerControls.every((element) => inside(box(element), box(footer))),
    "expanded footer controls escape their panel",
  );

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
    assert(dialog.scrollWidth <= dialog.clientWidth + 1, "dialog contents overflow horizontally");
    const regions = [...dialog.children].filter((element) =>
      /^(HEADER|DIV|SECTION|FOOTER)$/.test(element.tagName),
    );
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
