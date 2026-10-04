import { describe, expect, test } from "bun:test";
import {
  createMarqueeDurationUpdater,
  createMarqueeNavigator,
  marqueeDuration,
  marqueeSeekDuration,
  retimeMarquee,
} from "../src/lib/photo-marquee-motion";

const sections = [
  { id: "about", start: 0, count: 28 },
  { id: "experience", start: 28, count: 48 },
  { id: "education", start: 76, count: 28 },
];

describe("marquee section navigation", () => {
  test("starts on About without a transition", () => {
    expect(createMarqueeNavigator(sections).advance(1000)).toEqual({
      selected: "about",
      position: 0,
      seeking: false,
    });
  });

  for (const from of sections) {
    for (const to of sections.filter((section) => section.id !== from.id)) {
      test(`${from.id} → ${to.id} always travels forward and lands after 600 ms`, () => {
        const navigator = createMarqueeNavigator(sections);
        navigator.select(from.id, 0);
        navigator.settle();
        navigator.select(to.id, 1000);
        let last = from.start;
        let distance = 0;
        for (let elapsed = 0; elapsed <= marqueeSeekDuration; elapsed += 10) {
          const state = navigator.advance(1000 + elapsed);
          distance += (state.position - last + 104) % 104;
          last = state.position;
          expect(state.selected).toBe(to.id);
          expect(state.seeking).toBe(elapsed < 600);
        }
        expect(distance).toBeCloseTo((to.start - from.start + 104) % 104, 8);
        expect(last).toBe(to.start);
        expect(navigator.advance(10000).position).toBe(to.start);
      });
    }
  }

  test("a rapid change retargets from the current position and cancels the old destination", () => {
    const navigator = createMarqueeNavigator(sections);
    navigator.select("education", 0);
    expect(navigator.advance(300).position).toBe(38);
    navigator.select("experience", 300);
    expect(navigator.advance(300).position).toBe(38);
    expect(navigator.advance(600)).toEqual({ selected: "experience", position: 85, seeking: true });
    expect(navigator.advance(900)).toEqual({
      selected: "experience",
      position: 28,
      seeking: false,
    });
  });

  test("reselecting the active target does not restart motion", () => {
    const navigator = createMarqueeNavigator(sections);
    expect(navigator.select("about", 0)).toBe(false);
    navigator.select("education", 0);
    expect(navigator.select("education", 300)).toBe(false);
    expect(navigator.advance(600)).toEqual({ selected: "education", position: 76, seeking: false });
  });

  test("returning immediately to the starting section wraps forward instead of snapping", () => {
    const navigator = createMarqueeNavigator(sections);
    navigator.select("experience", 0);
    navigator.select("about", 0);
    expect(navigator.advance(300)).toEqual({ selected: "about", position: 52, seeking: true });
    expect(navigator.advance(600)).toEqual({ selected: "about", position: 0, seeking: false });
  });

  test("hiding or reducing motion settles the latest destination and cancels pending movement", () => {
    const navigator = createMarqueeNavigator(sections);
    navigator.select("education", 0);
    navigator.advance(250);
    navigator.select("experience", 250);
    expect(navigator.settle()).toEqual({ selected: "experience", position: 28, seeking: false });
    expect(navigator.advance(5000)).toEqual({
      selected: "experience",
      position: 28,
      seeking: false,
    });
  });

  test("positions stay in photo units while layout and normal playback speed change", () => {
    const navigator = createMarqueeNavigator(sections);
    navigator.select("experience", 0);
    const halfway = navigator.advance(300);
    expect(halfway.position).toBe(14);
    expect(marqueeDuration(28 * 600, 1512, 2.5, 0.9)).not.toBe(
      marqueeDuration(28 * 800, 1100, 25, 0.9),
    );
    expect(navigator.advance(300)).toEqual(halfway);
    expect(navigator.advance(600).position).toBe(28);
  });
});

function position(time, duration, delay, reverse = false) {
  const elapsed = (time - delay) / duration;
  const phase = ((elapsed % 1) + 1) % 1;
  return reverse ? 1 - phase : phase;
}

