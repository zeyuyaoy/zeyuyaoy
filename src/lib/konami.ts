export const konamiSequence = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
] as const;

export const cyberpunkUnlockMessage = "Cyberpunk unlocked. Find it in Appearance.";

export function advanceKonami(progress: number, key: string): number {
  const normalized = key.length === 1 ? key.toLowerCase() : key;
  const attempt: string[] = [
    ...konamiSequence.slice(0, progress === konamiSequence.length ? 0 : progress),
    normalized,
  ];
  for (let length = Math.min(attempt.length, konamiSequence.length); length > 0; length--) {
    if (
      konamiSequence
        .slice(0, length)
        .every((token, index) => token === attempt[attempt.length - length + index])
    ) {
      return length;
    }
  }
  return 0;
}

type KonamiKey = Pick<
  KeyboardEvent,
  | "key"
  | "repeat"
  | "isComposing"
  | "altKey"
  | "ctrlKey"
  | "metaKey"
  | "shiftKey"
  | "defaultPrevented"
>;

export function createKonamiKeyboard(onUnlock: () => void, now: () => number = Date.now) {
  let progress = 0;
  let lastInput = 0;
  const reset = () => {
    progress = 0;
    lastInput = 0;
  };
  return {
    reset,
    handle(event: KonamiKey, blockedTarget = false) {
      const shiftedLetter = event.key.toLowerCase() === "a" || event.key.toLowerCase() === "b";
      if (
        blockedTarget ||
        event.defaultPrevented ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        (event.shiftKey && !shiftedLetter && event.key !== "Shift")
      ) {
        reset();
        return;
      }
      if (event.repeat || event.key === "Shift") {
        return;
      }

      const time = now();
      if (time - lastInput >= 5000) {
        progress = 0;
      }

      lastInput = time;
      progress = advanceKonami(progress, event.key);
      if (progress === konamiSequence.length) {
        reset();
        onUnlock();
      }
    },
  };
}
