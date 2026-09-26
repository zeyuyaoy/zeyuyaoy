export const appearanceOptions = {
    preset: ["sundaze", "everyday", "editorial", "goofball"],
    mode: ["system", "light", "dark"],
    accent: ["sage", "ocean", "terracotta", "lavender"],
    font: ["rounded", "sans", "serif", "mono", "comic"],
    size: ["standard", "larger"],
    motion: ["system", "reduce"],
} as const;

export type Appearance = { version: 1 } & {
    [K in keyof typeof appearanceOptions]: (typeof appearanceOptions)[K][number];
};

export const presets = [
    {id: "sundaze", name: "Sundaze", accent: "sage", font: "rounded"},
    {id: "everyday", name: "Everyday", accent: "ocean", font: "sans"},
    {id: "editorial", name: "Editorial", accent: "terracotta", font: "serif"},
    {id: "goofball", name: "Goofball", accent: "lavender", font: "comic"},
] as const;

export const defaultAppearance: Appearance = {
    version: 1, preset: "sundaze", mode: "system", accent: "sage", font: "rounded",
    size: "standard", motion: "system",
};

export const appearanceStorageKey = "portfolio-appearance";

export function normalizeAppearance(
    value: unknown,
    defaults: Appearance,
    options: typeof appearanceOptions,
): Appearance {
    if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1) {
        return {...defaults};
    }
    const result = {...defaults};
    for (const key of Object.keys(options) as (keyof typeof options)[]) {
        const candidate = (value as Record<string, unknown>)[key];
        if (typeof candidate === "string" && (options[key] as readonly string[]).includes(candidate)) {
            Object.assign(result, {[key]: candidate});
        }
    }
    return result;
}

export function applyAppearance(root: HTMLElement, value: Appearance, systemDark: boolean) {
    root.dataset.theme = value.mode === "system" ? (systemDark ? "dark" : "light") : value.mode;
    root.dataset.palette = value.preset;
    root.dataset.accent = value.accent;
    root.dataset.font = value.font;
    root.dataset.size = value.size;
    root.dataset.motion = value.motion;
}

export function appearanceBootstrapScript() {
    return `(()=>{const defaults=${JSON.stringify(defaultAppearance)};const options=${JSON.stringify(appearanceOptions)};
const normalize=${normalizeAppearance.toString()};const apply=${applyAppearance.toString()};let value=defaults;
try{const raw=localStorage.getItem(${JSON.stringify(appearanceStorageKey)});if(raw!==null){value=normalize(JSON.parse(raw),defaults,options);}else{const legacy=localStorage.getItem('theme');if(legacy==='light'||legacy==='dark')value={...defaults,mode:legacy};}}catch{}
apply(document.documentElement,value,window.matchMedia('(prefers-color-scheme: dark)').matches);})();`;
}
