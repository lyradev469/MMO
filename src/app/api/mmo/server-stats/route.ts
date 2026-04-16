// GET /api/mmo/server-stats
// Public endpoint — returns live server statistics (v2)

import { NextResponse } from "next/server";
import { getOrCreateServerInstance } from "@/features/mmo/server-singleton";

export async function GET() {
  const server = getOrCreateServerInstance();
  const stats = server.getServerStats();
  return NextResponse.json({ ok: true, ...stats });
}
