"use client";

import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { advanceWheelGesture, initialWheelGesture } from "@/lib/profile-carousel";
import ProfileScroll from "./ProfileScroll";
import styles from "./Profile.module.css";

export default function ProfileCarousel({
  items,
  label,
  itemLabel,
}: {
  label: string;
  itemLabel: string;
  items: readonly { title: string; content: ReactNode }[];
}) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const [announcement, setAnnouncement] = useState("");
  const selected = useRef(0);
  const frame = useRef<HTMLDivElement>(null);
  const viewports = useRef<(HTMLDivElement | null)[]>([]);
  const prefix = useId();

  const select = useCallback(
    (index: number) => {
      if (items.length < 2) {
        return;
      }
      const next = ((index % items.length) + items.length) % items.length;
      if (next === selected.current) {
        return;
      }
      if (viewports.current[selected.current]?.contains(document.activeElement)) {
        frame.current?.focus({ preventScroll: true });
      }
      setDirection(index > selected.current ? 1 : -1);
      selected.current = next;
      setCurrent(next);
      setAnnouncement(`${items[next].title}, ${itemLabel} ${next + 1} of ${items.length}`);
    },
    [items, itemLabel],
  );

  useEffect(() => {
    const element = frame.current;
    if (!element) {
      return;
    }
    let gesture = { ...initialWheelGesture };
    let touch: { x: number; y: number; delta: number; native: boolean; captured: boolean } | null =
      null;
    function wheel(event: WheelEvent) {
      if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
        return;
      }
      const viewport = viewports.current[selected.current];
      if (!viewport) {
        return;
      }
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
      const deltaY = event.deltaY * scale;
      const direction = Math.sign(deltaY);
      const canScroll =
        direction > 0
          ? viewport.scrollTop + viewport.clientHeight < viewport.scrollHeight - 1
          : viewport.scrollTop > 1;
      const result = advanceWheelGesture(gesture, {
        time: event.timeStamp,
        deltaX: event.deltaX * scale,
        deltaY,
        canScroll,
        canNavigate:
          selected.current + direction >= 0 && selected.current + direction < items.length,
      });
      gesture = result.state;
      if (result.preventDefault) {
        event.preventDefault();
      }
      if (result.direction) {
        select(selected.current + result.direction);
      }
    }
    function touchStart(event: TouchEvent) {
      if (event.touches.length !== 1 || (event.target as Element).closest("button, a")) {
        touch = null;
        return;
      }
      const viewport = viewports.current[selected.current];
      touch = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
        delta: 0,
        native: !!viewport && viewport.scrollHeight > viewport.clientHeight + 1,
        captured: false,
      };
    }
    function touchMove(event: TouchEvent) {
      if (!touch || touch.native || event.touches.length !== 1) {
        return;
      }
      const delta = touch.y - event.touches[0].clientY;
      if (Math.abs(delta) < 12 || Math.abs(delta) <= Math.abs(touch.x - event.touches[0].clientX)) {
        return;
      }
      const next = selected.current + Math.sign(delta);
      if (next >= 0 && next < items.length) {
        event.preventDefault();
        touch.delta = delta;
        touch.captured = true;
      }
    }
    function touchEnd() {
      if (touch?.captured && Math.abs(touch.delta) >= 50) {
        select(selected.current + Math.sign(touch.delta));
      }
      touch = null;
    }
    function touchCancel() {
      touch = null;
    }
    element.addEventListener("wheel", wheel, { passive: false });
    element.addEventListener("touchstart", touchStart, { passive: true });
    element.addEventListener("touchmove", touchMove, { passive: false });
    element.addEventListener("touchend", touchEnd);
    element.addEventListener("touchcancel", touchCancel);
    return () => {
      element.removeEventListener("wheel", wheel);
      element.removeEventListener("touchstart", touchStart);
      element.removeEventListener("touchmove", touchMove);
      element.removeEventListener("touchend", touchEnd);
      element.removeEventListener("touchcancel", touchCancel);
    };
  }, [items.length, select]);

  return (
    <div
      ref={frame}
      className={styles.carousel}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      aria-describedby={`${prefix}-instructions`}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) {
          return;
        }
        const next =
          event.key === "ArrowDown"
            ? current + 1
            : event.key === "ArrowUp"
              ? current - 1
              : event.key === "Home"
                ? 0
                : event.key === "End"
                  ? items.length - 1
                  : null;
        if (next !== null) {
          event.preventDefault();
          select(next);
        }
      }}
    >
      <span id={`${prefix}-instructions`} className={styles.srOnly}>
        Use up and down arrows to change entries. Tab into the details to scroll longer text.
      </span>
      <div className={styles.slides}>
        {items.map((item, index) => (
          <div
            key={item.title}
            id={`${prefix}-slide-${index}`}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${items.length}: ${item.title}`}
            aria-hidden={current !== index}
            inert={current !== index}
            className={styles.slide}
            data-direction={direction > 0 ? "down" : "up"}
          >
            <ProfileScroll
              label={`${item.title} details`}
              viewportRef={(element) => {
                viewports.current[index] = element;
              }}
            >
              {item.content}
            </ProfileScroll>
          </div>
        ))}
      </div>
      <div className={styles.carouselControls} role="group" aria-label={`${label} navigation`}>
        <button
          type="button"
          aria-label={`Previous ${itemLabel}`}
          aria-disabled={items.length < 2}
          aria-controls={`${prefix}-slide-${current}`}
          onClick={() => select(current - 1)}
        >
          <span aria-hidden="true">↑</span>
        </button>
        <span className={styles.counter} aria-hidden="true">
          {current + 1} / {items.length}
        </span>
        <button
          type="button"
          aria-label={`Next ${itemLabel}`}
          aria-disabled={items.length < 2}
          aria-controls={`${prefix}-slide-${current}`}
          onClick={() => select(current + 1)}
        >
          <span aria-hidden="true">↓</span>
        </button>
      </div>
      <span role="status" aria-live="polite" aria-atomic="true" className={styles.srOnly}>
        {announcement}
      </span>
    </div>
  );
}
