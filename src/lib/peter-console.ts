import { appearanceOptions, presets } from "./appearance";
import { commandGuide, consoleContent as content } from "./console-content";
import { type ConsoleOutput, createConsoleRenderer } from "./console-renderer";
import type { appearanceStore } from "./theme-store";

interface PeterConsole {
  help(command?: string): string;

  about(): string;

  research(): string;

  interests(): string;

  photos(): string;

  contact(): string;

  themes(): string;

  theme(preset: string): string;

  mode(mode: string): string;

  resetAppearance(): string;

  hint(): string;

  banner(): string;

  conan(): string;

  astra(): string;
}

declare global {
  interface Window {
    peter?: PeterConsole;
  }
}

type ConsoleDependencies = {
  output: ConsoleOutput;
  appearance: Pick<typeof appearanceStore, "getSnapshot" | "selectPreset" | "update" | "reset">;
  origin: string;
};

type Discovery = "conan" | "astra";

export function createPeterConsole(
  { output, appearance, origin }: ConsoleDependencies,
  discoveries = new Set<Discovery>(),
): Readonly<PeterConsole> {
  const view = createConsoleRenderer(output);
  const next = (status: string, command: string) => {
    view.text(`Next stop: ${command}`);
    return status;
  };

  const links = (items: readonly (readonly [string, string])[]) => {
    items.forEach(([label, url]) => view.text(`${label}: ${url}`));
  };

  const availablePresets = () =>
    presets.filter(
      (preset) => preset.id !== "cyberpunk" || appearance.getSnapshot().cyberpunkUnlocked,
    );

  const presetCommand = (preset: (typeof presets)[number]) =>
    preset.name.toLowerCase().replace("&", "");

  const saved = (message: string) => {
    view.heading(message);
    view.text(
      appearance.getSnapshot().storageAvailable
        ? "Saved in this browser."
        : "For this visit only — browser storage is unavailable.",
    );
    return next(message, "peter.themes()");
  };

  const api: PeterConsole = {
    banner() {
      view.heading(content.banner);
      view.text(content.welcome);
      view.text("Start exploring: peter.help()");
      return "Welcome to Peter's personal terminal.";
    },
    help(command: unknown = undefined) {
      if (command !== undefined) {
        if (typeof command !== "string" || !Object.hasOwn(commandGuide, command)) {
          view.text('Unknown command. Use peter.help() or peter.help("research").');
          return "Help is a good place to start.";
        }
        const [, example, description] = commandGuide[command as keyof typeof commandGuide];
        view.heading(example);
        view.text(description);
        return next("Command explained.", "peter.help()");
      }
      view.heading("Peter's personal terminal · command guide");
      for (const group of ["Explore", "Make yourself at home", "Discover"]) {
        view.heading(group);
        view.table(
          Object.values(commandGuide)
            .filter(([category]) => category === group)
            .map(([, example, description]) => ({ Command: example, Description: description })),
        );
      }
      return next("Make yourself at home.", "peter.about()");
    },
    about() {
      view.heading("Zeyu (Peter) Yao · 姚则禹");
      content.about.forEach(view.text);
      return next("Nice to meet you.", "peter.research()");
    },
    research() {
      view.heading("Computing × biology");
      view.text(
        "Understanding complex biological systems: how they change, adapt, and sometimes break down.",
      );
      view.text(content.researchTopics.join(" · "));
      links(content.research);
      return next("Research links ready.", "peter.interests()");
    },
    interests() {
      view.heading("Off the clock");
      content.interests.forEach((interest) => view.text(`• ${interest}`));
      return next("A few things beyond the code.", "peter.photos()");
    },
    photos() {
      view.heading("Through my lens");
      links(content.photos.map(([label, path]) => [label, new URL(path, origin).href]));
      return next("Three little windows into the photo strips.", "peter.hint()");
    },
    contact() {
      view.heading("Say hello");
      links(content.contact);
      return next("See you around.", "peter.interests()");
    },
    themes() {
      const current = appearance.getSnapshot();
      view.heading("Make yourself at home");
      view.text(
        `Current preset: ${presets.find((preset) => preset.id === current.preset)!.name} · mode: ${current.mode} (${current.resolvedMode})`,
      );
      view.text(`Accent: ${current.accent} · font: ${current.font}`);
      view.table(
        availablePresets().map((preset) => ({
          Preset: preset.name,
          Selected: preset.id === current.preset ? "✓" : "",
          Command: `peter.theme("${presetCommand(preset)}")`,
        })),
      );
      view.text('Modes: peter.mode("light"), peter.mode("dark"), peter.mode("system").');
      return next(
        "Appearance changes affect the page and are saved when storage is available.",
        'peter.help("resetAppearance")',
      );
    },
    theme(id: unknown) {
      const preset = availablePresets().find(
        (item) => item.id === id || presetCommand(item) === id,
      );
      if (!preset) {
        view.text('Choose an available preset, for example peter.theme("bootstrap").');
        view.text(`Available: ${availablePresets().map(presetCommand).join(", ")}.`);
        return "Appearance unchanged. Locked presets stay locked.";
      }
      appearance.selectPreset(preset.id);
      return saved(`${preset.name} applied.`);
    },
    mode(value: unknown) {
      const mode = appearanceOptions.mode.find((item) => item === value);
      if (!mode) {
        view.text('Use peter.mode("light"), peter.mode("dark"), or peter.mode("system").');
        return "Appearance unchanged.";
      }
      appearance.update({ mode });
      return saved(`Mode set to ${mode}.`);
    },
    resetAppearance() {
      appearance.reset();
      return saved("Appearance reset, including photo speed. Existing theme unlocks kept.");
    },
    hint() {
      view.heading("A little curiosity goes a long way");
      if (!discoveries.has("conan")) {
        view.text(
          "The detective hiding in my profile photo has a command, too. Try peter.conan().",
        );
        return "A case worth investigating.";
      }
      if (!discoveries.has("astra")) {
        view.text(
          "Through hardships, to the stars. The last word of my Latin motto is another command: peter.astra().",
        );
        return "Look toward the stars.";
      }
      view.text("Both discoveries found. Thanks for looking a little closer.");
      return next("Case closed; onwards to the stars.", "peter.research()");
    },
    conan() {
      discoveries.add("conan");
      view.text(content.conan);
      view.heading(content.conanMessage);
      links([["Conan", new URL("/conan.jpg", origin).href]]);
      return next("Detective discovered.", "peter.hint()");
    },
    astra() {
      discoveries.add("astra");
      view.heading(`✦  ${content.motto}  ✦`);
      view.text(
        "Through hardships, to the stars. Thanks for exploring this little corner of my world.",
      );
      return next("Onwards, with curiosity.", "peter.hint()");
    },
  };
  return Object.freeze(api);
}

