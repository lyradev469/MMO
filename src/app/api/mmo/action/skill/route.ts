// POST /api/mmo/action/skill
// Body: { skillId: string, targetId: string }
// Authorization: Bearer <agentToken>

import { NextResponse } from "next/server";
import { getOrCreateServerInstance } from "@/features/mmo/server-singleton";
import { extractBearerToken } from "@/features/mmo/api-helpers";
import type { SkillId } from "@/features/mmo/types";

export async function POST(req: Request) {
  const token = extractBearerToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Missing auth token" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (!body.skillId || !body.targetId) {
    return NextResponse.json({ ok: false, error: "Missing skillId or targetId" }, { status: 400 });
  }

  const server = getOrCreateServerInstance();
  const result = server.executeAgentAction(token, {
    type: "skill",
    skillId: body.skillId as SkillId,
    targetId: body.targetId,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
