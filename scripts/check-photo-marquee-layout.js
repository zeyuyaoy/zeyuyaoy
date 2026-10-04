(() => {
  const root = document.querySelector("[data-marquee-root]");
  const assert = (condition, message) => {
    if (!condition) {
      throw new Error(`Marquee layout: ${message}`);
    }
  };
  const near = (a, b) => Math.abs(a - b) <= 1;
  assert(root, "background is missing");
  const master = root.querySelector("[data-marquee-master]");
  const sections = [...master.children];
  const expected = [
    ["about", 0, 28],
    ["experience", 28, 48],
    ["education", 76, 28],
    ["about", 104, 28],
  ];
  const tab = root.dataset.profileTab;
  const mode = root.dataset.marqueeMode;
  const selectedTab = document.querySelector('[role="tab"][aria-selected="true"]');
  assert(selectedTab?.id.endsWith(`-tab-${tab}`), "selected tab and destination differ");
  assert(sections.length === 4, "expected three sections and the About wraparound bridge");
  assert(root.querySelectorAll("img").length === 264, "all 264 image elements must stay mounted");
  const photoSources = [];
  for (const [index, section] of sections.entries()) {
    const [id, start, count] = expected[index];
    assert(section.dataset.marqueeSection === id, "section order differs");
    assert(Number(section.dataset.marqueeStart) === start, "section boundary differs");
    assert(Number(section.dataset.marqueeCount) === count, "section count differs");
    assert((section.dataset.marqueeBridge === "true") === (index === 3), "wrong wraparound bridge");
    const groups = [...section.firstElementChild.children];
    assert(groups.length === 2, "each section needs two loop copies");
    const sources = groups.map((group) => [...group.querySelectorAll("img")].map((img) => img.src));
    assert(
      sources.every((copy) => copy.length === count),
      "loop copy has the wrong photo count",
    );
    assert(JSON.stringify(sources[0]) === JSON.stringify(sources[1]), "loop copies differ");
    photoSources.push(sources[0]);
  }
  assert(
    new Set(photoSources.slice(0, 3).flat()).size === 104,
    "primary sections must partition all photos",
  );
  assert(
    JSON.stringify(photoSources[0]) === JSON.stringify(photoSources[3]),
    "About bridge differs",
  );

  if (document.documentElement.clientWidth <= 800) {
    assert(root.getClientRects().length === 0, "mobile marquee must be hidden");
    return { hidden: true, tab, mountedPhotos: 264 };
  }

  const rootBox = root.getBoundingClientRect();
  const masterBox = master.getBoundingClientRect();
  const photoWidth = sections[0].getBoundingClientRect().width / 28;
  assert(rootBox.height > 0 && photoWidth > 0, "visible marquee has empty geometry");
  assert(near(photoWidth, (rootBox.height * 16) / 9), "photo dimensions must remain 16:9");
  assert(near(masterBox.width, photoWidth * 132), "outer strip must include the wraparound bridge");

  for (const [index, section] of sections.entries()) {
    const [, start, count] = expected[index];
    const sectionBox = section.getBoundingClientRect();
    const track = section.firstElementChild;
    const trackBox = track.getBoundingClientRect();
    const groups = [...track.children];
    assert(
      near(sectionBox.left, masterBox.left + start * photoWidth),
      "section has a gap or overlap",
    );
    assert(
      near(sectionBox.width, count * photoWidth),
      "section width differs from its photo count",
    );
    assert(near(trackBox.width, 2 * sectionBox.width), "local track must span two copies");
    const firstBox = groups[0].getBoundingClientRect();
    assert(near(firstBox.left, trackBox.left), "first loop copy must start at the track edge");
    for (const [copy, group] of groups.entries()) {
      if (getComputedStyle(group).display === "none") {
        assert(copy === 1 && mode === "reduced", "unexpected hidden loop copy");
        continue;
      }
      const box = group.getBoundingClientRect();
      const frames = [...group.children].map((frame) => frame.getBoundingClientRect());
      assert(near(box.width, sectionBox.width), "loop copies must fill their section");
      assert(near(box.left, firstBox.left + copy * box.width), "loop copies have a gap or overlap");
      for (const [frameIndex, frame] of frames.entries()) {
        assert(frame.width > 0 && frame.height > 0, "photo has empty geometry");
        assert(
          near(frame.left, box.left + frameIndex * photoWidth),
          "photos have a gap or overlap",
        );
        assert(near(frame.width, photoWidth), "photo width differs from the section grid");
        assert(near(frame.top, box.top) && near(frame.bottom, box.bottom), "photo exceeds its row");
      }
      assert(near(frames.at(-1).right, box.right), "last photo must fill the copy");
    }
  }

  assert(
    ["looping", "seeking", "reduced"].includes(mode),
    "visible motion controller is not ready",
  );
  if (mode !== "seeking") {
    const selected = sections.find((section) => section.dataset.marqueeSection === tab);
    const selectedBox = selected.getBoundingClientRect();
    assert(near(selectedBox.left, rootBox.left), "destination must align with the viewport");
    assert(selectedBox.right >= rootBox.right, "another section is visible during a local loop");
    assert(
      Number(root.dataset.marqueePosition) === Number(selected.dataset.marqueeStart),
      "destination anchor differs",
    );
  }
  return {
    tab,
    mode,
    mountedPhotos: 264,
    uniquePhotos: 104,
    viewport: document.documentElement.clientWidth,
    photoWidth,
    outerWidth: masterBox.width,
  };
})();
