"use client";

import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import styles from "./MusicOverlay.module.css";

const finishes = ["Theme", "Vintage Cream", "Dark Translucent"] as const;
const storageKey = "portfolio:cassette-finish";

export default function MusicOverlay({
  open,
  onClose,
  trigger,
  children,
}: {
  open: boolean;
  onClose: () => void;
  trigger: RefObject<HTMLButtonElement | null>;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLButtonElement>(null);
  const position = useRef<{ x: number; y: number } | null>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(
    null,
  );
  const suppressClick = useRef(false);
  const [finish, setFinish] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return Math.max(
        0,
        finishes.findIndex((value) => value === saved),
      );
    } catch {
      return 0;
    }
  });

  function place(x?: number, y?: number) {
    const element = root.current;
    if (!element) {
      return;
    }
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft ?? 0;
    const top = viewport?.offsetTop ?? 0;
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;
    const style = getComputedStyle(element);
    const insetX = parseFloat(style.scrollMarginLeft) || 16;
    const insetY = parseFloat(style.scrollMarginTop) || 16;
    const maxX = left + width - element.offsetWidth - insetX;
    const maxY = top + height - element.offsetHeight - insetY;
    const next = {
      x: Math.max(left + insetX, Math.min(x ?? position.current?.x ?? maxX, maxX)),
      y: Math.max(top + insetY, Math.min(y ?? position.current?.y ?? maxY, maxY)),
    };
    position.current = next;
    element.style.left = `${next.x}px`;
    element.style.top = `${next.y}px`;
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    place();
    surface.current?.focus({ preventScroll: true });
    const resize = () => place();
    const observer = new ResizeObserver(resize);
    if (root.current) {
      observer.observe(root.current);
    }
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("scroll", resize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("scroll", resize);
    };
  }, [open]);

  function cycle() {
    const next = (finish + 1) % finishes.length;
    setFinish(next);
    try {
      localStorage.setItem(storageKey, finishes[next]);
    } catch {
      /* Storage is optional. */
    }
  }
  function remove() {
    onClose();
    trigger.current?.focus({ preventScroll: true });
  }
  if (!open) {
    return null;
  }
  return (
    <div
      ref={root}
      id="homepage-cassette"
      className={styles.overlay}
      data-finish={finish}
      role="region"
      aria-label="Music cassette"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          remove();
        }
      }}
    >
      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.close}
          onClick={remove}
          aria-label="Remove cassette"
        >
          ×
        </button>
      </div>
      <div className={styles.body}>
        <button
          ref={surface}
          type="button"
          className={styles.surface}
          aria-label="Change cassette finish"
          aria-describedby="cassette-instructions"
          onClick={() => {
            if (!suppressClick.current) {
              cycle();
            }
            suppressClick.current = false;
          }}
          onPointerDown={(event) => {
            if (event.button !== 0 || !event.isPrimary) {
              return;
            }
            const p = position.current!;
            drag.current = {
              x: event.clientX,
              y: event.clientY,
              left: p.x,
              top: p.y,
              moved: false,
            };
            suppressClick.current = false;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const start = drag.current;
            if (!start) {
              return;
            }
            const dx = event.clientX - start.x;
            const dy = event.clientY - start.y;
            if (Math.hypot(dx, dy) > 6) {
              start.moved = true;
            }
            if (start.moved) {
              place(start.left + dx, start.top + dy);
            }
          }}
          onPointerUp={() => {
            suppressClick.current = drag.current?.moved ?? false;
            drag.current = null;
          }}
          onPointerCancel={() => {
            suppressClick.current = true;
            drag.current = null;
          }}
          onLostPointerCapture={() => {
            drag.current = null;
          }}
          onKeyDown={(event) => {
            const p = position.current;
            if (!p) {
              return;
            }
            const step = event.shiftKey ? 40 : 10;
            const direction = {
              ArrowLeft: [-step, 0],
              ArrowRight: [step, 0],
              ArrowUp: [0, -step],
              ArrowDown: [0, step],
            }[event.key];
            if (direction) {
              event.preventDefault();
              place(p.x + direction[0], p.y + direction[1]);
            }
            if (event.key === "Enter" || event.key === " ") {
              suppressClick.current = false;
            }
          }}
        />
        {children}
      </div>
      <span className={styles.srOnly} id="cassette-instructions">
        Drag to move. Click or press Enter or Space to change finish. Arrow keys move 10 pixels;
        Shift and arrow keys move 40 pixels. Escape removes the cassette.
      </span>
      <span className={styles.srOnly} role="status">
        Cassette finish: {finishes[finish]}
      </span>
    </div>
  );
}