function fixture({ duration = 330000, delay = 0, time = 82000 } = {}) {
  const writes = [];
  let currentTime = time;

  const animation = {
    effect: { getTiming: () => ({ duration, delay }) },
    get currentTime() {
      return currentTime;
    },
    set currentTime(value) {
      writes.push(["time", value]);
      currentTime = value;
    },
  };

  const track = { style: { setProperty: (name, value) => writes.push([name, value]) } };
  return { track, animation, writes };
}

describe("marquee timing", () => {
  test("keeps screen-relative speeds and row factors at every slider extreme", () => {
    for (const width of [390, 1280, 3840]) {
      for (const speed of [0.5, 2.5, 25]) {
        for (const factor of [1, 0.8, 0.9]) {
          const duration = marqueeDuration(17000, width, speed, factor);
          expect(17000 / (duration / 1000) / width).toBeCloseTo(speed * 0.02 * factor, 10);
        }
      }
    }
  });

  test("waits for valid geometry instead of producing a stopped or invalid animation", () => {
    for (const invalid of [0, -1, NaN, Infinity, -Infinity]) {
      expect(marqueeDuration(invalid, 1280, 2.5, 1)).toBeNull();
      expect(marqueeDuration(17000, invalid, 2.5, 1)).toBeNull();
      expect(marqueeDuration(17000, 1280, invalid, 1)).toBeNull();
      expect(marqueeDuration(17000, 1280, 2.5, invalid)).toBeNull();
    }
  });

  test("preserves visible position in both directions, including multi-loop negative delays", () => {
    for (const reverse of [false, true]) {
      for (const delay of [0, -33000, -54000]) {
        for (const time of [0, 16.67, 82000, 990000]) {
          for (const newDuration of [5000, 27000, 1700000]) {
            const next = retimeMarquee(time, 330000, delay, newDuration);
            expect(next).toBeGreaterThanOrEqual(0);
            expect(position(next, newDuration, delay, reverse)).toBeCloseTo(
              position(time, 330000, delay, reverse),
              9,
            );
          }
        }
      }
    }
  });

  test("rejects unresolved or invalid timing", () => {
    expect(retimeMarquee(NaN, 330000, 0, 10000)).toBeNull();
    expect(retimeMarquee(1000, 0, 0, 10000)).toBeNull();
    expect(retimeMarquee(1000, 330000, Infinity, 10000)).toBeNull();
    expect(retimeMarquee(1000, 330000, 0, -1)).toBeNull();
  });

  test("batches reads before writes and suppresses unchanged updates without seeking again", () => {
    const prepare = createMarqueeDurationUpdater();
    const { track, animation, writes } = fixture();
    const apply = prepare(track, animation, 270000);
    expect(writes).toEqual([]);
    apply();
    expect(writes[0]).toEqual(["--loop-duration", "270000ms"]);
    expect(writes[1][0]).toBe("time");
    expect(prepare(track, animation, 270000)).toBeNull();
    expect(prepare(track, animation, 270000.001)).toBeNull();
    expect(writes).toHaveLength(2);
    expect(prepare(track, animation, 200000)).toBeFunction();
  });

  test("reconciles a replacement animation after reduced motion even at the same speed", () => {
    const prepare = createMarqueeDurationUpdater();
    const { track, animation } = fixture();
    prepare(track, animation, 270000)();
    const replacement = fixture({ time: 0, delay: -33000 }).animation;
    expect(prepare(track, replacement, 270000)).toBeFunction();
  });

  test("does not cache an unresolved animation or an unapplied update", () => {
    const prepare = createMarqueeDurationUpdater();
    const { track, animation, writes } = fixture();
    animation.currentTime = null;
    expect(prepare(track, animation, 270000)).toBeNull();
    animation.currentTime = 0;
    expect(prepare(track, animation, 270000)).toBeFunction();
    expect(prepare(track, animation, 270000)).toBeFunction();
    expect(writes.every(([name]) => name === "time")).toBe(true);
  });
});
