import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET as directory } from "./directory/route";
import { GET as authenticate } from "./auth/route";

const originalAdminKey = process.env.ADMIN_KEY;
const originalRedisUrl = process.env.REDIS_URL;

afterEach(() => {
  if (originalAdminKey === undefined) {
    delete process.env.ADMIN_KEY;
  } else {
    process.env.ADMIN_KEY = originalAdminKey;
  }
  if (originalRedisUrl === undefined) {
    delete process.env.REDIS_URL;
  } else {
    process.env.REDIS_URL = originalRedisUrl;
  }
  delete process.env.RESEARCH_REDIS_URL;
});

describe("API contracts", () => {
  it("fails closed when admin authentication is not configured", async () => {
    delete process.env.ADMIN_KEY;
    const response = await authenticate(
      new NextRequest("http://localhost/api/research/auth", { headers: { "x-admin-key": "" } }),
    );
    expect(response.status).toBe(503);
  });

  it("rejects invalid public pagination before contacting Redis", async () => {
    delete process.env.REDIS_URL;
    const response = await directory(
      new NextRequest("http://localhost/api/research/directory?limit=-5"),
    );
    expect(response.status).toBe(400);
  });
});
