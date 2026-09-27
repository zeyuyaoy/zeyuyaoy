type FailureCode = "invalid_response" | "http_error" | "timeout" | "network_error";

export class UpstreamError extends Error {
  constructor(
    public readonly code: FailureCode,
    public readonly status?: number,
  ) {
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
    return (
      url.protocol === "https:" &&
      url.hostname === hostname &&
      !url.username &&
      !url.password &&
      !url.port
    );
  } catch {
    return false;
  }
}
