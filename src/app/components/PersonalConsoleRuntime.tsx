"use client";

import { useEffect } from "react";
import { installPeterConsole } from "@/lib/peter-console";
import { appearanceStore } from "@/lib/theme-store";

export default function PersonalConsoleRuntime() {
  useEffect(
    () =>
      installPeterConsole(window, {
        output: console,
        appearance: appearanceStore,
        origin: window.location.origin,
      }),
    [],
  );
  return null;
}
