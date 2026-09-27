"use client";

import {useState} from "react";
import {advanceKonami, cyberpunkUnlockMessage, konamiSequence} from "@/lib/konami";
import {appearanceStore} from "@/lib/theme-store";
import styles from "./SecretController.module.css";

const directions = [
  ["ArrowUp", "Up", "↑"],
  ["ArrowLeft", "Left", "←"],
  ["ArrowDown", "Down", "↓"],
  ["ArrowRight", "Right", "→"],
] as const;

export default function SecretController() {
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const enter = (key: string) => {
    const next = advanceKonami(progress, key);
    setProgress(next);
    if (next === konamiSequence.length) {
      appearanceStore.unlockCyberpunk();
    }
  };

  return (
    <section className={styles.secret} aria-label="Secret controller">
      <button
        type="button"
        className={styles.trigger}
        aria-label="Secret controller"
        aria-expanded={open}
        aria-controls="secret-controller"
        onClick={() => {
          setOpen((value) => !value);
          setProgress(0);
        }}
      >
        ?
      </button>
      <div id="secret-controller" hidden={!open} className={styles.content}>
        <p>A classic cheat code opens something new.</p>
        <div className={styles.controller}>
          <div className={styles.directions}>
            {directions.map(([key, label, symbol]) => (
              <button
                type="button"
                key={key}
                data-direction={key}
                aria-label={label}
                onClick={() => enter(key)}
              >
                {symbol}
              </button>
            ))}
          </div>
          <div className={styles.letters}>
            <button type="button" aria-label="B" onClick={() => enter("b")}>
              B
            </button>
            <button type="button" aria-label="A" onClick={() => enter("a")}>
              A
            </button>
          </div>
        </div>
        <div className={styles.progress} aria-hidden="true">
          {konamiSequence.map((_, index) => (
            <span key={index} data-complete={index < progress}/>
          ))}
        </div>
        <p role="status" aria-atomic="true">
          {progress === konamiSequence.length
            ? cyberpunkUnlockMessage
            : `${progress} of ${konamiSequence.length} steps`}
        </p>
        <button type="button" className={styles.restart} onClick={() => setProgress(0)}>
          Restart
        </button>
      </div>
    </section>
  );
}
