import {createCachedUpstream, trustedHttpsUrl, UpstreamError} from "./upstream";

export async function fetchProfileImage(fetchImpl = fetch) {
    const response = await fetchImpl("https://slack.cytronicoder.com/api/current-profile-pic", {
        signal: AbortSignal.timeout(8000), cache: "no-store",
    });
    await response.body?.cancel();

    if (!response.ok) {
        throw new UpstreamError("http_error", response.status);
    }

    if (!response.headers.get("content-type")?.startsWith("image/")
        || !trustedHttpsUrl(response.url, "slack.cytronicoder.com")) {
        throw new UpstreamError("invalid_response");
    }

    return {imageUrl: response.url};
}

export const getProfileImage = createCachedUpstream({
    service: "profile-image", load: fetchProfileImage,
    freshMs: 5 * 60_000, staleMs: 60 * 60_000,
    fallback: {fallback: true, message: "Profile image is unavailable right now."},
});
