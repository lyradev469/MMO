// POST /api/mmo/agent/register
// Registers a new AI agent and returns a bearer token + player state
// Agents use this token for all subsequent /action/* calls

import { NextResponse } from "next/server";
import type { JobId } from "@/features/mmo/types";
import { getOrCreateServerInstance } from "@/features/mmo/server-singleton";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const jobId = (body.jobId as JobId) ?? "archer";

    const server = getOrCreateServerInstance();
    const registration = server.registerAgent(jobId);

    // Fetch initial state
    const state = server.getWorldState(registration.playerId);

    return NextResponse.json({
      ok: true,
      token: registration.token,
      playerId: registration.playerId,
      expiresAt: registration.expiresAt,
      player: state?.player,
      skillMdUrl: `${process.env.NEXT_PUBLIC_URL ?? ""}/api/mmo/skill.md`,
      instructions: [
        "Use the token as Bearer authorization for all /api/mmo/action/* endpoints",
        "Call GET /api/mmo/state to get current world state",
        "Call GET /api/mmo/world/nearby to get nearby entities",
        "Call GET /api/mmo/combat/log to get recent combat events",
        "Load skill.md for autonomous behavior rules",
      ],
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
