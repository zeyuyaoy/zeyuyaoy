(() => {
  const track = document.querySelector('[class*="PhotoMarqueeBackground"][class*="track"]');
  const assert = (condition, message) => {
    if (!condition) {
      throw new Error(`Marquee layout: ${message}`);
    }
  };
  const near = (a, b) => Math.abs(a - b) <= 1;
  assert(track, "track is missing");
  const row = track.parentElement;
  if (document.documentElement.clientWidth <= 800) {
    assert(track.getClientRects().length === 0, "mobile marquee must be hidden");
    console.info("Marquee layout passed: hidden on mobile");
    return { hidden: true };
  }

  const groups = [...track.children];
  assert(groups.length === 2, "expected two sequence copies");
  const trackBox = track.getBoundingClientRect();
  const rowBox = row.getBoundingClientRect();
  const firstBox = groups[0].getBoundingClientRect();
  assert(rowBox.height > 0 && firstBox.width > 0, "visible marquee has empty geometry");
  assert(near(trackBox.width, 2 * firstBox.width), "track must span exactly two sequences");
  assert(near(trackBox.left, firstBox.left), "first sequence must start at the track edge");

  for (const [copy, group] of groups.entries()) {
    if (getComputedStyle(group).display === "none") {
      assert(
        copy === 1 && getComputedStyle(track).animationName === "none",
        "unexpected hidden copy",
      );
      continue;
    }
    const box = group.getBoundingClientRect();
    const frames = [...group.children].map((frame) => frame.getBoundingClientRect());
    assert(
      frames.length === Number(getComputedStyle(row).getPropertyValue("--photo-count")),
      "photo count differs from layout",
    );
    assert(near(box.width, firstBox.width), "sequence copies must have equal widths");
    assert(
      near(box.width / frames.length, (rowBox.height * 16) / 9),
      "sequence width must follow row height",
    );
    assert(
      near(frames[0].left, box.left) && near(frames.at(-1).right, box.right),
      "photos must fill their sequence",
    );
    for (const [index, frame] of frames.entries()) {
      assert(frame.width > 0 && frame.height > 0, `copy ${copy}, photo ${index}: empty frame`);
      assert(
        frame.left >= box.left - 1 &&
          frame.right <= box.right + 1 &&
          frame.top >= box.top - 1 &&
          frame.bottom <= box.bottom + 1,
        `copy ${copy}, photo ${index}: outside sequence`,
      );
      if (index > 0) {
        assert(
          near(frames[index - 1].right, frame.left),
          `copy ${copy}, photo ${index}: gap or overlap`,
        );
      }
    }
    if (copy === 1) {
      assert(near(firstBox.right, box.left), "sequence copies overlap or have a gap");
      assert(near(box.right, trackBox.right), "second sequence must end at the track edge");
    }
  }
  const result = {
    viewport: document.documentElement.clientWidth,
    rowHeight: rowBox.height,
    sequenceWidth: firstBox.width,
    trackWidth: trackBox.width,
  };
  console.info("Marquee layout passed", result);
  return result;
})();
