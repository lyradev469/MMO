// POST /api/mmo/player/register
// Human player registration — returns playerId + session token
// Idempotent: same FID always returns same player

import { NextResponse } from "next/server";
import type { JobId } from "@/features/mmo/types";
import { getOrCreateServerInstance } from "@/features/mmo/server-singleton";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fid, username, displayName, pfpUrl, jobId } = body as {
      fid: number;
      username: string;
      displayName: string;
      pfpUrl: string;
      jobId?: JobId;
    };

    if (!fid || !username) {
      return NextResponse.json({ ok: false, error: "Missing fid or username" }, { status: 400 });
    }

    const server = getOrCreateServerInstance();
    const player = server.registerPlayer(fid, username, displayName, pfpUrl, jobId ?? "novice");

    // Generate a session token (simple version — in production use JWT)
    const token = `sess_${fid}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    return NextResponse.json({
      ok: true,
      playerId: player.id,
      token,
      player: {
        id: player.id,
        username: player.username,
        jobId: player.jobId,
        baseLevel: player.baseLevel,
        position: player.position,
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
