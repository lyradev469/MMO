// POST /api/mmo/action/move
// Body: { position: { x, y, mapId } }
// Authorization: Bearer <agentToken>

import { NextResponse } from "next/server";
import { getOrCreateServerInstance } from "@/features/mmo/server-singleton";
import { extractBearerToken } from "@/features/mmo/api-helpers";

export async function POST(req: Request) {
  const token = extractBearerToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Missing auth token" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (!body.position) return NextResponse.json({ ok: false, error: "Missing position" }, { status: 400 });

  const server = getOrCreateServerInstance();
  const result = server.executeAgentAction(token, { type: "move", position: body.position });

  if (!result.ok) return NextResponse.json(result, { status: 400 });

  const player = server.getPlayerByToken(token);
  return NextResponse.json({ ok: true, position: player?.position });
}
