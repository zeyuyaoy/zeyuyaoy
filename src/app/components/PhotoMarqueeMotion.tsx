"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { appearanceStore } from "@/lib/theme-store";
import {
  createMarqueeDurationUpdater,
  createMarqueeNavigator,
  marqueeDuration,
  type MarqueeSection,
} from "@/lib/photo-marquee-motion";
import { useProfileTab } from "./ProfileTabProvider";
import styles from "./PhotoMarqueeBackground.module.css";

export default function PhotoMarqueeMotion({
  children,
  sections,
}: {
  children: ReactNode;
  sections: readonly MarqueeSection[];
}) {
  const { selected } = useProfileTab();
  const background = useRef<HTMLDivElement>(null);
  const controller = useRef<{ select: (id: MarqueeSection["id"]) => void } | null>(null);

  useEffect(() => {
    const root = background.current;
    const master = root?.querySelector<HTMLElement>("[data-marquee-master]");
    if (!root || !master) {
      return;
    }

    const strips = [...master.querySelectorAll<HTMLElement>("[data-marquee-section]")].map(
      (element) => ({
        element,
        id: element.dataset.marqueeSection,
        start: Number(element.dataset.marqueeStart),
        count: Number(element.dataset.marqueeCount),
        track: element.firstElementChild as HTMLElement,
        animation: undefined as CSSAnimation | undefined,
        warmed: 0,
      }),
    );
    const navigator = createMarqueeNavigator(sections);
    const prepareUpdate = createMarqueeDurationUpdater();
    const systemMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let appearance = appearanceStore.getSnapshot();
    let state = navigator.advance(0);
    let frame: number | null = null;
    let dirty = true;
    let ready = false;
    let reduced = false;
    let restart = true;
    let photoWidth = 0;
    let visiblePhotos = 0;

    function pauseLoops(reset = false) {
      for (const { animation } of strips) {
        if (!animation || animation.playState === "idle") {
          continue;
        }
        if (animation.playState !== "paused") {
          animation.pause();
        }
        if (reset) {
          animation.currentTime = 0;
        }
      }
    }

    function resumeLoops(reset: boolean) {
      if (reset) {
        pauseLoops(true);
      }
      const aboutTime = strips[0].animation?.currentTime;
      const bridge = strips.at(-1)!.animation;
      if (bridge && typeof aboutTime === "number") {
        bridge.currentTime = aboutTime;
      }
      for (const strip of strips) {
        const animation = strip.animation;
        if (!animation || animation.playState === "idle") {
          continue;
        }
        if (strip.id === state.selected) {
          if (animation.playState !== "running") {
            animation.play();
          }
        } else {
          if (animation.playState !== "paused") {
            animation.pause();
          }
          animation.currentTime = 0;
        }
      }
    }

    function resetOffscreenLoops() {
      for (const section of sections) {
        const copies = strips.filter((strip) => strip.id === section.id);
        const visible = copies.some(
          (strip) =>
            strip.start + strip.count > state.position &&
            strip.start < state.position + visiblePhotos,
        );
        if (!visible) {
          copies.forEach(({ animation }) => {
            if (animation && animation.playState !== "idle") {
              animation.currentTime = 0;
            }
          });
        }
      }
    }

    function measure() {
      const viewportWidth = document.documentElement.clientWidth;
      photoWidth = strips[0].element.getBoundingClientRect().width / strips[0].count;
      ready = viewportWidth > 800 && Number.isFinite(photoWidth) && photoWidth > 0;
      reduced = appearance.motion === "reduce" || systemMotion.matches;
      if (!ready) {
        return;
      }
      visiblePhotos = root!.getBoundingClientRect().width / photoWidth;

      const updates = strips.map((strip) => {
        const style = getComputedStyle(strip.track);
        strip.animation = strip.track
          .getAnimations()
          .find(
            (animation): animation is CSSAnimation =>
              animation instanceof CSSAnimation &&
              animation.animationName === style.animationName &&
              animation.effect instanceof KeyframeEffect &&
              animation.effect.target === strip.track,
          );
        const duration = marqueeDuration(
          strip.element.getBoundingClientRect().width,
          viewportWidth,
          appearance.marqueeSpeed,
          Number(style.getPropertyValue("--speed-factor")),
        );
        return duration !== null && strip.animation
          ? prepareUpdate(strip.track, strip.animation, duration)
          : null;
      });
      updates.forEach((apply) => apply?.());

      for (const strip of strips) {
        const count = Math.min(strip.count, Math.ceil(visiblePhotos) + 1);
        for (const group of strip.track.children) {
          const images = group.querySelectorAll("img");
          for (let index = strip.warmed; index < count; index++) {
            images[index].loading = "eager";
            void images[index].decode().catch(() => {});
          }
        }
        strip.warmed = Math.max(strip.warmed, count);
      }
    }

    function place() {
      master!.style.setProperty("--marquee-offset", `${state.position * photoWidth}px`);
      root!.dataset.marqueePosition = String(state.position);
    }

    function tick(now: number) {
      frame = null;
      if (dirty) {
        measure();
        dirty = false;
      }
      if (!ready || document.visibilityState === "hidden") {
        state = navigator.settle();
        pauseLoops(true);
        restart = true;
        root!.dataset.marqueeMode = "hidden";
        return;
      }
      if (reduced || restart) {
        state = navigator.settle();
        place();
        pauseLoops(true);
        restart = reduced;
        root!.dataset.marqueeMode = reduced ? "reduced" : "looping";
        if (!reduced) {
          resumeLoops(true);
        }
        return;
      }

      const wasSeeking = state.seeking;
      state = navigator.advance(now);
      place();
      root!.dataset.marqueeMode = state.seeking ? "seeking" : "looping";
      if (state.seeking) {
        resetOffscreenLoops();
        schedule();
      } else {
        resumeLoops(wasSeeking);
      }
    }

    function schedule(remeasure = false) {
      dirty ||= remeasure;
      if (frame === null) {
        frame = requestAnimationFrame(tick);
      }
    }
    const onResize = () => schedule(true);
    const onAnimationStart = (event: AnimationEvent) => {
      if (strips.some((strip) => strip.track === event.target)) {
        schedule(true);
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (frame !== null) {
          cancelAnimationFrame(frame);
          frame = null;
        }
        state = navigator.settle();
        pauseLoops(true);
        restart = true;
        root.dataset.marqueeMode = "hidden";
      } else {
        schedule(true);
      }
    };

    controller.current = {
      select(id) {
        const now = performance.now();
        if (navigator.select(id, now)) {
          pauseLoops();
          state = navigator.advance(now);
          schedule();
        }
      },
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(root);
    strips.forEach(({ element }) => resizeObserver.observe(element));
    root.addEventListener("animationstart", onAnimationStart);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onResize);
    systemMotion.addEventListener("change", onResize);
    const unsubscribe = appearanceStore.subscribe(() => {
      const next = appearanceStore.getSnapshot();
      if (next.marqueeSpeed !== appearance.marqueeSpeed || next.motion !== appearance.motion) {
        appearance = next;
        schedule(true);
      }
    });
    schedule(true);

    return () => {
      controller.current = null;
      unsubscribe();
      resizeObserver.disconnect();
      root.removeEventListener("animationstart", onAnimationStart);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onResize);
      systemMotion.removeEventListener("change", onResize);
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      pauseLoops();
    };
  }, [sections]);

  useEffect(() => {
    controller.current?.select(selected);
  }, [sections, selected]);

  return (
    <div
      ref={background}
      className={styles.background}
      aria-hidden="true"
      data-profile-tab={selected}
      data-marquee-root
    >
      {children}
    </div>
  );
}
