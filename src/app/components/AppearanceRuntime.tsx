"use client";

import {useEffect, useSyncExternalStore} from "react";
import {applyAppearance} from "@/lib/appearance";
import {appearanceStore} from "@/lib/theme-store";

export default function AppearanceRuntime() {
  const snapshot = useSyncExternalStore(
    appearanceStore.subscribe,
    appearanceStore.getSnapshot,
    appearanceStore.getServerSnapshot,
  );
  useEffect(() => {
    const value = appearanceStore.getSnapshot();
    applyAppearance(document.documentElement, value, value.resolvedMode === "dark");
  }, [snapshot]);
  return null;
}
