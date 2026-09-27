"use client";

import {useId, useState} from "react";
import Image from "next/image";
import ProfilePic from "../../../public/profile.jpg";
import ConanPic from "../../../public/conan.jpg";
import styles from "./ProfilePhoto.module.css";

const sizes = "(max-width: 560px) 120px, (max-width: 800px) 144px, 125px";

export default function ProfilePhoto() {
  const [pinned, setPinned] = useState(false);
  const descriptionId = useId();

  return (
    <button
      type="button"
      className={styles.photo}
      aria-label="Keep Conan photo visible"
      aria-describedby={descriptionId}
      aria-pressed={pinned}
      onClick={() => setPinned((value) => !value)}
      onBlur={() => setPinned(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setPinned(false);
        }
      }}
    >
      <span id={descriptionId} hidden>
        Peter&apos;s profile picture. Hover or focus to preview something cool!
      </span>
      <Image
        className={styles.image}
        src={ProfilePic}
        alt=""
        aria-hidden="true"
        width={125}
        height={125}
        loading="eager"
        fetchPriority="high"
        quality={90}
        sizes={sizes}
      />
      <Image
        className={`${styles.image} ${styles.conan}`}
        src={ConanPic}
        alt=""
        aria-hidden="true"
        width={125}
        height={125}
        loading="eager"
        fetchPriority="low"
        quality={90}
        sizes={sizes}
      />
    </button>
  );
}
