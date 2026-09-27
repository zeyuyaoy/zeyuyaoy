import {appearanceOptions, presets} from "./appearance";
import {commandGuide, consoleContent as content} from "./console-content";
import {type ConsoleOutput, createConsoleRenderer} from "./console-renderer";
import type {ProjectData} from "./github";
import type {appearanceStore} from "./theme-store";

export interface PeterConsole {
  help(command?: string): string;

  about(): string;

  projects(name?: string): string;

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

export type ConsoleDependencies = {
  output: ConsoleOutput;
  appearance: Pick<typeof appearanceStore, "getSnapshot" | "selectPreset" | "update" | "reset">;
  data: ProjectData;
  origin: string;
};

type Discovery = "conan" | "astra";

export function createPeterConsole(
  {output, appearance, data, origin}: ConsoleDependencies,
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
          view.text('Unknown command. Use peter.help() or peter.help("projects").');
          return "Help is a good place to start.";
        }
        const [, example, description] = commandGuide[command as keyof typeof commandGuide];
        view.heading(example);
        view.text(description);
        return next("Command explained.", "peter.help()");
      }
      view.heading("Peter's personal terminal · command guide");
      view.text("Type a command with parentheses. Your console provides history and autocomplete.");
      for (const group of ["Explore", "Make yourself at home", "Discover"]) {
        view.heading(group);
        view.table(
          Object.values(commandGuide)
            .filter(([category]) => category === group)
            .map(([, example, description]) => ({Command: example, Description: description})),
        );
      }
      return next("Make yourself at home.", "peter.about()");
    },
    about() {
      view.heading("Zeyu / Peter · 姚则禹");
      content.about.forEach(view.text);
      return next("Nice to meet you.", "peter.research()");
    },
    projects(name: unknown = undefined) {
      if (name !== undefined && (typeof name !== "string" || !name.trim())) {
        view.text('Use peter.projects() or peter.projects("name") with a project name.');
        return "Project names must be non-empty strings.";
      }
      view.heading("Things I've been building");
      if (data.status === "unavailable") {
        view.text("Projects are unavailable right now.");
        links([["Browse on GitHub", content.github]]);
        return next("The rest of the terminal is ready to explore.", "peter.research()");
      }
      if (!data.projects.length) {
        view.text("No public projects at the moment.");
        return next("Check back later.", "peter.research()");
      }
      if (typeof name === "string") {
        const query = name.trim().toLowerCase();
        const project = data.projects.find((item) => item.name.toLowerCase() === query);
        if (!project) {
          const matches = data.projects.filter((item) => item.name.toLowerCase().includes(query));
          const suggestions = (matches.length ? matches : data.projects).slice(0, 5);
          view.text(`No project named ${JSON.stringify(name)}. Try one of these:`);
          suggestions.forEach((item) => view.text(`peter.projects(${JSON.stringify(item.name)})`));
          return "Use an exact project name; capitalization doesn't matter.";
        }
        view.heading(project.name);
        view.text(project.description || "No description provided yet.");
        view.text(`${project.stars} stars`);
        links([["GitHub", project.url]]);
        return next("Project explored.", "peter.projects()");
      }
      const projects = data.projects.slice(0, 8);
      view.table(
        projects.map((project) => ({
          Project: project.name,
          Description: project.description || "No description provided yet.",
          Stars: project.stars,
        })),
      );
      view.details("Project links", () =>
        links(projects.map((project) => [project.name, project.url])),
      );
      view.text(
        `Showing ${projects.length} of ${data.projects.length} projects. Look up any by its exact name.`,
      );
      return next("Projects listed.", `peter.projects(${JSON.stringify(projects[0].name)})`);
    },
    research() {
      view.heading("Computing × biology");
      view.text(
        "Understanding complex biological systems: how they change, adapt, and sometimes break down.",
      );
      view.text(content.researchTopics.join(" · "));
      links(content.research);
      return next("Research links ready.", "peter.projects()");
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
        `Current preset: ${current.preset} · mode: ${current.mode} (${current.resolvedMode})`,
      );
      view.text(`Accent: ${current.accent} · font: ${current.font}`);
      view.table(
        availablePresets().map((preset) => ({
          Preset: preset.name,
          Selected: preset.id === current.preset ? "✓" : "",
          Command: `peter.theme("${preset.id}")`,
        })),
      );
      view.text('Modes: peter.mode("light"), peter.mode("dark"), peter.mode("system").');
      return next(
        "Appearance changes affect the page and are saved when storage is available.",
        'peter.help("resetAppearance")',
      );
    },
    theme(id: unknown) {
      const preset = availablePresets().find((item) => item.id === id);
      if (!preset) {
        view.text('Choose an available preset, for example peter.theme("editorial").');
        view.text(
          `Available: ${availablePresets()
            .map((item) => item.id)
            .join(", ")}.`,
        );
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
      appearance.update({mode});
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
      return next("Case closed; onwards to the stars.", "peter.projects()");
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
    return () => {
    };
  }

  const session = previousSession ?? {bannerShown: false, discoveries: new Set<Discovery>()};
  if (!previousSession) {
    Object.defineProperty(host, sessionKey, {value: session});
  }

  const api = createPeterConsole(dependencies, session.discoveries);
  Object.defineProperty(host, "peter", {value: api, configurable: true});
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
