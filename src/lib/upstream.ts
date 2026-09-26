export type FailureCode = "invalid_response" | "http_error" | "timeout" | "network_error";

export class UpstreamError extends Error {
    constructor(public readonly code: FailureCode, public readonly status?: number) {
        super(status ? `${code}: HTTP ${status}` : code);
        this.name = "UpstreamError";
    }
}

export function failureCode(error: unknown): FailureCode {
    if (error instanceof UpstreamError) {
        return error.code;
    }

    if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) {
        return "timeout";
    }

    if (error instanceof SyntaxError) {
        return "invalid_response";
    }

    return "network_error";
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function trustedHttpsUrl(value: unknown, hostname: string): value is string {
    if (typeof value !== "string") {
        return false;
    }

    try {
        const url = new URL(value);
        return url.protocol === "https:" && url.hostname === hostname
            && !url.username && !url.password && !url.port;
    } catch {
        return false;
    }
}

export interface UpstreamEvent {
    service: string;
    state: "degraded" | "recovered";
    reason?: FailureCode;
    status?: number;
    stale?: boolean;
}

export function reportUpstream(event: UpstreamEvent) {
    if (event.state === "degraded") {
        console.warn("Portfolio upstream", event);
    } else {
        console.info("Portfolio upstream", event);
    }
}

export function createCachedUpstream<T extends object, F extends object>({
                                                                             service,
                                                                             load,
                                                                             fallback,
                                                                             freshMs,
                                                                             staleMs,
                                                                             now = Date.now,
                                                                             report = reportUpstream,
                                                                             retryMs = 30_000,
                                                                         }: {
    service: string;
    load: () => Promise<T>;
    fallback: F;
    freshMs: number;
    staleMs: number;
    now?: () => number;
    report?: (event: UpstreamEvent) => void;
    retryMs?: number;
}) {
    type Result = T | (T & { stale: true }) | (F & { reason: FailureCode });
    let cached: { data: T; timestamp: number } | undefined;
    let pending: Promise<Result> | undefined;
    let failure: FailureCode | undefined;
    let retryAt = 0;

    const degraded = (): Result => cached && now() - cached.timestamp < staleMs
        ? {...cached.data, stale: true}
        : {...fallback, reason: failure ?? "network_error"};

    return async function get(): Promise<Result> {
        if (cached && now() - cached.timestamp < freshMs) {
            return cached.data;
        }

        if (pending) {
            return pending;
        }

        if (failure && now() < retryAt) {
            return degraded();
        }

        pending = (async () => {
            try {
                const data = await Promise.resolve().then(load);
                cached = {data, timestamp: now()};
                if (failure) {
                    report({service, state: "recovered"});
                }

                failure = undefined;
                return data;
            } catch (error) {
                const reason = failureCode(error);
                if (reason !== failure) report({
                    service, state: "degraded", reason,
                    ...(error instanceof UpstreamError && error.status ? {status: error.status} : {}),
                    stale: Boolean(cached && now() - cached.timestamp < staleMs),
                });
                failure = reason;
                retryAt = now() + retryMs;
                return degraded();
            } finally {
                pending = undefined;
            }
        })();
        return pending;
    };
}
