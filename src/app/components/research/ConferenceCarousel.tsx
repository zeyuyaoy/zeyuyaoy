"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useCallback, useState } from "react";
import type { Slide } from "@/lib/research/conferenceSlides";

export default function ConferenceCarousel({
  slides,
  caption,
  hideCaption = false,
  sizes = "(max-width: 360px) calc(100vw - 2rem), (max-width: 560px) calc(100vw - 2.5rem), (max-width: 960px) calc(100vw - clamp(3rem, 8vw, 4rem)), 600px",
}: {
  slides: Slide[];
  caption?: string;
  hideCaption?: boolean;
  sizes?: string;
}) {
  const [index, setIndex] = useState(0);
  const [visited, setVisited] = useState(() => new Set([0]));
  const hasMultiple = slides.length > 1;

  const selectSlide = useCallback((value: number) => {
    setIndex(value);
    setVisited((current) => new Set([...current, value]));
  }, []);
  const next = useCallback(
    () => selectSlide((index + 1) % slides.length),
    [index, selectSlide, slides.length],
  );
  const previous = useCallback(
    () => selectSlide((index - 1 + slides.length) % slides.length),
    [index, selectSlide, slides.length],
  );

  if (!slides.length) {
    return null;
  }

  return (
    <section
      className="research-carousel"
      aria-roledescription="carousel"
      aria-label={caption || "Conference photos"}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          previous();
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          next();
        }
      }}
    >
      <div className="carousel-stage">
        {slides.map((slide, slideIndex) => (
          <div
            key={slide.src}
            aria-hidden={slideIndex !== index}
            className="carousel-slide"
            data-active={slideIndex === index || undefined}
          >
            {visited.has(slideIndex) ? (
              <Image
                src={slide.src}
                alt={slide.alt}
                fill
                sizes={sizes}
                className="carousel-image"
                loading="eager"
              />
            ) : null}
          </div>
        ))}
        {caption ? <div className="carousel-badge">{caption}</div> : null}
        {!hideCaption && slides[index].caption ? (
          <div className="carousel-caption">{slides[index].caption}</div>
        ) : null}
        {hasMultiple ? (
          <>
            <button
              type="button"
              onClick={previous}
              className="carousel-control carousel-previous"
              aria-label="Previous slide"
            >
              <ChevronLeft aria-hidden />
            </button>
            <button
              type="button"
              onClick={next}
              className="carousel-control carousel-next"
              aria-label="Next slide"
            >
              <ChevronRight aria-hidden />
            </button>
            <div className="carousel-dots" aria-label={`Slide ${index + 1} of ${slides.length}`}>
              {slides.map((slide, slideIndex) => (
                <button
                  key={slide.src}
                  type="button"
                  aria-label={`Show slide ${slideIndex + 1}`}
                  aria-current={slideIndex === index ? "true" : undefined}
                  onClick={() => selectSlide(slideIndex)}
                  className="carousel-dot"
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
      <p className="sr-only" aria-live="polite">
        Photo {index + 1} of {slides.length}: {slides[index].alt}
      </p>
    </section>
  );
}
