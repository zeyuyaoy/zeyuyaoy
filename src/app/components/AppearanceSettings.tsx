"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { type Appearance, presets } from "@/lib/appearance";
import { appearanceStore } from "@/lib/theme-store";
import styles from "./AppearanceSettings.module.css";
import SecretController from "./SecretController";

const fonts = [
  ["rounded", "Rounded"],
  ["sans", "Sans-serif"],
  ["serif", "Serif"],
  ["mono", "Monospace"],
  ["comic", "Comic"],
] as const;
const accents = [
  ["sage", "Sage"],
  ["ocean", "Ocean"],
  ["terracotta", "Terracotta"],
  ["lavender", "Lavender"],
  ["neon", "Neon"],
] as const;

export default function AppearanceSettings() {
  const value = useSyncExternalStore(
    appearanceStore.subscribe,
    appearanceStore.getSnapshot,
    appearanceStore.getServerSnapshot,
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const selected = presets.find((preset) => preset.id === value.preset)!;
  const customized = value.accent !== selected.accent || value.font !== selected.font;

  useEffect(() => {
    if (!open) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const position = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect || !dialog.current) {
        return;
      }
      dialog.current.style.setProperty(
        "--panel-right",
        `${Math.max(16, window.innerWidth - rect.right)}px`,
      );
      dialog.current.style.setProperty(
        "--panel-bottom",
        `${Math.min(Math.max(16, window.innerHeight - rect.top + 12), Math.max(16, window.innerHeight - 240))}px`,
      );
    };
    position();
    window.addEventListener("resize", position);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("resize", position);
    };
  }, [open]);

  const update = <K extends keyof Omit<Appearance, "version" | "preset">>(
    key: K,
    setting: Appearance[K],
  ) => {
    appearanceStore.update({ [key]: setting });
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        aria-label="Appearance settings"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="appearance-settings"
        onClick={() => {
          dialog.current?.showModal();
          setOpen(true);
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m9.5 3-.6 2.2-1.8 1L5 5.6 2.5 10l1.6 1.6v.8L2.5 14 5 18.4l2.1-.6 1.8 1 .6 2.2h5l.6-2.2 1.8-1 2.1.6 2.5-4.4-1.6-1.6v-.8l1.6-1.6L19 5.6l-2.1.6-1.8-1L14.5 3z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
      <dialog
        ref={dialog}
        id="appearance-settings"
        className={styles.panel}
        aria-labelledby="appearance-title"
        aria-describedby="appearance-description"
        onClose={() => {
          setOpen(false);
          trigger.current?.focus();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Tab") {
            return;
          }
          const controls = event.currentTarget.querySelectorAll<HTMLElement>(
            "button:not([disabled]), input:not([disabled])",
          );
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) {
            return;
          }
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          ) {
            dialog.current?.close();
          }
        }}
      >
        <header className={styles.header}>
          <div>
            <h2 id="appearance-title">Make yourself at home!</h2>
            <p id="appearance-description">Feel free to change this site up to your liking.</p>
          </div>
          <button
            type="button"
            className={styles.close}
            aria-label="Close appearance settings"
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </header>
        <div className={styles.controls}>
          <fieldset>
            <legend>Themes {customized && <span className={styles.badge}>Customized</span>}</legend>
            <div className={styles.presets}>
              {presets
                .filter((preset) => preset.id !== "cyberpunk" || value.cyberpunkUnlocked)
                .map((preset) => (
                  <button
                    type="button"
                    key={preset.id}
                    className={styles.preset}
                    data-preview={preset.id}
                    aria-pressed={value.preset === preset.id}
                    aria-label={`${preset.name} theme`}
                    onClick={() => appearanceStore.selectPreset(preset.id)}
                  >
                    <span className={styles.swatches} data-theme-swatches aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                    <span className={styles.presetName} data-font={preset.font}>
                      {preset.name}
                    </span>
                  </button>
                ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Mode</legend>
            <div className={styles.segmented}>
              {(["system", "light", "dark"] as const).map((mode) => (
                <button
                  type="button"
                  key={mode}
                  aria-pressed={value.mode === mode}
                  onClick={() => update("mode", mode)}
                >
                  {mode[0].toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Accent</legend>
            <div className={styles.accents}>
              {accents
                .filter(([id]) => id !== "neon" || value.cyberpunkUnlocked)
                .map(([id, label]) => (
                  <button
                    type="button"
                    key={id}
                    data-accent={id}
                    aria-pressed={value.accent === id}
                    onClick={() => update("accent", id)}
                  >
                    <span className={styles.accentDot} aria-hidden="true">
                      {value.accent === id ? "✓" : ""}
                    </span>
                    {label}
                  </button>
                ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Font</legend>
            <div className={styles.fonts}>
              {fonts.map(([id, label]) => (
                <button
                  type="button"
                  key={id}
                  aria-pressed={value.font === id}
                  onClick={() => update("font", id)}
                >
                  <span data-font={id}>{label}</span>
                  {value.font === id && <span aria-hidden="true">✓</span>}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Text size</legend>
            <div className={styles.segmented}>
              <button
                type="button"
                aria-pressed={value.size === "standard"}
                onClick={() => update("size", "standard")}
              >
                Standard
              </button>
              <button
                type="button"
                aria-pressed={value.size === "larger"}
                onClick={() => update("size", "larger")}
              >
                Larger · 115%
              </button>
            </div>
          </fieldset>
          <fieldset>
            <legend>Motion</legend>
            <div className={styles.segmented}>
              <button
                type="button"
                aria-pressed={value.motion === "system"}
                onClick={() => update("motion", "system")}
              >
                Follow system
              </button>
              <button
                type="button"
                aria-pressed={value.motion === "reduce"}
                onClick={() => update("motion", "reduce")}
              >
                Reduce
              </button>
            </div>
          </fieldset>
          <fieldset className={styles.photoSettings}>
            <legend>
              <label htmlFor="marquee-speed">Photo scroll speed</label>
            </legend>
            <div className={styles.speedControl}>
              <span aria-hidden="true">🐢</span>
              <input
                id="marquee-speed"
                type="range"
                min="1"
                max="50"
                step="0.5"
                value={value.marqueeSpeed * 2}
                aria-valuetext={`${value.marqueeSpeed * 2} percent of screen width per second`}
                aria-describedby="marquee-speed-description"
                onChange={(event) => update("marqueeSpeed", event.currentTarget.valueAsNumber / 2)}
              />
              <span aria-hidden="true">🐇</span>
            </div>
            <p id="marquee-speed-description" className={styles.speedDescription}>
              Reduced motion pauses the photos.
            </p>
          </fieldset>
        </div>
        {open && <SecretController />}
        <footer className={styles.panelFooter}>
          <p role="status">
            {value.storageAvailable
              ? "Saved in this browser"
              : "For this visit only — browser storage is unavailable."}
          </p>
          <button type="button" onClick={appearanceStore.reset}>
            Reset appearance
          </button>
        </footer>
      </dialog>
    </>
  );
}
