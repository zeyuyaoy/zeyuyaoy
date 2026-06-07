"use client";

import { useState, useEffect } from "react";
import OptimizedImage from "./OptimizedImage";
import styles from "./PhotoMarquee.module.css";

export default function PhotoMarquee() {
    const [photos, setPhotos] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchPhotos = async () => {
            try {
                const res = await fetch("/api/photos");

                if (!res.ok) {
                    setError("Photos are unavailable right now.");
                    setIsLoading(false);
                    return;
                }

                const data = await res.json();
                const photoList = Array.isArray(data) ? data : data.photos || [];

                if (photoList.length > 0) {
                    setPhotos(photoList.sort(() => Math.random() - 0.5));
                } else {
                    setError(data.message || "Photos are unavailable right now.");
                }

                setIsLoading(false);
            } catch (error) {
                console.error("Error fetching photos:", error);
                setError("Photos are unavailable right now.");
                setIsLoading(false);
            }
        };

        fetchPhotos().then(r => console.log("Photos fetched:", r));
    }, []);

    if (isLoading) {
        return <div className={styles.marqueeContainer}>Loading photos...</div>;
    }

    if (error) {
        return <div className={styles.marqueeContainer}>{error}</div>;
    }

    return (
        <div className={styles.marqueeContainer}>
            {photos.length > 0 && (
                <div
                    key={photos.join("-")}
                    className={`${styles.marqueeContent} ${!isLoading && styles.animate}`}
                >
                    {photos.concat(photos).map((src, index) => (
                        <div key={index} className={styles.photoWrapper}>
                            <OptimizedImage
                                src={src}
                                alt={`Photo ${index + 1}`}
                                width={300}
                                height={400}
                                className={styles.photo}
                                priority={index < 4}
                                quality={85}
                                sizes="(max-width: 768px) 50vw, 300px"
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
