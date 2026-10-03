"use client";

import { type KeyboardEvent, type ReactNode, useId, useRef, useState } from "react";
import styles from "./Profile.module.css";

const tabs = [
  { id: "about", label: "About Me" },
  { id: "experience", label: "Experience" },
  { id: "education", label: "Education" },
] as const;

type ProfileTab = (typeof tabs)[number]["id"];

export default function ProfileTabs({ panels }: { panels: Record<ProfileTab, ReactNode> }) {
  const [selected, setSelected] = useState<ProfileTab>("about");
  const prefix = useId();
  const list = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function select(index: number) {
    const button = buttons.current[index];
    setSelected(tabs[index].id);
    button?.focus({ preventScroll: true });

    // Reveal only within the tab strip; scrollIntoView can also move the page.
    if (button && list.current) {
      const strip = list.current;
      const bounds = strip.getBoundingClientRect();
      const tabBounds = button.getBoundingClientRect();
      const inset = 6;
      if (tabBounds.left < bounds.left + inset) {
        strip.scrollLeft += tabBounds.left - bounds.left - inset;
      } else if (tabBounds.right > bounds.right - inset) {
        strip.scrollLeft += tabBounds.right - bounds.right + inset;
      }
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    switch (event.key) {
      case "ArrowRight":
        next = (index + 1) % tabs.length;
        break;
      case "ArrowLeft":
        next = (index + tabs.length - 1) % tabs.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = tabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    select(next);
  }

  return (
    <section className={styles.profile} aria-label="Profile" data-home-section="bio">
      <div className={styles.header}>
        <div className={styles.windowDots} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div ref={list} className={styles.tabs} role="tablist" aria-label="Profile sections">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              ref={(element) => {
                buttons.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`${prefix}-tab-${tab.id}`}
              aria-controls={`${prefix}-panel-${tab.id}`}
              aria-selected={selected === tab.id}
              tabIndex={selected === tab.id ? 0 : -1}
              className={styles.tab}
              onClick={() => select(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.panels}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            role="tabpanel"
            id={`${prefix}-panel-${tab.id}`}
            aria-labelledby={`${prefix}-tab-${tab.id}`}
            aria-hidden={selected !== tab.id}
            inert={selected !== tab.id}
            data-profile-about={tab.id === "about"}
            tabIndex={tab.id === "about" && selected === tab.id ? 0 : undefined}
            className={styles.panel}
          >
            {tab.id === "about" ? (
              <div className={styles.aboutContent}>{panels[tab.id]}</div>
            ) : (
              panels[tab.id]
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
