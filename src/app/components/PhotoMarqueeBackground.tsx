import Image from "next/image";
import type { CSSProperties } from "react";
import PhotoMarqueeMotion from "./PhotoMarqueeMotion";
import { createPhotoMarqueeSections, type PhotoMarqueeQueues } from "./photoMarqueeData";
import styles from "./PhotoMarqueeBackground.module.css";

export default function PhotoMarqueeBackground({ queues }: { queues: PhotoMarqueeQueues }) {
  const sections = createPhotoMarqueeSections(queues);
  const total = sections.reduce((count, section) => count + section.count, 0);
  const strips = [...sections, { ...sections[0], start: total }];

  return (
    <PhotoMarqueeMotion sections={sections.map(({ id, start, count }) => ({ id, start, count }))}>
      <div className={styles.row}>
        <div className={styles.master} data-marquee-master>
          {strips.map(({ id, start, count, photos }, index) => (
            <div
              key={`${id}-${index}`}
              className={styles.section}
              data-marquee-section={id}
              data-marquee-start={start}
              data-marquee-count={count}
              data-marquee-bridge={index === sections.length ? "true" : undefined}
              style={{ "--photo-count": count } as CSSProperties}
            >
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
          ))}
        </div>
      </div>
    </PhotoMarqueeMotion>
  );
}
