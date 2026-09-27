"use client";

import { useEffect } from "react";
import type { ProjectData } from "@/lib/github";
import { installPeterConsole } from "@/lib/peter-console";
import { appearanceStore } from "@/lib/theme-store";

export default function PersonalConsoleRuntime({ data }: { data: ProjectData }) {
  useEffect(
    () =>
      installPeterConsole(window, {
        output: console,
        appearance: appearanceStore,
        data,
        origin: window.location.origin,
      }),
    [data],
  );
  return null;
}
