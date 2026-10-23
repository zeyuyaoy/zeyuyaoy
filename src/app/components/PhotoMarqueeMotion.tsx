"use client";

import { type ReactNode, useEffect, useRef } from "react";
import type { ProfileTab } from "@/lib/profile-content";
import { appearanceStore } from "@/lib/theme-store";
import { createMarqueeDurationUpdater, marqueeDuration } from "@/lib/photo-marquee-motion";
import styles from "./PhotoMarqueeBackground.module.css";

export default function PhotoMarqueeMotion({
  children,
  inline,
  section,
}: {
  children: ReactNode;
  inline: boolean;
  section: ProfileTab;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current!;
    const track = element.querySelector<HTMLElement>("[data-marquee-track]")!;
    const systemMotion = matchMedia("(prefers-reduced-motion: reduce)");
    const retime = createMarqueeDurationUpdater();
    let frame: number | null = null;
    function update() {
      frame = null;
      const appearance = appearanceStore.getSnapshot();
      const reduced = appearance.motion === "reduce" || systemMotion.matches;
      const visible =
        element.getBoundingClientRect().height > 0 && document.visibilityState !== "hidden";
      const dialog = element.closest("dialog");
      const active = dialog ? dialog.open : !document.querySelector("dialog[open]");
      const animation = track
        .getAnimations()
        .find((item) => item.effect instanceof KeyframeEffect && item.effect.target === track);
      const width = track.getBoundingClientRect().width / 2;
      const duration = marqueeDuration(
        width,
        document.documentElement.clientWidth,
        appearance.marqueeSpeed,
        0.9,
      );
      if (animation && duration !== null) {
        retime(track, animation, duration)?.();
      }
      const running = visible && active && !reduced;
      track.style.animationPlayState = running ? "running" : "paused";
      element.dataset.marqueeMode = reduced ? "reduced" : running ? "looping" : "hidden";
      if (reduced && animation) {
        animation.currentTime = 0;
      }
      if (visible && active) {
        const count =
          Math.ceil(element.clientWidth / Math.max(1, (element.clientHeight * 16) / 9)) + 1;
        for (const group of track.children) {
          [...group.querySelectorAll("img")].slice(0, count).forEach((image) => {
            image.loading = "eager";
          });
        }
      }
    }
    function schedule() {
      if (frame === null) {
        frame = requestAnimationFrame(update);
      }
    }
    const resize = new ResizeObserver(schedule);
    resize.observe(element);
    const dialogs = new MutationObserver(schedule);
    dialogs.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["open"],
      childList: true,
    });
    const unsubscribe = appearanceStore.subscribe(schedule);
    document.addEventListener("visibilitychange", schedule);
    window.addEventListener("resize", schedule);
    systemMotion.addEventListener("change", schedule);
    schedule();
    return () => {
      resize.disconnect();
      dialogs.disconnect();
      unsubscribe();
      document.removeEventListener("visibilitychange", schedule);
      window.removeEventListener("resize", schedule);
      systemMotion.removeEventListener("change", schedule);
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, []);
  return (
    <div
      ref={root}
      className={inline ? styles.inline : styles.background}
      aria-hidden="true"
      data-marquee-root
      data-photo-section={section}
    >
      {children}
    </div>
  );
}
