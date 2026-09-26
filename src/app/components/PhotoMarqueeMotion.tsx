"use client";

import {type ReactNode, useEffect, useRef} from "react";
import {appearanceStore} from "@/lib/theme-store";
import styles from "./PhotoMarqueeBackground.module.css";

export default function PhotoMarqueeMotion({children}: { children: ReactNode }) {
    const background = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const root = background.current;
        if (!root) {
            return;
        }

        const tracks = [...root.querySelectorAll<HTMLElement>(`.${styles.track}`)];

        const updateSpeed = () => {
            const pixelsPerSecond = document.documentElement.clientWidth
                * appearanceStore.getSnapshot().marqueeSpeed * 0.02;
            tracks.forEach(track => {
                const sequenceWidth = track.firstElementChild?.getBoundingClientRect().width ?? 0;
                if (!sequenceWidth) {
                    return;
                }

                const factor = Number(getComputedStyle(track).getPropertyValue("--speed-factor")) || 1;
                track.getAnimations().forEach(animation => {
                    const duration = animation.effect?.getComputedTiming().duration;
                    if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) {
                        return;
                    }

                    animation.updatePlaybackRate(pixelsPerSecond * factor * duration / (1000 * sequenceWidth));
                });
            });
        };

        const resizeObserver = new ResizeObserver(updateSpeed);
        resizeObserver.observe(root);
        tracks.forEach(track => {
            if (track.firstElementChild) resizeObserver.observe(track.firstElementChild);
        });

        root.addEventListener("animationstart", updateSpeed);
        const unsubscribe = appearanceStore.subscribe(updateSpeed);
        updateSpeed();

        return () => {
            unsubscribe();
            resizeObserver.disconnect();
            root.removeEventListener("animationstart", updateSpeed);
        };
    }, []);

    return <div ref={background} className={styles.background} aria-hidden="true">{children}</div>;
}
