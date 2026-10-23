"use client";

import { Check, Link as LinkIcon } from "lucide-react";
import { useState } from "react";
import { site } from "@/lib/research/site";

export default function CopyLinkButton({
  path,
  label = "Copy link",
  className = "",
}: {
  path: string;
  label?: string;
  className?: string;
}) {
  const [message, setMessage] = useState("");
  return (
    <>
      <button
        type="button"
        className={`copy-link ${className}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(new URL(path, site.url).toString());
            setMessage("Link copied");
          } catch {
            setMessage("Unable to copy link");
          }
        }}
        aria-label={`${label}${message === "Link copied" ? ", copied" : ""}`}
      >
        {message === "Link copied" ? <Check aria-hidden /> : <LinkIcon aria-hidden />}
        <span>{message === "Link copied" ? "Copied" : label}</span>
      </button>
      <span className="sr-only" aria-live="polite">
        {message}
      </span>
    </>
  );
}
