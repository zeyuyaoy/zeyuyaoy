import {describe, expect, test} from "bun:test";
import {createPeterConsole, installPeterConsole} from "../src/lib/peter-console";
import {createAppearanceStore} from "../src/lib/theme-store";
import {appearanceStorageKey, defaultAppearance} from "../src/lib/appearance";
import {commandGuide, consoleContent} from "../src/lib/console-content";

function fixture({data, storageFails = false, saved} = {}) {
  const calls = [];
  const output = Object.fromEntries(
    ["log", "table", "groupCollapsed", "groupEnd"].map((method) => [
      method,
      (...args) => calls.push({method, args}),
    ]),
  );

  const storage = new Map(saved ? [[appearanceStorageKey, JSON.stringify(saved)]] : []);
  const events = new EventTarget();
  const media = Object.assign(new EventTarget(), {matches: false});

  const appearance = createAppearanceStore(
    () => ({
      getItem(key) {
        if (storageFails) {
          throw new Error("Storage unavailable");
        }
        return storage.get(key) ?? null;
      },
      setItem(key, value) {
        if (storageFails) {
          throw new Error("Storage unavailable");
        }
        storage.set(key, value);
      },
    }),
    () => events,
    () => media,
  );

  const projects = Array.from({length: 10}, (_, index) => ({
    name: `project-${index}`,
    description: index === 1 ? null : `Project ${index}`,
    stars: index,
    url: `https://github.com/zeyuyaoy/project-${index}`,
  }));

  const dependencies = {
    output,
    appearance,
    origin: "http://localhost:3456",
    data: data ?? {status: "ready", projects},
  };

  const api = createPeterConsole(dependencies);
  const text = () =>
    calls
      .filter((call) => call.method !== "table")
      .flatMap((call) => call.args.slice(call.method === "groupEnd" ? 0 : 1))
      .join("\n");

  const tables = () => calls.filter((call) => call.method === "table").map((call) => call.args[0]);

  return {calls, appearance, storage, dependencies, api, text, tables};
}

