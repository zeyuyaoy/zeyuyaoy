"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import styles from "./Projects.module.css";

export default function ProjectPreview({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const pointerDown = useRef(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) {
      return;
    }
    let closeTimer: number | undefined;
    const press = () => {
      pointerDown.current = true;
    };
    const release = () => {
      pointerDown.current = false;
      window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(() => {
        if (!root.current?.contains(document.activeElement)) {
          setExpanded(false);
        }
      }, 0);
    };
    document.addEventListener("pointerdown", press, true);
    document.addEventListener("pointerup", release, true);
    document.addEventListener("pointercancel", release, true);
    window.addEventListener("blur", release);
    return () => {
      pointerDown.current = false;
      window.clearTimeout(closeTimer);
      document.removeEventListener("pointerdown", press, true);
      document.removeEventListener("pointerup", release, true);
      document.removeEventListener("pointercancel", release, true);
      window.removeEventListener("blur", release);
    };
  }, [expanded]);

  return (
    <div
      ref={root}
      className={styles.projectPeek}
      data-expanded={expanded}
      onFocus={() => setExpanded(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget) && !pointerDown.current) {
          setExpanded(false);
        }
      }}
    >
      {children}
    </div>
  );
}
