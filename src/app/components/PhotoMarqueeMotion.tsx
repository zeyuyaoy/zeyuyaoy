"use client";

import {type ReactNode, useEffect, useRef} from "react";
import {appearanceStore} from "@/lib/theme-store";
import {createMarqueeDurationUpdater, marqueeDuration} from "@/lib/photo-marquee-motion";
import styles from "./PhotoMarqueeBackground.module.css";

export default function PhotoMarqueeMotion({children}: { children: ReactNode }) {
    const background = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const root = background.current;
        if (!root) {
            return;
        }

        const tracks = [...root.querySelectorAll<HTMLElement>(`.${styles.track}`)];
        const prepareUpdate = createMarqueeDurationUpdater();
        let scheduledFrame: number | null = null;
        let speed = appearanceStore.getSnapshot().marqueeSpeed;

        const updateSpeed = () => {
            scheduledFrame = null;
            const viewportWidth = document.documentElement.clientWidth;
            const updates = tracks.map(track => {
                const sequenceWidth = track.firstElementChild?.getBoundingClientRect().width ?? 0;
                const style = getComputedStyle(track);
                const duration = marqueeDuration(sequenceWidth, viewportWidth, speed,
                    Number(style.getPropertyValue("--speed-factor")));
                const animation = track.getAnimations().find(candidate =>
                    candidate instanceof CSSAnimation && candidate.animationName === style.animationName
                    && candidate.effect instanceof KeyframeEffect && candidate.effect.target === track);
                return duration !== null && animation ? prepareUpdate(track, animation, duration) : null;
            });
            updates.forEach(apply => apply?.());
        };

        const scheduleUpdate = () => {
            if (scheduledFrame === null) scheduledFrame = requestAnimationFrame(updateSpeed);
        };
        const onAnimationStart = (event: AnimationEvent) => {
            if (tracks.includes(event.target as HTMLElement)) scheduleUpdate();
        };
        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") scheduleUpdate();
        };

        const resizeObserver = new ResizeObserver(scheduleUpdate);
        resizeObserver.observe(root);
        tracks.forEach(track => {
            if (track.firstElementChild) resizeObserver.observe(track.firstElementChild);
        });

        root.addEventListener("animationstart", onAnimationStart);
        document.addEventListener("visibilitychange", onVisibilityChange);
        window.addEventListener("pageshow", scheduleUpdate);
        const unsubscribe = appearanceStore.subscribe(() => {
            const nextSpeed = appearanceStore.getSnapshot().marqueeSpeed;
            if (nextSpeed === speed) return;
            speed = nextSpeed;
            scheduleUpdate();
        });
        scheduleUpdate();

        return () => {
            unsubscribe();
            resizeObserver.disconnect();
            root.removeEventListener("animationstart", onAnimationStart);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            window.removeEventListener("pageshow", scheduleUpdate);
            if (scheduledFrame !== null) cancelAnimationFrame(scheduledFrame);
        };
    }, []);

    return <div ref={background} className={styles.background} aria-hidden="true">{children}</div>;
}
