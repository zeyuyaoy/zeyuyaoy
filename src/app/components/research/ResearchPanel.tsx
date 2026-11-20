"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { ResearchPresentation } from "@/lib/research/presentation";

const ResearchPopup = dynamic(() => import("./ResearchPopup"), {
  loading: () => <p role="status">Loading research…</p>,
});

export default function ResearchPanel() {
  const [data, setData] = useState<ResearchPresentation | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/research/presentation", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Research unavailable");
        }
        return response.json() as Promise<ResearchPresentation>;
      })
      .then((payload) => {
        if (!controller.signal.aborted) {
          setData(payload);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFailed(true);
        }
      });
    return () => controller.abort();
  }, [attempt]);

  return (
    <ResearchPopup
      data={data}
      failed={failed}
      onRetry={() => {
        setFailed(false);
        setData(null);
        setAttempt((value) => value + 1);
      }}
    />
  );
}
