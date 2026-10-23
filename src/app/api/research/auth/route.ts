import { NextRequest, NextResponse } from "next/server";
import { authorizeAdmin, PRIVATE_HEADERS } from "@/lib/research/api";

export async function GET(req: NextRequest) {
  const auth = authorizeAdmin(req);
  return auth || NextResponse.json({ authenticated: true }, { headers: PRIVATE_HEADERS });
}
