"use client";

import { useEffect, useState } from "react";
import { createKonamiKeyboard, cyberpunkUnlockMessage } from "@/lib/konami";
import { appearanceStore } from "@/lib/theme-store";
import styles from "./SecretController.module.css";

export default function KonamiRuntime() {
  const [announcement, setAnnouncement] = useState(0);
  useEffect(() => {
    if (!announcement) {
      return;
    }

    const timer = window.setTimeout(() => setAnnouncement(0), 8000);
    return () => window.clearTimeout(timer);
  }, [announcement]);
  useEffect(() => {
    const keyboard = createKonamiKeyboard(() => {
      appearanceStore.unlockCyberpunk();
      setAnnouncement((count) => count + 1);
    });

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const blocked =
        target instanceof Element &&
        Boolean(
          target.closest(
            'input, textarea, select, [contenteditable]:not([contenteditable="false"]), button, a, [role="button"], [role="slider"], [role="textbox"], dialog[open]',
          ),
        );
      keyboard.handle(event, blocked);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", keyboard.reset);
    document.addEventListener("visibilitychange", keyboard.reset);
    document.addEventListener("focusin", keyboard.reset);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", keyboard.reset);
      document.removeEventListener("visibilitychange", keyboard.reset);
      document.removeEventListener("focusin", keyboard.reset);
    };
  }, []);

  return (
    <div role="status" aria-atomic="true" className={styles.announcement}>
      {announcement > 0 && <span key={announcement}>{cyberpunkUnlockMessage}</span>}
    </div>
  );
}
