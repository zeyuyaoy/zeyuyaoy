import {isRecord, trustedHttpsUrl, UpstreamError} from "./upstream";

export function parseProfileImage(data: unknown): string | null {
    if (!isRecord(data)) {
        throw new UpstreamError("invalid_response");
    }

    if (data.fallback === true) {
        return null;
    }

    if (!trustedHttpsUrl(data.imageUrl, "slack.cytronicoder.com")) {
        throw new UpstreamError("invalid_response");
    }

    return data.imageUrl;
}

