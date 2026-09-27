import Image from "next/image";
import type { CSSProperties } from "react";
import type { PhotoMarqueePhoto } from "./photoMarqueeData";
import styles from "./PhotoMarqueeBackground.module.css";

type Props = {
  photos: readonly PhotoMarqueePhoto[];
};

export default function PhotoMarqueeRow({ photos }: Props) {
  if (!photos.length) {
    return null;
  }

  return (
    <div className={styles.row} style={{ "--photo-count": photos.length } as CSSProperties}>
      <div className={styles.track}>
        {[0, 1].map((copy) => (
          <div className={styles.group} key={copy}>
            {photos.map((photo) => (
              <div className={styles.frame} key={photo}>
                <Image
                  className={styles.image}
                  src={photo}
                  alt=""
                  width={960}
                  height={540}
                  sizes="auto, 600px"
                  quality={75}
                  loading="lazy"
                  fetchPriority="low"
                  decoding="async"
                  draggable={false}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
