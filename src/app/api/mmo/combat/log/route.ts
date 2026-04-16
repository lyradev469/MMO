// GET /api/mmo/combat/log
// Returns recent combat events for the requesting agent
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

  // Return the last 50 combat events involving this player
  const recentLog = server.combatLog
    .filter(e => e.attackerId === player.id || e.targetId === player.id)
    .slice(-50);

  return NextResponse.json({ ok: true, log: recentLog, count: recentLog.length });
}
