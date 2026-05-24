"use client";

import Image from "next/image";
import { useState } from "react";

const createBlurDataURL = (width = 10, height = 10) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#f0f0f0');
  gradient.addColorStop(1, '#e0e0e0');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  return canvas.toDataURL('image/jpeg', 0.1);
};

const defaultBlurDataURL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyEkaxXCeHlsRvK9+YeU148HAzedvEMyd7zHaF/jVAIZNJKiFjdDGxudqO+TocKy7hZK1f6CyWfk8YeJq/fICNGzBPO+3+MuoKSZOElYuSEtMCqMZx+qWfKxg33M5G0iefWcqW6xAhgXhY9JH6KHu3zlOi/t3u8IfuEIEKwZfncMW6zvUFRe4Rm3O4s2xMaXqYbGMl7nNGHs7eBWRGPy0vWPUFBXJKT4Q4vM8/Yzlt3A5BQUyHmKtF//9k=";

export default function OptimizedImage({
  src,
  alt = "An image on cytronicoder's website",
  width,
  height,
  className,
  priority = false,
  quality = 75,
  sizes,
  fill = false,
  loading = "lazy",
  blurDataURL,
  onLoad,
  onError,
  ...props
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = (e) => {
    setIsLoading(false);
    if (onLoad) onLoad(e);
  };

  const handleError = (e) => {
    setIsLoading(false);
    setHasError(true);
    if (onError) onError(e);
  };

  const defaultSizes = sizes || (
    fill
      ? "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      : `${width}px`
  );

  const imageProps = {
    src,
    alt,
    className: `${className || ''} ${isLoading ? 'opacity-0 transition-opacity duration-300' : 'opacity-100 transition-opacity duration-300'}`,
    quality,
    loading: priority ? "eager" : loading,
    onLoad: handleLoad,
    onError: handleError,
    ...props
  };

  const shouldUseBlur = (width && height && width >= 40 && height >= 40) || fill;

  if (shouldUseBlur) {
    imageProps.placeholder = "blur";
    imageProps.blurDataURL = blurDataURL || defaultBlurDataURL;
  }

  if (fill) {
    imageProps.fill = true;
    imageProps.sizes = defaultSizes;
  } else {
    imageProps.width = width;
    imageProps.height = height;
    if (sizes) imageProps.sizes = sizes;
  }

  if (hasError) {
    return (
      <div
        className={`${className || ''} bg-gray-200 flex items-center justify-center text-gray-500 text-sm`}
        style={{ width, height }}
      >
        Failed to load image
      </div>
    );
  }

  return (
    <div className="relative">
      <Image
        {...imageProps}
        alt={alt}
        priority={priority}
      />
      {isLoading && (
        <div
          className="absolute inset-0 bg-gray-100 animate-pulse flex items-center justify-center"
          style={{ width, height }}
        >
          <div className="text-gray-400 text-sm">Loading...</div>
        </div>
      )}
    </div>
  );
}
