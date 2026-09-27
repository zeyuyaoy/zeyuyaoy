import { describe, expect, test } from "bun:test";
import { advanceKonami, createKonamiKeyboard, konamiSequence } from "../src/lib/konami";

const keyEvent = (key, overrides = {}) => ({
  key,
  repeat: false,
  isComposing: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  defaultPrevented: false,
  ...overrides,
});

function keyboardFixture() {
  let time = 100;
  let unlocks = 0;
  const keyboard = createKonamiKeyboard(
    () => unlocks++,
    () => time,
  );
  return {
    keyboard,
    enter: (keys) => keys.forEach((key) => keyboard.handle(keyEvent(key))),
    wait: (ms) => {
      time += ms;
    },
    unlocks: () => unlocks,
  };
}

describe("Konami sequence", () => {
  test("controller accepts the code and uppercase letters, then starts a new attempt", () => {
    let progress = 0;
    for (const [index, key] of konamiSequence.entries()) {
      progress = advanceKonami(progress, key.length === 1 ? key.toUpperCase() : key);
      expect(progress).toBe(index + 1);
    }
    expect(advanceKonami(progress, "ArrowUp")).toBe(1);
  });

  test("wrong keys reset, overlapping up arrows retain the longest prefix", () => {
    expect(advanceKonami(4, "x")).toBe(0);
    expect(advanceKonami(2, "ArrowUp")).toBe(2);
    expect(advanceKonami(8, "ArrowUp")).toBe(1);
    expect(["ArrowUp", ...konamiSequence].reduce(advanceKonami, 0)).toBe(10);
  });

  test("physical input requires completion, handles uppercase and repeated attempts", () => {
    const f = keyboardFixture();
    f.enter(konamiSequence.slice(0, -1));
    expect(f.unlocks()).toBe(0);
    f.enter(["A"]);
    expect(f.unlocks()).toBe(1);
    f.enter(konamiSequence);
    expect(f.unlocks()).toBe(2);
  });

  test("held keys do not advance or interrupt a valid attempt", () => {
    const f = keyboardFixture();
    f.enter(["ArrowUp"]);
    f.keyboard.handle(keyEvent("ArrowUp", { repeat: true }));
    f.enter(konamiSequence.slice(1));
    expect(f.unlocks()).toBe(1);
  });

  test.each(["isComposing", "altKey", "ctrlKey", "metaKey", "defaultPrevented"])(
    "ignores and resets on %s",
    (flag) => {
      const f = keyboardFixture();
      f.enter(konamiSequence.slice(0, 9));
      f.keyboard.handle(keyEvent("a", { [flag]: true }));
      f.enter(["a"]);
      expect(f.unlocks()).toBe(0);
      f.enter(konamiSequence);
      expect(f.unlocks()).toBe(1);
    },
  );

  test("Shift allows uppercase B/A but shifted arrow selection resets progress", () => {
    const f = keyboardFixture();
    f.enter(konamiSequence.slice(0, 8));
    f.keyboard.handle(keyEvent("Shift", { shiftKey: true }));
    f.keyboard.handle(keyEvent("B", { shiftKey: true }));
    f.keyboard.handle(keyEvent("A", { shiftKey: true }));
    expect(f.unlocks()).toBe(1);
    f.enter(konamiSequence.slice(0, 3));
    f.keyboard.handle(keyEvent("ArrowDown", { shiftKey: true }));
    f.enter(konamiSequence.slice(4));
    expect(f.unlocks()).toBe(1);
  });

  test("editable fields and controls cannot complete a code or bridge attempts", () => {
    const f = keyboardFixture();
    f.enter(konamiSequence.slice(0, 9));
    f.keyboard.handle(keyEvent("a"), true);
    f.enter(["a"]);
    expect(f.unlocks()).toBe(0);
  });

  test("five seconds of inactivity resets physical input", () => {
    const f = keyboardFixture();
    f.enter(konamiSequence.slice(0, 9));
    f.wait(5000);
    f.enter(["a"]);
    expect(f.unlocks()).toBe(0);
    f.enter(konamiSequence.slice(0, 9));
    f.wait(4999);
    f.enter(["a"]);
    expect(f.unlocks()).toBe(1);
  });

  test("focus loss reset discards physical progress", () => {
    const f = keyboardFixture();
    f.enter(konamiSequence.slice(0, 9));
    f.keyboard.reset();
    f.enter(["a"]);
    expect(f.unlocks()).toBe(0);
  });

  test("controller progress is independent and has no physical-input deadline", () => {
    const f = keyboardFixture();
    let controller = konamiSequence.slice(0, 9).reduce(advanceKonami, 0);
    f.enter(konamiSequence.slice(0, 4));
    f.wait(60000);
    controller = advanceKonami(controller, "a");
    expect(controller).toBe(10);
    expect(f.unlocks()).toBe(0);
    controller = 0;
    expect(advanceKonami(controller, "a")).toBe(0);
  });
});
