import {describe, expect, test} from "bun:test";
import {runInNewContext} from "node:vm";
import {createAppearanceStore} from "../src/lib/theme-store";
import {
    appearanceBootstrapScript,
    appearanceOptions,
    appearanceStorageKey,
    applyAppearance,
    defaultAppearance,
    normalizeAppearance,
    presets,
} from "../src/lib/appearance";

function fixture({saved = null, legacy = null, dark = false, readFails = false, writeFails = false} = {}) {
    const data = new Map();
    if (saved !== null) {
        data.set(appearanceStorageKey, saved);
    }

    if (legacy !== null) {
        data.set("theme", legacy);
    }

    const events = new EventTarget();
    const media = Object.assign(new EventTarget(), {matches: dark});
    const storage = {
        getItem(key) {
            if (readFails) throw new Error("Denied");
            return data.get(key) ?? null;
        },
        setItem(key, value) {
            if (writeFails) throw new Error("Quota exceeded");
            data.set(key, value);
        },
    };

    const store = createAppearanceStore(() => storage, () => events, () => media);
    return {store, data, events, media, storage};
}

describe("visitor appearance", () => {
    test("uses stable server and client snapshots, resolving system mode on the client", () => {
        const {store} = fixture({dark: true});
        expect(store.getServerSnapshot().resolvedMode).toBe("light");
        expect(store.getSnapshot().resolvedMode).toBe("dark");
        expect(store.getSnapshot()).toBe(store.getSnapshot());
        store.update({font: "serif"});
        expect(store.getServerSnapshot().font).toBe("rounded");
    });

    test("migrates the old preference once and gives new preferences precedence", () => {
        const {store, data} = fixture({legacy: "dark"});
        expect(store.getSnapshot().mode).toBe("dark");
        expect(JSON.parse(data.get(appearanceStorageKey)).mode).toBe("dark");

        const other = fixture({legacy: "dark", saved: JSON.stringify({...defaultAppearance, mode: "light"})});
        expect(other.store.getSnapshot().resolvedMode).toBe("light");
    });

    test("presets reset only palette, accent and font; independent changes persist", () => {
        const {store, data} = fixture();
        store.update({mode: "dark", size: "larger", motion: "reduce"});
        store.selectPreset("goofball");
        expect(store.getSnapshot()).toMatchObject({
            preset: "goofball",
            font: "comic",
            accent: "lavender",
            mode: "dark",
            size: "larger",
            motion: "reduce"
        });

        store.update({font: "mono", accent: "ocean"});

        const reloaded = fixture({saved: data.get(appearanceStorageKey)}).store;
        expect(reloaded.getSnapshot()).toMatchObject({preset: "goofball", font: "mono", accent: "ocean"});
        store.selectPreset("editorial");
        expect(store.getSnapshot()).toMatchObject({font: "serif", accent: "terracotta", size: "larger"});
        store.reset();
        expect(JSON.parse(data.get(appearanceStorageKey))).toEqual(defaultAppearance);
    });

    test("normalizes malformed, future-version and unrecognized values", () => {
        for (const saved of ["{broken", "null", "[]", '{"version":2,"font":"comic"}']) {
            expect(fixture({saved}).store.getSnapshot()).toMatchObject(defaultAppearance);
        }

        const result = normalizeAppearance({
            version: 1,
            font: "serif",
            accent: "url(evil)",
            size: 200
        }, defaultAppearance, appearanceOptions);

        expect(result).toEqual({...defaultAppearance, font: "serif"});
    });

    test.each([{readFails: true}, {writeFails: true}])("keeps changes in memory when storage fails: %j", options => {
        const {store} = fixture(options);
        store.selectPreset("goofball");
        store.toggle();

        expect(store.getSnapshot()).toMatchObject({font: "comic", resolvedMode: "dark", storageAvailable: false});
        store.toggle();

        expect(store.getSnapshot().resolvedMode).toBe("light");
        store.reset();

        expect(store.getSnapshot()).toMatchObject({...defaultAppearance, storageAvailable: false});
    });

    test("synchronizes tabs and system changes, honors explicit mode, and removes listeners", () => {
        const {store, data, events, media} = fixture();
        let notifications = 0;
        const unsubscribe = store.subscribe(() => notifications++);
        const initial = notifications;

        media.matches = true;
        media.dispatchEvent(new Event("change"));
        expect(store.getSnapshot().resolvedMode).toBe("dark");
        store.toggle();
        expect(store.getSnapshot()).toMatchObject({mode: "light", resolvedMode: "light"});

        media.dispatchEvent(new Event("change"));
        expect(store.getSnapshot().resolvedMode).toBe("light");
        data.set(appearanceStorageKey, JSON.stringify({...defaultAppearance, preset: "editorial", font: "serif"}));
        events.dispatchEvent(Object.assign(new Event("storage"), {key: appearanceStorageKey}));
        expect(store.getSnapshot()).toMatchObject({font: "serif", resolvedMode: "dark"});

        const snapshot = store.getSnapshot();
        events.dispatchEvent(Object.assign(new Event("storage"), {key: "unrelated"}));
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
                    mode
                };
                const f = fixture({saved: JSON.stringify(preferences), dark: true});
                const root = {dataset: {}};
                runInNewContext(appearanceBootstrapScript(), {
                    document: {documentElement: root}, localStorage: f.storage,
                    window: {matchMedia: () => f.media},
                });
                const client = {dataset: {}};
                applyAppearance(client, f.store.getSnapshot(), true);
                expect(root.dataset).toEqual(client.dataset);
            }
        }
    });

    test("pre-paint script recovers from unavailable storage, corruption, and legacy settings", () => {
        for (const options of [{readFails: true}, {saved: "{broken"}, {legacy: "dark"}]) {
            const f = fixture(options);
            const root = {dataset: {}};
            runInNewContext(appearanceBootstrapScript(), {
                document: {documentElement: root}, localStorage: f.storage,
                window: {matchMedia: () => f.media},
            });
            expect(root.dataset.theme).toBe(f.store.getSnapshot().resolvedMode);
            expect(root.dataset.palette).toBe("sundaze");
        }
    });
});
