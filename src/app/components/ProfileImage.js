"use client";

import { useEffect, useState } from "react";
import OptimizedImage from "./OptimizedImage";

const ProfileImage = ({ fallbackSrc, className, alt = "Zeyu Yao's profile picture", width, height }) => {
    const [profileImageUrl, setProfileImageUrl] = useState(fallbackSrc);
    const [retryCount, setRetryCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchProfileImage = async () => {
            try {
                const response = await fetch("/api/profile-pic");

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                if (data.fallback) {
                    setIsLoading(false);
                    return;
                }

                if (data.imageUrl) {
                    setProfileImageUrl(data.imageUrl);
                    setRetryCount(0);
                }

                setIsLoading(false);
            } catch (error) {
                console.error("Error fetching profile image:", error);
                setIsLoading(false);

                if (retryCount < 3) {
                    const delay = Math.pow(2, retryCount) * 1000;
                    setTimeout(() => {
                        setRetryCount(prev => prev + 1);
                        fetchProfileImage();
                    }, delay);
                }
            }
        };

        fetchProfileImage();
        const intervalId = setInterval(() => {
            setRetryCount(0);
            fetchProfileImage();
        }, 5 * 60 * 1000);

        return () => clearInterval(intervalId);
    }, [retryCount]);

    return (
        <OptimizedImage
            className={className}
            src={profileImageUrl || fallbackSrc}
            alt={alt}
            width={width}
            height={height}
            priority={true}
            quality={90}
            sizes="150px"
        />
    );
};

export default ProfileImage;
