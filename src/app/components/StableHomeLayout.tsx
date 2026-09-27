"use client";

import { type ReactNode, useLayoutEffect, useRef } from "react";
import { appearanceOptions } from "@/lib/appearance";
import styles from "./StableHomeLayout.module.css";

const sectionNames = ["intro", "widgets", "footer"] as const;
const omittedElements = new Set([
  "img",
  "picture",
  "video",
  "audio",
  "source",
  "iframe",
  "canvas",
  "object",
  "embed",
  "script",
  "style",
  "link",
  "dialog",
  "input",
  "select",
  "textarea",
  "use",
]);

function measurementCopy(source: Node): Node | null {
  if (source.nodeType === Node.TEXT_NODE) {
    return document.createTextNode(source.textContent ?? "");
  }

  if (!(source instanceof Element) || omittedElements.has(source.localName)) {
    return null;
  }

  const copy = document.createElementNS(source.namespaceURI, source.localName);
  for (const name of ["class", "style", "width", "height", "viewBox", "data-home-section"]) {
    const value = source.getAttribute(name);
    if (value !== null) {
      copy.setAttribute(name, value);
    }
  }

  if (source.localName === "a" || source.localName === "button") {
    copy.setAttribute("tabindex", "-1");
  }

  for (const child of source.childNodes) {
    const childCopy = measurementCopy(child);
    if (childCopy) {
      copy.appendChild(childCopy);
    }
  }

  return copy;
}

export default function StableHomeLayout({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  const container = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = container.current;
    if (!root || typeof ResizeObserver === "undefined") {
      return;
    }

    let disposed = false;
    let scheduledFrame: number | null = null;
    let lastWidth = root.getBoundingClientRect().width;

    const measure = () => {
      scheduledFrame = null;
      if (disposed || !root.isConnected) {
        return;
      }

      const width = root.getBoundingClientRect().width;
      if (width <= 0) {
        return;
      }

      const sections = sectionNames.map((name) =>
        root.querySelector<HTMLElement>(`:scope > [data-home-section="${name}"]`),
      );
      if (sections.some((section) => !section)) {
        return;
      }

      const heights = sectionNames.map(() => 0);
      const copies = appearanceOptions.font.map((font) => {
        const copy = document.createElement("div");
        copy.className = `${className} ${styles.measurement}`;
        copy.dataset.homeMeasurement = "";
        copy.dataset.font = font;
        copy.setAttribute("aria-hidden", "true");
        copy.inert = true;
        copy.style.width = `${width}px`;
        for (const section of sections) {
          const sectionCopy = measurementCopy(section!);
          if (sectionCopy) {
            copy.appendChild(sectionCopy);
          }
        }
        return copy;
      });

      try {
        root.parentElement!.append(...copies);
        for (const copy of copies) {
          [...copy.children].forEach((section, index) => {
            heights[index] = Math.max(heights[index], section.getBoundingClientRect().height);
          });
        }
        sectionNames.forEach((name, index) => {
          const value = `${Math.ceil(heights[index])}px`;
          const property = `--home-${name}-height`;
          if (root.style.getPropertyValue(property) !== value) {
            root.style.setProperty(property, value);
          }
        });
      } finally {
        copies.forEach((copy) => copy.remove());
      }
    };

    const schedule = () => {
      if (!disposed && scheduledFrame === null) {
        scheduledFrame = requestAnimationFrame(measure);
      }
    };

    const resize = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      if (Math.abs(width - lastWidth) > 0.1) {
        lastWidth = width;
        schedule();
      }
    });
    resize.observe(root);

    const content = new MutationObserver((records) => {
      if (
        records.some((record) => {
          const element =
            record.target instanceof Element ? record.target : record.target.parentElement;
          return element && !element.closest("dialog, time, progress");
        })
      ) {
        schedule();
      }
    });

    content.observe(root, { subtree: true, childList: true, characterData: true });
    const preferences = new MutationObserver(schedule);
    preferences.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-size"],
    });
    window.addEventListener("resize", schedule);
    document.fonts.addEventListener("loadingdone", schedule);
    document.fonts.ready.then(schedule);
    measure();

    return () => {
      disposed = true;
      if (scheduledFrame !== null) {
        cancelAnimationFrame(scheduledFrame);
      }
      resize.disconnect();
      content.disconnect();
      preferences.disconnect();
      window.removeEventListener("resize", schedule);
      document.fonts.removeEventListener("loadingdone", schedule);
      sectionNames.forEach((name) => root.style.removeProperty(`--home-${name}-height`));
    };
  }, [className]);

  return (
    <div ref={container} className={`${className} ${styles.layout}`}>
      {children}
    </div>
  );
}
