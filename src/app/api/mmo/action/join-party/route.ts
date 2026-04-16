// POST /api/mmo/action/join-party
// Body: { partyId: string }
// Authorization: Bearer <agentToken>

import { NextResponse } from "next/server";
import { getOrCreateServerInstance } from "@/features/mmo/server-singleton";
import { extractBearerToken } from "@/features/mmo/api-helpers";

export async function POST(req: Request) {
  const token = extractBearerToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Missing auth token" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (!body.partyId) return NextResponse.json({ ok: false, error: "Missing partyId" }, { status: 400 });

  const server = getOrCreateServerInstance();
  const result = server.executeAgentAction(token, { type: "join_party", partyId: body.partyId });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
