import { describe, expect, test } from "bun:test";
import { runInNewContext } from "node:vm";
import { createAppearanceStore, getBrowserAppearanceStore } from "../src/lib/theme-store";
import { createKonamiKeyboard, konamiSequence } from "../src/lib/konami";
import {
  appearanceBootstrapScript,
  appearanceOptions,
  appearanceStorageKey,
  applyAppearance,
  defaultAppearance,
  normalizeAppearance,
  presets,
} from "../src/lib/appearance";

function fixture({
  saved = null,
  legacy = null,
  dark = false,
  readFails = false,
  writeFails = false,
} = {}) {
  const data = new Map();
  if (saved !== null) {
    data.set(appearanceStorageKey, saved);
  }

  if (legacy !== null) {
    data.set("theme", legacy);
  }

  const events = new EventTarget();
  const media = Object.assign(new EventTarget(), { matches: dark });
  const storage = {
    getItem(key) {
      if (readFails) {
        throw new Error("Denied");
      }
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      if (writeFails) {
        throw new Error("Quota exceeded");
      }
      data.set(key, value);
    },
  };

  const store = createAppearanceStore(
    () => storage,
    () => events,
    () => media,
  );
  return { store, data, events, media, storage };
}

describe("visitor appearance", () => {
  test.each([
    ["sundaze", "Ghibli"],
    ["everyday", "Coastal"],
    ["editorial", "Bootstrap"],
  ])("restores saved %s preferences under the renamed %s label", (id, name) => {
    const preferences = {
      ...defaultAppearance,
      preset: id,
      accent: "lavender",
      font: "mono",
      mode: "dark",
      size: "larger",
      motion: "reduce",
      marqueeSpeed: 1.75,
    };
    const { store } = fixture({ saved: JSON.stringify(preferences) });
    expect(store.getSnapshot()).toMatchObject(preferences);
    expect(presets.find((preset) => preset.id === store.getSnapshot().preset).name).toBe(name);
  });

  test.each(appearanceOptions.mode)("B&W persists and restores its defaults in %s mode", (mode) => {
    const { store, data } = fixture();
    store.update({ mode, size: "larger", motion: "reduce", marqueeSpeed: 1.75 });
    store.selectPreset("bw");
    const expected = {
      preset: "bw",
      accent: "neutral",
      font: "sans",
      mode,
      size: "larger",
      motion: "reduce",
      marqueeSpeed: 1.75,
    };
    expect(store.getSnapshot()).toMatchObject(expected);
    expect(fixture({ saved: data.get(appearanceStorageKey) }).store.getSnapshot()).toMatchObject(
      expected,
    );

    store.update({ accent: "ocean", font: "serif" });
    expect(fixture({ saved: data.get(appearanceStorageKey) }).store.getSnapshot()).toMatchObject({
      ...expected,
      accent: "ocean",
      font: "serif",
    });
    store.selectPreset("bw");
    expect(store.getSnapshot()).toMatchObject(expected);
    store.reset();
    expect(JSON.parse(data.get(appearanceStorageKey))).toEqual(defaultAppearance);
  });

  test("B&W syncs between tabs and follows system mode changes", () => {
    const source = fixture();
    const target = fixture();
    const unsubscribe = target.store.subscribe(() => {});
    source.store.selectPreset("bw");
    target.data.set(appearanceStorageKey, source.data.get(appearanceStorageKey));
    target.events.dispatchEvent(Object.assign(new Event("storage"), { key: appearanceStorageKey }));
    expect(target.store.getSnapshot()).toMatchObject({
      preset: "bw",
      accent: "neutral",
      font: "sans",
      mode: "system",
      resolvedMode: "light",
    });
    target.media.matches = true;
    target.media.dispatchEvent(new Event("change"));
    expect(target.store.getSnapshot()).toMatchObject({ preset: "bw", resolvedMode: "dark" });
    unsubscribe();
  });

  test("uses stable server and client snapshots, resolving system mode on the client", () => {
    const { store } = fixture({ dark: true });
    expect(store.getServerSnapshot().resolvedMode).toBe("light");
    expect(store.getSnapshot().resolvedMode).toBe("dark");
    expect(store.getSnapshot()).toBe(store.getSnapshot());
    store.update({ font: "serif" });
    expect(store.getServerSnapshot().font).toBe("rounded");
  });

  test("migrates the old preference once and gives new preferences precedence", () => {
    const { store, data } = fixture({ legacy: "dark" });
    expect(store.getSnapshot().mode).toBe("dark");
    expect(JSON.parse(data.get(appearanceStorageKey)).mode).toBe("dark");

    const other = fixture({
      legacy: "dark",
      saved: JSON.stringify({ ...defaultAppearance, mode: "light" }),
    });
    expect(other.store.getSnapshot().resolvedMode).toBe("light");
  });

  test("ordinary presets preserve mode and independent preferences", () => {
    const { store, data } = fixture();
    store.update({ mode: "dark", size: "larger", motion: "reduce" });
    store.selectPreset("goofball");
    expect(store.getSnapshot()).toMatchObject({
      preset: "goofball",
      font: "comic",
      accent: "lavender",
      mode: "dark",
      size: "larger",
      motion: "reduce",
    });

    store.update({ font: "mono", accent: "ocean" });

    const reloaded = fixture({ saved: data.get(appearanceStorageKey) }).store;
    expect(reloaded.getSnapshot()).toMatchObject({
      preset: "goofball",
      font: "mono",
      accent: "ocean",
    });
    store.selectPreset("editorial");
    expect(store.getSnapshot()).toMatchObject({
      font: "serif",
      accent: "terracotta",
      size: "larger",
    });
    store.reset();
    expect(JSON.parse(data.get(appearanceStorageKey))).toEqual(defaultAppearance);
  });

  test("normalizes malformed, future-version and unrecognized values", () => {
    for (const saved of ["{broken", "null", "[]", '{"version":2,"font":"comic"}']) {
      expect(fixture({ saved }).store.getSnapshot()).toMatchObject(defaultAppearance);
    }

    const result = normalizeAppearance(
      {
        version: 1,
        font: "serif",
        accent: "url(evil)",
        size: 200,
      },
      defaultAppearance,
      appearanceOptions,
    );

    expect(result).toEqual({ ...defaultAppearance, font: "serif" });
  });

  test("restores, bounds, and resets photo speed while accepting older saved preferences", () => {
    const { marqueeSpeed, ...legacyPreferences } = defaultAppearance;
    const { store, data } = fixture({ saved: JSON.stringify(legacyPreferences) });
    expect(store.getSnapshot().marqueeSpeed).toBe(2.5);

    store.update({ marqueeSpeed: 1.75 });
    store.selectPreset("editorial");
    expect(
      fixture({ saved: data.get(appearanceStorageKey) }).store.getSnapshot().marqueeSpeed,
    ).toBe(1.75);

    store.update({ marqueeSpeed: 100 });
    expect(store.getSnapshot().marqueeSpeed).toBe(25);

    store.update({ marqueeSpeed: -1 });
    expect(store.getSnapshot().marqueeSpeed).toBe(0.5);

    store.update({ marqueeSpeed: 1.3 });
    expect(store.getSnapshot().marqueeSpeed).toBe(1.25);

    for (const invalid of [NaN, Infinity, "fast", null]) {
      expect(
        normalizeAppearance(
          {
            ...defaultAppearance,
            marqueeSpeed: invalid,
          },
          defaultAppearance,
          appearanceOptions,
        ).marqueeSpeed,
      ).toBe(marqueeSpeed);
    }

    store.reset();
    expect(store.getSnapshot().marqueeSpeed).toBe(2.5);
  });

  test.each([{ readFails: true }, { writeFails: true }])(
    "keeps changes in memory when storage fails: %j",
    (options) => {
      const { store } = fixture(options);
      store.selectPreset("goofball");
      store.toggle();

      expect(store.getSnapshot()).toMatchObject({
        font: "comic",
        resolvedMode: "dark",
        storageAvailable: false,
      });
      store.toggle();

      expect(store.getSnapshot().resolvedMode).toBe("light");
      store.reset();

      expect(store.getSnapshot()).toMatchObject({ ...defaultAppearance, storageAvailable: false });
    },
  );

  test("synchronizes tabs and system changes, honors explicit mode, and removes listeners", () => {
    const { store, data, events, media } = fixture();
    let notifications = 0;
    const unsubscribe = store.subscribe(() => notifications++);
    const initial = notifications;

    media.matches = true;
    media.dispatchEvent(new Event("change"));
    expect(store.getSnapshot().resolvedMode).toBe("dark");
    store.toggle();
    expect(store.getSnapshot()).toMatchObject({ mode: "light", resolvedMode: "light" });

    media.dispatchEvent(new Event("change"));
    expect(store.getSnapshot().resolvedMode).toBe("light");
    data.set(
      appearanceStorageKey,
      JSON.stringify({ ...defaultAppearance, preset: "editorial", font: "serif" }),
    );
    events.dispatchEvent(Object.assign(new Event("storage"), { key: appearanceStorageKey }));
    expect(store.getSnapshot()).toMatchObject({ font: "serif", resolvedMode: "dark" });

    const snapshot = store.getSnapshot();
    events.dispatchEvent(Object.assign(new Event("storage"), { key: "unrelated" }));
    expect(store.getSnapshot()).toBe(snapshot);
    expect(notifications).toBeGreaterThan(initial);
    unsubscribe();

    const count = notifications;
    media.dispatchEvent(new Event("change"));
    events.dispatchEvent(new Event("storage"));
    expect(notifications).toBe(count);
  });

  test("pre-paint script agrees with client for every preset and mode", () => {
    for (const preset of presets) {
      for (const mode of appearanceOptions.mode) {
        const preferences = {
          ...defaultAppearance,
          preset: preset.id,
          accent: preset.accent,
          font: preset.font,
          mode,
          marqueeSpeed: 1.75,
          cyberpunkUnlocked: preset.id === "cyberpunk",
        };
        const f = fixture({ saved: JSON.stringify(preferences), dark: true });
        const root = { dataset: {} };
        runInNewContext(appearanceBootstrapScript(), {
          document: { documentElement: root },
          localStorage: f.storage,
          window: { matchMedia: () => f.media },
        });
        const client = { dataset: {} };
        applyAppearance(client, f.store.getSnapshot(), true);
        expect(root.dataset).toEqual(client.dataset);
        expect(root.dataset.palette).toBe(preset.id);
      }
    }
  });

  test("Cyberpunk is locked by default and accepts only a boolean unlock", () => {
    const { store } = fixture();
    store.selectPreset("cyberpunk");
    expect(store.getSnapshot()).toMatchObject(defaultAppearance);
    for (const cyberpunkUnlocked of [undefined, false, "true", 1]) {
      expect(
        normalizeAppearance(
          {
            ...defaultAppearance,
            preset: "cyberpunk",
            accent: "neon",
            cyberpunkUnlocked,
          },
          defaultAppearance,
          appearanceOptions,
        ),
      ).toMatchObject({
        preset: "sundaze",
        accent: "sage",
        cyberpunkUnlocked: false,
      });
    }
    const { cyberpunkUnlocked, ...oldPreferences } = defaultAppearance;
    expect(cyberpunkUnlocked).toBe(false);
    expect(fixture({ saved: JSON.stringify(oldPreferences) }).store.getSnapshot()).toMatchObject(
      defaultAppearance,
    );
  });

  test("unlock selects and persists Cyberpunk while retaining independent preferences", () => {
    const { store, data } = fixture();
    store.update({ mode: "light", size: "larger", motion: "reduce", marqueeSpeed: 1.75 });
    store.unlockCyberpunk();
    const expected = {
      cyberpunkUnlocked: true,
      preset: "cyberpunk",
      accent: "neon",
      font: "mono",
      mode: "dark",
      size: "larger",
      motion: "reduce",
      marqueeSpeed: 1.75,
    };
    expect(store.getSnapshot()).toMatchObject(expected);
    expect(fixture({ saved: data.get(appearanceStorageKey) }).store.getSnapshot()).toMatchObject(
      expected,
    );
    const snapshot = store.getSnapshot();
    store.unlockCyberpunk();
    expect(store.getSnapshot()).toBe(snapshot);
    store.selectPreset("editorial");
    expect(store.getSnapshot()).toMatchObject({ preset: "editorial", cyberpunkUnlocked: true });
    store.unlockCyberpunk();
    expect(store.getSnapshot()).toMatchObject(expected);
    store.reset();
    expect(JSON.parse(data.get(appearanceStorageKey))).toEqual({
      ...defaultAppearance,
      cyberpunkUnlocked: true,
    });
    store.selectPreset("cyberpunk");
    expect(store.getSnapshot().preset).toBe("cyberpunk");
  });

  test.each([{}, { readFails: true }, { writeFails: true }])(
    "keyboard unlock reaches current subscribers from a retained store without reload: %j",
    (options) => {
      const f = fixture(options);
      const browser = Object.assign(f.events, {
        localStorage: f.storage,
        matchMedia: () => f.media,
      });
      const original = getBrowserAppearanceStore(browser);
      original.getSnapshot();
      const keyboard = createKonamiKeyboard(original.unlockCyberpunk);
      const current = getBrowserAppearanceStore(browser);
      expect(current).toBe(original);
      const root = { dataset: {} };
      let visiblePresets = [];
      let notifications = 0;
      const unsubscribe = current.subscribe(() => {
        const value = current.getSnapshot();
        applyAppearance(root, value, value.resolvedMode === "dark");
        visiblePresets = presets.filter(
          (preset) => preset.id !== "cyberpunk" || value.cyberpunkUnlocked,
        );
        notifications++;
      });
      expect(visiblePresets.some((preset) => preset.id === "cyberpunk")).toBe(false);
      const before = notifications;
      for (const key of konamiSequence) {
        keyboard.handle({ key });
      }
      expect(notifications).toBe(before + 1);
      expect(visiblePresets.some((preset) => preset.id === "cyberpunk")).toBe(true);
      expect(root.dataset).toMatchObject({
        palette: "cyberpunk",
        theme: "dark",
        accent: "neon",
        font: "mono",
      });
      expect(current.getSnapshot()).toMatchObject({ cyberpunkUnlocked: true, preset: "cyberpunk" });

      current.selectPreset("bw");
      expect(original.getSnapshot().preset).toBe("bw");
      for (const key of konamiSequence) {
        keyboard.handle({ key });
      }
      expect(root.dataset.palette).toBe("cyberpunk");
      unsubscribe();
      const last = notifications;
      original.selectPreset("bw");
      expect(notifications).toBe(last);
    },
  );

  test.each(["light", "system"])(
    "Cyberpunk selection and repeated unlock restore dark from %s",
    (mode) => {
      const { store, data } = fixture();
      const unsubscribe = store.subscribe(() => {
        if (store.getSnapshot().mode === "dark") {
          expect(store.getSnapshot()).toMatchObject({
            preset: "cyberpunk",
            accent: "neon",
            font: "mono",
          });
        }
      });
      store.update({ mode });
      store.unlockCyberpunk();
      for (const select of [() => store.selectPreset("cyberpunk"), () => store.unlockCyberpunk()]) {
        store.update({ mode, font: "serif", accent: "ocean" });
        const reloaded = fixture({ saved: data.get(appearanceStorageKey) }).store;
        expect(reloaded.getSnapshot()).toMatchObject({
          preset: "cyberpunk",
          mode,
          font: "serif",
          accent: "ocean",
        });
        select();
        expect(store.getSnapshot()).toMatchObject({
          mode: "dark",
          resolvedMode: "dark",
          accent: "neon",
          font: "mono",
        });
      }
      unsubscribe();
      store.selectPreset("sundaze");
      expect(store.getSnapshot().mode).toBe("dark");
    },
  );

  test.each([{ readFails: true }, { writeFails: true }])(
    "unlock survives in memory when storage fails: %j",
    (options) => {
      const { store } = fixture(options);
      store.unlockCyberpunk();
      expect(store.getSnapshot()).toMatchObject({
        preset: "cyberpunk",
        mode: "dark",
        cyberpunkUnlocked: true,
        storageAvailable: false,
      });
      store.reset();
      expect(store.getSnapshot()).toMatchObject({
        ...defaultAppearance,
        cyberpunkUnlocked: true,
        storageAvailable: false,
      });
    },
  );

  test("unlock syncs across tabs and clearing storage removes it", () => {
    const source = fixture();
    const target = fixture();
    const unsubscribe = target.store.subscribe(() => {});
    source.store.unlockCyberpunk();
    target.data.set(appearanceStorageKey, source.data.get(appearanceStorageKey));
    target.events.dispatchEvent(Object.assign(new Event("storage"), { key: appearanceStorageKey }));
    expect(target.store.getSnapshot()).toMatchObject({
      preset: "cyberpunk",
      mode: "dark",
      cyberpunkUnlocked: true,
    });
    source.store.update({ mode: "light" });
    target.data.set(appearanceStorageKey, source.data.get(appearanceStorageKey));
    target.events.dispatchEvent(Object.assign(new Event("storage"), { key: appearanceStorageKey }));
    expect(target.store.getSnapshot()).toMatchObject({
      preset: "cyberpunk",
      mode: "light",
      resolvedMode: "light",
    });
    target.data.clear();
    target.events.dispatchEvent(Object.assign(new Event("storage"), { key: null }));
    expect(target.store.getSnapshot()).toMatchObject(defaultAppearance);
    unsubscribe();
  });

  test("pre-paint script recovers from unavailable storage, corruption, and legacy settings", () => {
    for (const options of [{ readFails: true }, { saved: "{broken" }, { legacy: "dark" }]) {
      const f = fixture(options);
      const root = { dataset: {} };
      runInNewContext(appearanceBootstrapScript(), {
        document: { documentElement: root },
        localStorage: f.storage,
        window: { matchMedia: () => f.media },
      });
      expect(root.dataset.theme).toBe(f.store.getSnapshot().resolvedMode);
      expect(root.dataset.palette).toBe("sundaze");
    }
  });
});
