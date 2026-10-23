"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import styles from "./StarryMotto.module.css";

const stars = [
  [3, 30, 10, 0],
  [12, 76, 6, 220],
  [22, 8, 12, 100],
  [32, 91, 9, 400],
  [43, 19, 5, 280],
  [51, 83, 12, 80],
  [62, 5, 8, 340],
  [72, 77, 6, 160],
  [82, 15, 11, 440],
  [94, 64, 10, 260],
  [98, 24, 5, 60],
  [7, 5, 5, 380],
];

export default function StarryMotto() {
  const [sparkling, setSparkling] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeout.current !== null) {
        clearTimeout(timeout.current);
      }
    },
    [],
  );

  return (
    <span className="archive-motto">
      <button
        type="button"
        className={styles.motto}
        data-sparkling={sparkling || undefined}
        title="A little stardust"
        onClick={() => {
          if (timeout.current !== null) {
            clearTimeout(timeout.current);
          }
          setSparkling(true);
          timeout.current = setTimeout(() => setSparkling(false), 1800);
        }}
      >
        <span lang="la">Per aspera ad astra!</span>
        <span className={styles.stars} aria-hidden="true">
          {stars.map(([x, y, size, delay], index) => (
            <span
              key={index}
              className={styles.star}
              style={
                {
                  left: `${x}%`,
                  top: `${y}%`,
                  width: size,
                  height: size,
                  "--star-delay": `${delay}ms`,
                } as CSSProperties
              }
            />
          ))}
        </span>
      </button>
    </span>
  );
}
