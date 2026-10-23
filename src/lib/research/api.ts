import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { RedisUnavailableError } from "./redis";

export function jsonError(message: string, status: number, details?: unknown) {
  return NextResponse.json(
    details === undefined ? { error: message } : { error: message, details },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export function authorizeAdmin(req: NextRequest): NextResponse | null {
  const configured = process.env.ADMIN_KEY;
  if (!configured?.trim()) {
    return jsonError("admin authentication is not configured", 503);
  }

  const supplied = req.headers.get("x-admin-key") || "";
  const expectedBytes = createHash("sha256").update(configured).digest();
  const suppliedBytes = createHash("sha256").update(supplied).digest();
  const matches = timingSafeEqual(expectedBytes, suppliedBytes);

  return matches ? null : jsonError("unauthorized", 401);
}

export async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new SyntaxError("invalid JSON request body");
  }
}

export function routeError(error: unknown, context: string): NextResponse {
  if (error instanceof SyntaxError) {
    return jsonError(error.message, 400);
  }
  if (error instanceof RedisUnavailableError) {
    return jsonError(error.message, 503);
  }
  console.error(`${context}:`, error);
  return jsonError("internal server error", 500);
}

export const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
