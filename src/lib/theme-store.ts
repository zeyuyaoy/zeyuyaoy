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
type AppearanceSnapshot = Appearance & { resolvedMode: "light" | "dark"; storageAvailable: boolean };
const serverSnapshot: AppearanceSnapshot = {...defaultAppearance, resolvedMode: "light", storageAvailable: true};

export function createAppearanceStore(
    storage: () => AppearanceStorage,
    events: () => EventTarget,
    colorScheme: () => ColorScheme,
) {
    let preferences = {...defaultAppearance};
    let snapshot = serverSnapshot;
    let initialized = false;
    let storageAvailable = true;
    const listeners = new Set<() => void>();
    let cleanup: (() => void) | undefined;

    function refreshSnapshot() {
        const resolvedMode = preferences.mode === "system"
            ? (colorScheme().matches ? "dark" : "light") : preferences.mode;
        const next = {...preferences, resolvedMode, storageAvailable} as AppearanceSnapshot;
        if (JSON.stringify(next) !== JSON.stringify(snapshot)) snapshot = next;
    }

    function persist() {
        try {
            storage().setItem(appearanceStorageKey, JSON.stringify(preferences));
        } catch {
            storageAvailable = false;
        }
    }

    function read() {
        if (!storageAvailable) return;
        try {
            const raw = storage().getItem(appearanceStorageKey);
            if (raw !== null) {
                let parsed: unknown;
                try {
                    parsed = JSON.parse(raw);
                } catch {
                    parsed = null;
                }
                preferences = normalizeAppearance(parsed, defaultAppearance, appearanceOptions);
            } else {
                const legacy = storage().getItem("theme");
                preferences = {...defaultAppearance};
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
        listeners.forEach(listener => listener());
    }

    function update(patch: Partial<Omit<Appearance, "version">>) {
        getSnapshot();
        preferences = normalizeAppearance({...preferences, ...patch}, defaultAppearance, appearanceOptions);
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
                    if (key !== null && key !== undefined && key !== appearanceStorageKey && key !== "theme") return;
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
            const preset = presets.find(item => item.id === id)!;
            update({preset: preset.id, accent: preset.accent, font: preset.font});
        },
        toggle() {
            update({mode: getSnapshot().resolvedMode === "dark" ? "light" : "dark"});
        },
        reset() {
            update(defaultAppearance);
        },
    };
}

export const appearanceStore = createAppearanceStore(
    () => window.localStorage,
    () => window,
    () => window.matchMedia("(prefers-color-scheme: dark)"),
);
