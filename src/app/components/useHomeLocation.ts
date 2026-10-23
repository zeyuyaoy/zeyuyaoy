"use client";

import { useSyncExternalStore } from "react";

const eventName = "portfolio:navigate";
function subscribe(update: () => void) {
  window.addEventListener("popstate", update);
  window.addEventListener(eventName, update);
  return () => {
    window.removeEventListener("popstate", update);
    window.removeEventListener(eventName, update);
  };
}
export function navigateHome(url: string, mode: "push" | "replace" = "push") {
  if (url === `${location.pathname}${location.search}${location.hash}`) {
    return;
  }
  window.history[mode === "push" ? "pushState" : "replaceState"](window.history.state, "", url);
  window.dispatchEvent(new Event(eventName));
}
export default function useHomeLocation() {
  return useSyncExternalStore(
    subscribe,
    () => `${location.pathname}${location.search}${location.hash}`,
    () => "/",
  );
}
