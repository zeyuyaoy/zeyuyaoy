"use client";

import { type ReactNode, type RefCallback, useCallback, useEffect, useRef, useState } from "react";
import styles from "./Profile.module.css";

export default function ProfileScroll({
  children,
  label,
  viewportRef,
}: {
  children: ReactNode;
  label: string;
  viewportRef?: RefCallback<HTMLDivElement>;
}) {
  const viewport = useRef<HTMLDivElement | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ above: false, below: false });
  const measure = useCallback(() => {
    const element = viewport.current;
    if (!element) {
      return;
    }
    const above = element.scrollTop > 1;
    const below = element.scrollHeight - element.clientHeight - element.scrollTop > 1;
    setEdges((previous) =>
      previous.above === above && previous.below === below ? previous : { above, below },
    );
  }, []);

  useEffect(() => {
    const observer = new ResizeObserver(measure);
    if (viewport.current) {
      observer.observe(viewport.current);
    }
    if (content.current) {
      observer.observe(content.current);
    }
    measure();
    return () => observer.disconnect();
  }, [measure]);

  return (
    <div className={styles.scrollFrame} data-above={edges.above} data-below={edges.below}>
      <div
        ref={(element) => {
          viewport.current = element;
          return viewportRef?.(element);
        }}
        className={styles.scrollViewport}
        tabIndex={0}
        role="region"
        aria-label={label}
        onScroll={measure}
      >
        <div ref={content} className={styles.scrollContent}>
          {children}
        </div>
      </div>
    </div>
  );
}
