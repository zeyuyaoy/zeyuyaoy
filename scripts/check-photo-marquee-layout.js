(() => {
  const assert = (condition, message) => {
    if (!condition) {
      throw new Error(`Marquee layout: ${message}`);
    }
  };
  const roots = [...document.querySelectorAll("[data-marquee-root]")];
  assert(roots.length > 0, "photo strip is missing");
  return roots.map((root) => {
    const section = root.dataset.photoSection;
    const expected = { about: 28, experience: 48, education: 28 }[section];
    const groups = [...root.querySelectorAll("[data-marquee-track] > div")];
    assert(groups.length === 2, "each strip needs two loop copies");
    const sources = groups.map((group) =>
      [...group.querySelectorAll("img")].map((image) => image.getAttribute("src")),
    );
    assert(
      sources.every((copy) => copy.length === expected),
      "wrong photo count",
    );
    assert(JSON.stringify(sources[0]) === JSON.stringify(sources[1]), "loop copies differ");
    assert(new Set(sources[0]).size === expected, "photos repeat within the sequence");
    assert(
      [...root.querySelectorAll("img")].every((image) => !image.hasAttribute("srcset")),
      "photos must bypass transformations",
    );
    if (section === "about" && innerWidth <= 800) {
      assert(root.getClientRects().length === 0, "mobile homepage background must remain hidden");
    } else {
      const box = root.getBoundingClientRect();
      assert(box.width > 0 && box.height > 0, "visible strip has no geometry");
      const frame = groups[0].firstElementChild.getBoundingClientRect();
      assert(Math.abs(frame.width / frame.height - 16 / 9) < 0.02, "photos must stay 16:9");
    }
    return { section, uniquePhotos: expected, mode: root.dataset.marqueeMode };
  });
})();
