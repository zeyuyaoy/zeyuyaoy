function isPositiveFinite(value: number): boolean {
    return Number.isFinite(value) && value > 0;
}

export function marqueeDuration(
    sequenceWidth: number, viewportWidth: number, speed: number, factor: number,
): number | null {
    if (![sequenceWidth, viewportWidth, speed, factor].every(isPositiveFinite)) {
        return null;
    }

    const duration = sequenceWidth / (viewportWidth * speed * 0.02 * factor) * 1000;
    return isPositiveFinite(duration) ? duration : null;
}

export function retimeMarquee(
    currentTime: number, oldDuration: number, delay: number, newDuration: number,
): number | null {
    if (!Number.isFinite(currentTime) || !Number.isFinite(delay)
        || !isPositiveFinite(oldDuration) || !isPositiveFinite(newDuration)) {
        return null;
    }

    const elapsed = (currentTime - delay) / oldDuration;
    const phase = ((elapsed % 1) + 1) % 1;

    let time = delay + phase * newDuration;
    if (time < 0) {
        time += Math.ceil(-time / newDuration) * newDuration;
    }

    return Number.isFinite(time) ? Math.max(0, time) : null;
}

export function createMarqueeDurationUpdater() {
    const applied = new WeakMap<HTMLElement, { animation: Animation; duration: number }>();

    return (track: HTMLElement, animation: Animation, duration: number): (() => void) | null => {
        if (!isPositiveFinite(duration)) {
            return null;
        }

        const previous = applied.get(track);
        if (previous?.animation === animation && Math.abs(previous.duration - duration) < 0.01) {
            return null;
        }

        const timing = animation.effect?.getTiming();
        const currentTime = animation.currentTime;
        if (!timing || typeof timing.duration !== "number" || typeof currentTime !== "number") {
            return null;
        }

        const time = retimeMarquee(currentTime, timing.duration, timing.delay ?? 0, duration);
        if (time === null) {
            return null;
        }

        return () => {
            track.style.setProperty("--loop-duration", `${duration}ms`);
            animation.currentTime = time;
            applied.set(track, {animation, duration});
        };
    };
}
