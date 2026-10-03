import { describe, expect, test } from "bun:test";
import { advanceWheelGesture, initialWheelGesture } from "../src/lib/profile-carousel";

const wheel = (state, overrides = {}) =>
  advanceWheelGesture(state, {
    time: 1000,
    deltaX: 0,
    deltaY: 80,
    canScroll: false,
    canNavigate: true,
    ...overrides,
  });

describe("profile carousel wheel gestures", () => {
  test("accumulates deliberate movement and consumes momentum after one slide", () => {
    const first = wheel(initialWheelGesture, { deltaY: 40 });
    expect(first.direction).toBe(0);
    expect(first.preventDefault).toBe(true);
    const second = wheel(first.state, { time: 1030, deltaY: 35 });
    expect(second.direction).toBe(1);
    const momentum = wheel(second.state, { time: 1080 });
    expect(momentum.direction).toBe(0);
    expect(momentum.preventDefault).toBe(true);
    expect(wheel(momentum.state, { time: 1300 }).direction).toBe(1);
  });

  test("reading long text cannot advance an entry within the same gesture", () => {
    const reading = wheel(initialWheelGesture, { canScroll: true });
    expect(reading.preventDefault).toBe(false);
    const boundary = wheel(reading.state, { time: 1030 });
    expect(boundary.direction).toBe(0);
    expect(boundary.preventDefault).toBe(false);
    expect(wheel(boundary.state, { time: 1250 }).direction).toBe(1);
  });

  test("releases page scrolling at the first and last entry", () => {
    for (const deltaY of [-100, 100]) {
      const result = wheel(initialWheelGesture, { deltaY, canNavigate: false });
      expect(result.direction).toBe(0);
      expect(result.preventDefault).toBe(false);
    }
  });

  test("horizontal trackpad input is not intercepted", () => {
    const result = wheel(initialWheelGesture, { deltaX: 100 });
    expect(result.direction).toBe(0);
    expect(result.preventDefault).toBe(false);
  });

  test("changing direction requires fresh movement in that direction", () => {
    const forward = wheel(initialWheelGesture, { deltaY: 60 });
    const reverse = wheel(forward.state, { time: 1030, deltaY: -30 });
    expect(reverse.direction).toBe(0);
    expect(wheel(reverse.state, { time: 1060, deltaY: -45 }).direction).toBe(-1);
  });
});
