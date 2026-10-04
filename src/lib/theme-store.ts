import {
  type Appearance,
  appearanceOptions,
  appearanceStorageKey,
  defaultAppearance,
  normalizeAppearance,
  presets,
} from "./appearance";

type AppearanceStorage = Pick<Storage, "getItem" | "setItem">;
type ColorScheme = Pick<MediaQueryList, "matches" | "addEventListener" | "removeEventListener">;
type AppearanceSnapshot = Appearance & {
  resolvedMode: "light" | "dark";
  storageAvailable: boolean;
};
type AppearanceConfiguration = {
  defaults: Appearance;
  options: typeof appearanceOptions;
  presets: typeof presets;
};
const serverSnapshot: AppearanceSnapshot = {
  ...defaultAppearance,
  resolvedMode: "light",
  storageAvailable: true,
};

export function createAppearanceStore(
  storage: () => AppearanceStorage,
  events: () => EventTarget,
  colorScheme: () => ColorScheme,
  configuration: AppearanceConfiguration = {
    defaults: defaultAppearance,
    options: appearanceOptions,
    presets,
  },
) {
  let preferences = { ...configuration.defaults };
  let snapshot = serverSnapshot;
  let initialized = false;
  let storageAvailable = true;
  const listeners = new Set<() => void>();
  let cleanup: (() => void) | undefined;

  function refreshSnapshot() {
    const resolvedMode =
      preferences.mode === "system" ? (colorScheme().matches ? "dark" : "light") : preferences.mode;
    const next = { ...preferences, resolvedMode, storageAvailable } as AppearanceSnapshot;
    if (JSON.stringify(next) !== JSON.stringify(snapshot)) {
      snapshot = next;
    }
  }

  function persist() {
    try {
      storage().setItem(appearanceStorageKey, JSON.stringify(preferences));
    } catch {
      storageAvailable = false;
    }
  }

  function read() {
    if (!storageAvailable) {
      return;
    }
    try {
      const raw = storage().getItem(appearanceStorageKey);
      if (raw !== null) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = null;
        }
        preferences = normalizeAppearance(parsed, configuration.defaults, configuration.options);
      } else {
        const legacy = storage().getItem("theme");
        preferences = { ...configuration.defaults };
        if (legacy === "dark" || legacy === "light") {
          preferences.mode = legacy;
          persist();
        }
      }
    } catch {
      storageAvailable = false;
    }
  }

  function getSnapshot() {
    if (!initialized) {
      read();
      initialized = true;
      refreshSnapshot();
    }
    return snapshot;
  }

  function notify() {
    refreshSnapshot();
    listeners.forEach((listener) => listener());
  }

  function update(patch: Partial<Omit<Appearance, "version">>) {
    getSnapshot();
    preferences = normalizeAppearance(
      { ...preferences, ...patch },
      configuration.defaults,
      configuration.options,
    );
    persist();
    notify();
  }

  return {
    getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe(callback: () => void) {
      getSnapshot();
      listeners.add(callback);
      if (!cleanup) {
        const target = events();
        const media = colorScheme();
        const onStorage = (event: Event) => {
          const key = (event as StorageEvent).key;
          if (
            key !== null &&
            key !== undefined &&
            key !== appearanceStorageKey &&
            key !== "theme"
          ) {
            return;
          }
          read();
          notify();
        };
        const onScheme = () => notify();
        target.addEventListener("storage", onStorage);
        media.addEventListener("change", onScheme);
        cleanup = () => {
          target.removeEventListener("storage", onStorage);
          media.removeEventListener("change", onScheme);
        };
        notify();
      }
      return () => {
        listeners.delete(callback);
        if (!listeners.size) {
          cleanup?.();
          cleanup = undefined;
        }
      };
    },
    update,
    selectPreset(id: Appearance["preset"]) {
      if (id === "cyberpunk" && !getSnapshot().cyberpunkUnlocked) {
        return;
      }
      const preset = configuration.presets.find((item) => item.id === id)!;
      update({
        preset: preset.id,
        accent: preset.accent,
        font: preset.font,
        ...(id === "cyberpunk" ? { mode: "dark" as const } : {}),
      });
    },
    unlockCyberpunk() {
      const current = getSnapshot();
      if (
        current.cyberpunkUnlocked &&
        current.preset === "cyberpunk" &&
        current.accent === "neon" &&
        current.font === "mono" &&
        current.mode === "dark"
      ) {
        return;
      }
      update({
        cyberpunkUnlocked: true,
        preset: "cyberpunk",
        accent: "neon",
        font: "mono",
        mode: "dark",
      });
    },
    toggle() {
      update({ mode: getSnapshot().resolvedMode === "dark" ? "light" : "dark" });
    },
    reset() {
      update({ ...configuration.defaults, cyberpunkUnlocked: getSnapshot().cyberpunkUnlocked });
    },
  };
}

const browserStoreKey = Symbol.for("portfolio.appearance-store");
type AppearanceBrowser = EventTarget & {
  readonly localStorage: AppearanceStorage;
  matchMedia(query: string): ColorScheme;
  [browserStoreKey]?: {
    store: ReturnType<typeof createAppearanceStore>;
    configuration: AppearanceConfiguration;
  };
};

export function getBrowserAppearanceStore(browser: AppearanceBrowser) {
  const configuration = { defaults: defaultAppearance, options: appearanceOptions, presets };
  const existing = browser[browserStoreKey];
  if (existing) {
    Object.assign(existing.configuration, configuration);
    return existing.store;
  }
  const store = createAppearanceStore(
    () => browser.localStorage,
    () => browser,
    () => browser.matchMedia("(prefers-color-scheme: dark)"),
    configuration,
  );
  browser[browserStoreKey] = { store, configuration };
  return store;
}

export const appearanceStore =
  typeof window === "undefined"
    ? createAppearanceStore(
        () => window.localStorage,
        () => window,
        () => window.matchMedia("(prefers-color-scheme: dark)"),
      )
    : getBrowserAppearanceStore(window);
