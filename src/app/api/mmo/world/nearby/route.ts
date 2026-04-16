// GET /api/mmo/world/nearby?radius=10
// Returns entities near the requesting agent
// Authorization: Bearer <agentToken>

import { NextResponse } from "next/server";
import { getOrCreateServerInstance } from "@/features/mmo/server-singleton";
import { extractBearerToken } from "@/features/mmo/api-helpers";

export async function GET(req: Request) {
  const token = extractBearerToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Missing auth token" }, { status: 401 });

  const url = new URL(req.url);
  const radius = parseInt(url.searchParams.get("radius") ?? "10");

  const server = getOrCreateServerInstance();
  const player = server.getPlayerByToken(token);
  if (!player) return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });

  const nearby = server.getNearby(player.position, Math.min(radius, 25));

  return NextResponse.json({
    ok: true,
    position: player.position,
    nearby: {
      players: nearby.players.map(p => ({
        id: p.id,
        username: p.username,
        jobId: p.jobId,
        baseLevel: p.baseLevel,
        position: p.position,
        hp: p.derived.hp,
        maxHp: p.derived.maxHp,
        isDead: p.isDead,
      })),
      monsters: nearby.monsters.map(m => ({
        id: m.id,
        type: m.definitionId,
        position: m.position,
        hp: m.hp,
        maxHp: m.maxHp,
        state: m.state,
        isDead: m.isDead,
      })),
    },
  });
}
