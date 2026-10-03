"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import type { WebringData } from "@/lib/webrings";
import styles from "./Webring.module.css";

export default function Webring({
  name,
  href,
  icon,
  previousHref,
  nextHref,
  pixelated = false,
  open,
  onOpenChange,
}: WebringData & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navRef = useRef<HTMLElement>(null);
  const iconRef = useRef<HTMLAnchorElement>(null);
  const revealOnPress = useRef(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !navRef.current?.contains(event.target)) {
        onOpenChange(false);
      }
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open, onOpenChange]);

  return (
    <nav
      ref={navRef}
      className={styles.webring}
      aria-label={name}
      data-open={open}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") {
          onOpenChange(true);
        }
      }}
      onPointerLeave={(event) => {
        if (
          event.pointerType === "mouse" &&
          !event.currentTarget.contains(document.activeElement)
        ) {
          onOpenChange(false);
        }
      }}
      onFocusCapture={() => {
        if (!revealOnPress.current) {
          onOpenChange(true);
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          onOpenChange(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          iconRef.current?.focus();
          onOpenChange(false);
        }
      }}
    >
      <a
        ref={iconRef}
        href={href}
        className={styles.icon}
        aria-label={name}
        title={`${name} — tap to reveal arrows, tap again to visit`}
        onPointerDown={(event) => {
          revealOnPress.current = event.pointerType !== "mouse" && !open;
        }}
        onPointerCancel={() => {
          revealOnPress.current = false;
        }}
        onClick={(event) => {
          if (revealOnPress.current) {
            event.preventDefault();
            revealOnPress.current = false;
            onOpenChange(true);
          }
        }}
      >
        <Image
          src={icon}
          className={pixelated ? styles.pixelated : undefined}
          alt=""
          width={28}
          height={28}
          unoptimized
        />
      </a>
      <a
        href={previousHref}
        className={`${styles.link} ${styles.previous}`}
        aria-label={`Previous site in ${name}`}
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M19 12H5m7-7-7 7 7 7" />
        </svg>
      </a>
      <a
        href={nextHref}
        className={`${styles.link} ${styles.next}`}
        aria-label={`Next site in ${name}`}
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12h14m-7-7 7 7-7 7" />
        </svg>
      </a>
    </nav>
  );
}
