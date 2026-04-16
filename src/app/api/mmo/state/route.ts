// GET /api/mmo/state
// Returns full world state for the requesting agent
// Authorization: Bearer <agentToken>

import { NextResponse } from "next/server";
import { getOrCreateServerInstance } from "@/features/mmo/server-singleton";
import { extractBearerToken } from "@/features/mmo/api-helpers";

export async function GET(req: Request) {
  const token = extractBearerToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Missing auth token" }, { status: 401 });

  const server = getOrCreateServerInstance();
  const player = server.getPlayerByToken(token);
  if (!player) return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });

  const state = server.getWorldState(player.id);
  return NextResponse.json({ ok: true, ...state });
}
