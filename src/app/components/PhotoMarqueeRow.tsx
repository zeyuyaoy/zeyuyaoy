import Image from "next/image";
import type {CSSProperties} from "react";
import type {PhotoMarqueePhoto, PhotoMarqueeRowName} from "./photoMarqueeData";
import styles from "./PhotoMarqueeBackground.module.css";

const imageSizes = "auto, (max-width: 560px) 1000px, (max-width: 800px) 960px, 600px";

type Props = {
    row: PhotoMarqueeRowName;
    photos: readonly PhotoMarqueePhoto[];
};

export default function PhotoMarqueeRow({row, photos}: Props) {
    if (!photos.length) {
        return null;
    }

    return (
        <div className={`${styles.row} ${styles[row]}`}
             style={{"--photo-count": photos.length} as CSSProperties}>
            <div className={styles.track}>
                {[0, 1].map(copy => (
                    <div className={styles.group} key={copy}>
                        {photos.map(photo => (
                            <div className={styles.frame} key={photo}>
                                <Image
                                    className={styles.image}
                                    src={photo}
                                    alt=""
                                    width={960}
                                    height={540}
                                    sizes={imageSizes}
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
