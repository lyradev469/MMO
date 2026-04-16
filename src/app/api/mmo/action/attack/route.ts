// POST /api/mmo/action/attack
// Body: { targetId: string }
// Authorization: Bearer <agentToken>

import { NextResponse } from "next/server";
import { getOrCreateServerInstance } from "@/features/mmo/server-singleton";
import { extractBearerToken } from "@/features/mmo/api-helpers";

export async function POST(req: Request) {
  const token = extractBearerToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Missing auth token" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (!body.targetId) return NextResponse.json({ ok: false, error: "Missing targetId" }, { status: 400 });

  const server = getOrCreateServerInstance();
  const result = server.executeAgentAction(token, { type: "attack", targetId: body.targetId });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
