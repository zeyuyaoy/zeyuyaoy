"use client";

import { useEffect, useState } from "react";
import {
  fetchHackclubNeighbors,
  hackclubFallback,
  hackclubHome,
  type WebringData,
} from "@/lib/webrings";
import Webring from "./Webring";
import styles from "./Webrings.module.css";

export default function Webrings({ items }: { items: readonly WebringData[] }) {
  const [active, setActive] = useState<string | null>(null);
  const [hackclubLinks, setHackclubLinks] = useState(hackclubFallback);
  const hasHackclub = items.some((ring) => ring.href === hackclubHome);

  useEffect(() => {
    if (!hasHackclub) {
      return;
    }
    const controller = new AbortController();
    void fetchHackclubNeighbors(controller.signal).then((links) => {
      if (!controller.signal.aborted) {
        setHackclubLinks(links);
      }
    });
    return () => controller.abort();
  }, [hasHackclub]);

  return (
    <div className={styles.row}>
      {items.map((ring) => (
        <Webring
          key={ring.name}
          {...ring}
          {...(ring.href === hackclubHome ? hackclubLinks : {})}
          open={active === ring.name}
          onOpenChange={(open) => {
            setActive((current) => (open ? ring.name : current === ring.name ? null : current));
          }}
        />
      ))}
    </div>
  );
}