describe("personal console content", () => {
  test("has a small welcome card and a frozen, getter-free command surface", () => {
    const {api, text} = fixture();
    expect(Object.isFrozen(api)).toBe(true);
    expect(Object.values(Object.getOwnPropertyDescriptors(api)).every((value) => !value.get)).toBe(
      true,
    );
    expect(api.banner()).toBeTypeOf("string");
    expect(text()).toContain("Start exploring: peter.help()");
    expect(consoleContent.banner.split("\n").every((line) => line.length < 40)).toBe(true);
  });

  test("help documents every public command and keeps discoveries out of its table", () => {
    const {api, tables, text, calls} = fixture();
    api.help();
    expect(tables()).toHaveLength(3);
    const helpRows = tables().flat();
    expect(helpRows).toHaveLength(Object.keys(commandGuide).length);
    expect(JSON.stringify(helpRows)).not.toMatch(/peter\.(conan|astra)/);

    for (const command of Object.keys(commandGuide)) {
      calls.length = 0;
      expect(api.help(command)).toBeTypeOf("string");
      expect(text()).toContain(commandGuide[command][1]);
    }

    for (const command of ["missing", "__proto__", "toString", null, 1, {}]) {
      calls.length = 0;
      api.help(command);
      expect(text()).toContain("Unknown command");
    }
  });

  test("content commands print public content, absolute local photo links, and a next step", () => {
    const {api, text, calls} = fixture();
    for (const command of [
      "about",
      "research",
      "interests",
      "photos",
      "contact",
      "conan",
      "astra",
    ]) {
      calls.length = 0;
      expect(api[command]()).toBeTypeOf("string");
      expect(text()).toContain("Next stop: peter.");
    }

    calls.length = 0;
    api.photos();
    expect(text()).toContain("http://localhost:3456/marquee/top-001.webp");
    expect(text()).toContain("http://localhost:3456/marquee/middle-001.webp");
    expect(text()).toContain("http://localhost:3456/marquee/bottom-001.webp");

    api.conan();
    expect(text()).toContain("http://localhost:3456/conan.jpg");
  });

  test("lists eight projects in server order but can look up the complete list", () => {
    const {api, text, tables, calls} = fixture();
    api.projects();

    expect(tables()[0].map((row) => row.Project)).toEqual(
      Array.from({length: 8}, (_, i) => `project-${i}`),
    );
    expect(tables()[0][1].Description).toBe("No description provided yet.");
    expect(text()).toContain("Showing 8 of 10");
    expect(calls.filter((call) => call.method === "groupCollapsed")).toHaveLength(1);
    expect(calls.filter((call) => call.method === "groupEnd")).toHaveLength(1);

    calls.length = 0;
    api.projects(" PROJECT-9 ");
    expect(text()).toContain("Project 9");
    expect(text()).toContain("https://github.com/zeyuyaoy/project-9");
  });

  test("project lookup suggests available names and validates arguments", () => {
    const {api, text, calls} = fixture();
    api.projects("9");
    expect(text()).toContain('peter.projects("project-9")');
    calls.length = 0;
    api.projects("unknown");
    expect(text()).toContain('peter.projects("project-0")');

    for (const value of [null, 1, {}, [], "", "   "]) {
      calls.length = 0;
      expect(api.projects(value)).toContain("non-empty strings");
      expect(text()).toContain("Use peter.projects()");
    }
  });

  test.each(["ready", "unavailable"])(
    "handles %s projects without disabling other commands",
    (status) => {
      const {api, text} = fixture({data: {status, projects: []}});
      api.projects();
      expect(text()).toContain(
        status === "ready" ? "No public projects" : "Projects are unavailable",
      );

      if (status === "unavailable") {
        expect(text()).toContain("https://github.com/zeyuyaoy");
      }

      api.about();
      expect(text()).toContain("Zeyu (Peter) Yao");
    },
  );

  test("external strings stay data rather than becoming formatting instructions", () => {
    const name = '%c<script>alert("hi")</script>姚';
    const description = "%s %c <img src=x onerror=alert(1)>";
    const {api, calls, tables} = fixture({
      data: {
        status: "ready",
        projects: [
          {
            name,
            description,
            stars: 0,
            url: "https://github.com/zeyuyaoy/example",
          },
        ],
      },
    });

    api.projects();
    expect(tables()[0][0]).toMatchObject({Project: name, Description: description});
    api.projects(name);
    api.projects('%c"missing');

    for (const {method, args} of calls) {
      if (method === "log") {
        expect(["%s", "%c%s"]).toContain(args[0]);
      }

      if (method === "groupCollapsed") {
        expect(args[0]).toBe("%s");
      }
    }
    expect(calls.some((call) => call.args[0] === "%s" && call.args[1] === description)).toBe(true);
    expect(calls.some((call) => call.args[0] === "%c%s" && call.args[2] === name)).toBe(true);
  });
});

describe("console appearance commands", () => {
  test("Cyberpunk selects dark mode while manual mode choices remain available", () => {
    const {api, appearance, text} = fixture();
    appearance.unlockCyberpunk();
    api.mode("light");
    api.theme("cyberpunk");
    expect(appearance.getSnapshot()).toMatchObject({mode: "dark", accent: "neon", font: "mono"});
    api.mode("system");
    expect(appearance.getSnapshot().mode).toBe("system");
    api.help("theme");
    expect(text()).toContain("Cyberpunk selects dark mode");
  });

  test("applies presets and modes through the store, preserving independent preferences", () => {
    const {api, appearance, storage, text} = fixture();
    appearance.update({motion: "reduce", size: "larger", marqueeSpeed: 1});
    api.theme("editorial");
    api.mode("dark");
    expect(appearance.getSnapshot()).toMatchObject({
      preset: "editorial",
      accent: "terracotta",
      font: "serif",
      mode: "dark",
      motion: "reduce",
      size: "larger",
      marqueeSpeed: 1,
    });
    expect(JSON.parse(storage.get(appearanceStorageKey)).preset).toBe("editorial");
    expect(text()).toContain("Saved in this browser");
    api.mode("system");
    expect(appearance.getSnapshot().mode).toBe("system");
  });

  test("invalid and locked selections do not mutate preferences", () => {
    const {api, appearance, storage, calls, tables} = fixture();
    const before = appearance.getSnapshot();
    for (const value of [undefined, null, {}, 1, "", "unknown", "cyberpunk"]) {
      api.theme(value);
      api.mode(value);
    }
    expect(appearance.getSnapshot()).toBe(before);
    expect(storage.size).toBe(0);
    calls.length = 0;
    api.themes();
    expect(tables()[0].map((row) => row.Preset)).toEqual([
      "Sundaze",
      "Everyday",
      "Editorial",
      "Goofball",
    ]);
  });

  test("reflects existing unlocks and preserves them through reset", () => {
    const {api, appearance, tables} = fixture();
    appearance.unlockCyberpunk();
    api.themes();
    expect(tables()[0].at(-1).Preset).toBe("Cyberpunk");
    api.theme("editorial");
    api.theme("cyberpunk");
    expect(appearance.getSnapshot().preset).toBe("cyberpunk");
    api.resetAppearance();
    expect(appearance.getSnapshot()).toMatchObject({
      ...defaultAppearance,
      cyberpunkUnlocked: true,
    });
  });

  test("works without storage and explains that changes last only for this visit", () => {
    const {api, appearance, text} = fixture({storageFails: true});
    api.theme("goofball");
    api.mode("light");
    expect(appearance.getSnapshot()).toMatchObject({
      preset: "goofball",
      mode: "light",
      storageAvailable: false,
    });
    expect(text()).toContain("For this visit only");
    api.resetAppearance();
    expect(appearance.getSnapshot().preset).toBe("sundaze");
  });
});

