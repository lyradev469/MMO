// GET /api/mmo/leaderboard?limit=50
// Returns top players by level

import { NextResponse } from "next/server";
import { getOrCreateServerInstance } from "@/features/mmo/server-singleton";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50"));
  const server = getOrCreateServerInstance();
  const board = server.getLeaderboard(limit);
  return NextResponse.json({ ok: true, leaderboard: board });
}
