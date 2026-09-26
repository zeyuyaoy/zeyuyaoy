"use client";

import {useEffect, useState} from "react";
import Image, {type StaticImageData} from "next/image";
import {parseProfileImage} from "@/lib/profile-contract";

interface ProfileImageProps {
    fallbackSrc: string | StaticImageData;
    className?: string;
    alt: string;
    width: number;
    height: number;
}

export default function ProfileImage({fallbackSrc, className, alt, width, height}: ProfileImageProps) {
    const [profileImageUrl, setProfileImageUrl] = useState(fallbackSrc);

    useEffect(() => {
        let cancelled = false;
        let timer: number | undefined;
        let controller: AbortController | undefined;
        let failures = 0;
        let inFlight = false;

        async function refresh() {
            if (document.hidden || inFlight) {
                return;
            }

            inFlight = true;

            const requestController = new AbortController();
            controller = requestController;

            const requestTimeout = window.setTimeout(() => requestController.abort(), 10000);
            let delay = 5 * 60 * 1000;

            try {
                const response = await fetch("/api/profile-pic", {
                    signal: requestController.signal,
                });

                if (!response.ok) {
                    throw new Error("Profile image unavailable");
                }

                const imageUrl = parseProfileImage(await response.json());
                if (!cancelled && imageUrl) {
                    setProfileImageUrl(imageUrl);
                }

                failures = 0;
            } catch {
                if (!cancelled && failures < 3) {
                    delay = 1000 * 2 ** failures++;
                }
            } finally {
                window.clearTimeout(requestTimeout);
                inFlight = false;

                if (!cancelled && !document.hidden) {
                    timer = window.setTimeout(refresh, delay);
                }
            }
        }

        const onVisibility = () => {
            window.clearTimeout(timer);
            if (!document.hidden) {
                refresh();
            }
        };

        refresh();

        document.addEventListener("visibilitychange", onVisibility);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
            controller?.abort();
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, []);

    return (
        <Image
            className={className}
            src={profileImageUrl}
            alt={alt}
            width={width}
            height={height}
            loading="eager"
            fetchPriority="high"
            quality={90}
            sizes="(max-width: 560px) 80px, (max-width: 800px) 100px, 125px"
            onError={() => setProfileImageUrl(fallbackSrc)}
        />
    );
}