describe("console lifecycle and discoveries", () => {
  test("hints advance only after discoveries, including out-of-order exploration", () => {
    const {api, calls, text} = fixture();
    api.hint();
    api.hint();
    expect(text()).not.toContain("peter.astra()");
    api.astra();
    calls.length = 0;
    api.hint();
    expect(text()).toContain("peter.conan()");
    api.conan();
    calls.length = 0;
    api.hint();
    expect(text()).toContain("Both discoveries found");
    const other = fixture();
    other.api.conan();
    other.api.hint();
    expect(other.text()).toContain("peter.astra()");
  });

  test("Strict Mode remounts register once, preserve discoveries, and allow explicit banners", () => {
    const host = {};
    const {dependencies, calls, text} = fixture();
    const cleanup = installPeterConsole(host, dependencies);
    const welcomeCount = () =>
      calls.filter((call) => call.args.includes(consoleContent.banner)).length;
    expect(welcomeCount()).toBe(1);
    host.peter.conan();
    cleanup();
    expect(host.peter).toBeUndefined();
    const cleanupAgain = installPeterConsole(host, dependencies);
    expect(welcomeCount()).toBe(1);
    host.peter.hint();
    expect(text()).toContain("peter.astra()");
    host.peter.banner();
    expect(welcomeCount()).toBe(2);
    cleanupAgain();
    const freshDocument = {};
    installPeterConsole(freshDocument, dependencies);
    expect(welcomeCount()).toBe(3);
    calls.length = 0;
    freshDocument.peter.hint();
    expect(text()).toContain("peter.conan()");
  });

  test("stale cleanup never removes a replacement registration or a visitor's global", () => {
    const host = {};
    const {dependencies} = fixture();
    const oldCleanup = installPeterConsole(host, dependencies);
    const oldApi = host.peter;
    const newCleanup = installPeterConsole(host, dependencies);
    expect(host.peter).not.toBe(oldApi);
    const newApi = host.peter;
    oldCleanup();
    expect(host.peter).toBe(newApi);
    const visitorValue = {hello: "visitor"};
    Object.defineProperty(host, "peter", {value: visitorValue, configurable: true});
    newCleanup();
    expect(host.peter).toBe(visitorValue);
    installPeterConsole(host, dependencies)();
    expect(host.peter).toBe(visitorValue);
  });

  test("does not evaluate getters or overwrite inherited globals", () => {
    const {dependencies, calls} = fixture();
    let reads = 0;
    const host = {};
    Object.defineProperty(host, "peter", {
      configurable: true,
      get() {
        reads++;
        return {};
      },
    });
    installPeterConsole(host, dependencies)();
    expect(reads).toBe(0);
    const inherited = Object.create({peter: "someone else"});
    installPeterConsole(inherited, dependencies)();
    expect(Object.hasOwn(inherited, "peter")).toBe(false);
    expect(calls).toHaveLength(0);
  });
});
