import Image from "next/image";
import type { CSSProperties } from "react";
import type { ProfileTab } from "@/lib/profile-content";
import PhotoMarqueeMotion from "./PhotoMarqueeMotion";
import type { PhotoMarqueeQueues } from "./photoMarqueeData";
import styles from "./PhotoMarqueeBackground.module.css";

export default function PhotoMarqueeBackground({
  photos,
  section,
  inline = false,
}: {
  photos: PhotoMarqueeQueues[ProfileTab];
  section: ProfileTab;
  inline?: boolean;
}) {
  if (!photos.length) {
    return null;
  }
  return (
    <PhotoMarqueeMotion inline={inline} section={section}>
      <div className={styles.row}>
        <div
          className={styles.section}
          data-marquee-section={section}
          data-marquee-count={photos.length}
          style={{ "--photo-count": photos.length } as CSSProperties}
        >
          <div className={styles.track} data-marquee-track>
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
                      unoptimized
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
      </div>
    </PhotoMarqueeMotion>
  );
}
