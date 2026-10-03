import { site } from "./site";
import { failureCode, UpstreamError } from "./upstream";

export interface WebringData {
  name: string;
  href: string;
  icon: string;
  previousHref: string;
  nextHref: string;
  pixelated?: boolean;
}

export const hackclubHome = "https://webring.hackclub.com/";
export const hackclubFallback = { previousHref: hackclubHome, nextHref: hackclubHome };

export function hackclubNeighbors(data: unknown, siteUrl = site.url) {
  if (!Array.isArray(data) || data.length === 0) {
    throw new UpstreamError("invalid_response");
  }

  const urls = data.map((member: unknown) => {
    if (
      !member ||
      typeof member !== "object" ||
      !("url" in member) ||
      typeof member.url !== "string"
    ) {
      throw new UpstreamError("invalid_response");
    }
    let url: URL;
    try {
      url = new URL(member.url);
    } catch {
      throw new UpstreamError("invalid_response");
    }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      throw new UpstreamError("invalid_response");
    }
    return url;
  });
  const host = new URL(siteUrl).hostname.toLowerCase();
  // Match the official embed's index-zero fallback for unregistered hosts.
  // https://github.com/skyfallwastaken/webring-v2/blob/main/src/pages/embed.html.astro
  const index = Math.max(
    0,
    urls.findIndex((url) => url.hostname.toLowerCase() === host),
  );
  return {
    previousHref: urls[(index - 1 + urls.length) % urls.length].href,
    nextHref: urls[(index + 1) % urls.length].href,
  };
}

export async function fetchHackclubNeighbors(signal: AbortSignal, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(`${hackclubHome}members.json`, {
      credentials: "omit",
      signal: AbortSignal.any([signal, AbortSignal.timeout(4000)]),
    });
    if (!response.ok) {
      throw new UpstreamError("http_error", response.status);
    }
    return hackclubNeighbors(await response.json());
  } catch (error) {
    if (!signal.aborted) {
      console.warn("Portfolio upstream", {
        service: "hackclub-webring",
        state: "degraded",
        reason: failureCode(error),
      });
    }
    return hackclubFallback;
  }
}

export function getWebrings(): WebringData[] {
  return [
    {
      name: "Bucket Webring",
      href: "https://webring.bucketfish.me",
      icon: "/bucket-webring.png",
      previousHref: "https://webring.bucketfish.me/redirect.html?to=prev&name=zeyuyaoy",
      nextHref: "https://webring.bucketfish.me/redirect.html?to=next&name=zeyuyaoy",
      pixelated: true,
    },
    {
      name: "Hack Club Webring",
      href: hackclubHome,
      icon: "/hackclub-webring.png",
      ...hackclubFallback,
    },
  ];
}
