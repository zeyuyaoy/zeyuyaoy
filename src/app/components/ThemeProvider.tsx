"use client";

import {useSyncExternalStore} from "react";
import styles from "./ThemeProvider.module.css";

import {appearanceStore} from "@/lib/theme-store";

export default function ThemeProvider() {
  const {resolvedMode: theme} = useSyncExternalStore(
    appearanceStore.subscribe,
    appearanceStore.getSnapshot,
    appearanceStore.getServerSnapshot,
  );

  return (
    <button
      type="button"
      className={styles.themeToggleButton}
      onClick={appearanceStore.toggle}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
      aria-pressed={theme === "dark"}
    >
      {theme === "light" ? "☀️" : "🌙"}
    </button>
  );
}
