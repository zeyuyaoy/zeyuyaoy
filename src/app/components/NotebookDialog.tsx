"use client";

import {
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import styles from "./NotebookDialog.module.css";

const HeaderActionsContext = createContext<HTMLElement | null>(null);

export function NotebookActions({
  children,
  active = true,
}: {
  children: ReactNode;
  active?: boolean;
}) {
  const target = useContext(HeaderActionsContext);
  if (!active) {
    return null;
  }
  return target ? createPortal(children, target) : children;
}

export default function NotebookDialog({
  title,
  onClose,
  onNavigate,
  previousTitle,
  nextTitle,
  returnFocus,
  children,
}: {
  title: string;
  onClose: () => void;
  onNavigate: (direction: -1 | 1) => void;
  previousTitle: string;
  nextTitle: string;
  returnFocus: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const [actions, setActions] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = returnFocus.current;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus({ preventScroll: true });
    };
  }, [returnFocus]);
  return (
    <HeaderActionsContext value={actions}>
      <dialog
        ref={dialog}
        className={styles.dialog}
        data-notebook-dialog
        aria-labelledby={heading}
        onCancel={(event) => {
          if (event.target !== event.currentTarget) {
            return;
          }
          event.preventDefault();
          onClose();
        }}
        onKeyDown={(event) => {
          if (
            event.key !== "Tab" ||
            (event.target as Element).closest("dialog") !== event.currentTarget
          ) {
            return;
          }
          const controls = [
            ...event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ),
          ].filter(
            (control) =>
              control.tabIndex >= 0 &&
              control.getClientRects().length > 0 &&
              !control.closest('[hidden], [inert], [aria-hidden="true"]'),
          );
          const first = controls[0];
          const last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus({ preventScroll: true });
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus({ preventScroll: true });
          }
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) {
            return;
          }
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          ) {
            onClose();
          }
        }}
      >
        {([-1, 1] as const).map((direction) => (
          <button
            key={direction}
            type="button"
            className={`${styles.navigation} ${direction === -1 ? styles.previous : styles.next}`}
            aria-label={`Open ${direction === -1 ? "previous" : "next"} section: ${direction === -1 ? previousTitle : nextTitle}`}
            title={direction === -1 ? previousTitle : nextTitle}
            onClick={() => onNavigate(direction)}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={direction === -1 ? "m14 6-6 6 6 6" : "m10 6 6 6-6 6"} />
            </svg>
          </button>
        ))}
        <header className={styles.header}>
          <div className={styles.titleRow}>
            <div className={styles.title}>
              <span className={styles.windowDots} aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <h2 id={heading}>{title}</h2>
            </div>
            <div className={styles.controls}>
              <div ref={setActions} className={styles.actions} />
              <button
                className={styles.close}
                type="button"
                aria-label={`Close ${title}`}
                onClick={onClose}
                autoFocus
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
          </div>
        </header>
        <div
          key={title}
          className={styles.body}
          data-notebook-body
          role="region"
          aria-label={`${title} content`}
          tabIndex={0}
        >
          {children}
        </div>
      </dialog>
    </HeaderActionsContext>
  );
}