const sessionKey = Symbol.for("zeyuyaoy.peter-console.session");
type ConsoleSession = {
  bannerShown: boolean;
  discoveries: Set<Discovery>;
  api?: Readonly<PeterConsole>;
};
type ConsoleHost = { peter?: PeterConsole; [sessionKey]?: ConsoleSession };

export function installPeterConsole(
  host: ConsoleHost,
  dependencies: ConsoleDependencies,
): () => void {
  const existing = Object.getOwnPropertyDescriptor(host, "peter");
  const previousSession = host[sessionKey];
  if (
    "peter" in host &&
    (!existing ||
      !existing.configurable ||
      !previousSession?.api ||
      existing.value !== previousSession.api)
  ) {
    return () => {};
  }

  const session = previousSession ?? { bannerShown: false, discoveries: new Set<Discovery>() };
  if (!previousSession) {
    Object.defineProperty(host, sessionKey, { value: session });
  }

  const api = createPeterConsole(dependencies, session.discoveries);
  Object.defineProperty(host, "peter", { value: api, configurable: true });
  session.api = api;
  if (!session.bannerShown) {
    session.bannerShown = true;
    api.banner();
  }

  return () => {
    if (Object.getOwnPropertyDescriptor(host, "peter")?.value === api) {
      delete host.peter;
    }
    if (session.api === api) {
      session.api = undefined;
    }
  };
}
