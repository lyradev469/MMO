// ============================================================
// ChainQuest MMO - Standalone Authoritative Server
// Runs as a pure Node.js process (no Next.js required).
// Deploy on Railway, Fly.io, Render, or any VPS.
//
// HTTP REST endpoints (same as Next.js API routes):
//   POST /mmo/agent/register
//   POST /mmo/action/move
//   POST /mmo/action/attack
//   POST /mmo/action/skill
//   POST /mmo/action/join-party
//   GET  /mmo/state
//   GET  /mmo/world/nearby
//   GET  /mmo/leaderboard
//   GET  /mmo/server-stats
//   GET  /mmo/skill.md
//   POST /mmo/player/register
//   GET  /mmo/combat/log
//
// WebSocket: ws://<host>/mmo/ws
// ============================================================

import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { URL } from "url";

// Import the shared MMO engine (same code as Next.js version)
import {
  startMMOServer,
  registerAgent,
  registerPlayer,
  getPlayerByToken,
  executeAgentAction,
  queueInput,
  getWorldState,
  getNearby,
  getLeaderboard,
  getServerStats,
  connectPlayer,
  disconnectPlayer,
} from "../src/features/mmo/mmo-server";

import type { WSMessage, InputEvent } from "../src/features/mmo/types";

// ----------------------------------------------------------
// Config
// ----------------------------------------------------------

// Railway injects PORT env var — must use it or requests won't reach the app
const PORT = parseInt(process.env.PORT ?? process.env.MMO_PORT ?? "8080");
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";
const SERVER_SECRET = process.env.MMO_SERVER_SECRET ?? "";

// Combat log (shared in-process)
const combatLog: unknown[] = [];

// Human player token store — maps token → playerId
const humanTokens = new Map<string, string>();

// ----------------------------------------------------------
// Start the game tick loop
// ----------------------------------------------------------

startMMOServer();
console.log(`[ChainQuest] MMO engine started`);

// ----------------------------------------------------------
// HTTP Server
// ----------------------------------------------------------

const server = http.createServer((req, res) => {
  // CORS — allow all origins (Farcaster mini apps run from various domains)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const path = url.pathname;

  // Health check
  if (path === "/health" && req.method === "GET") {
    sendJSON(res, 200, { ok: true, uptime: process.uptime() });
    return;
  }

  // Route to handlers
  handleRoute(req, res, path, url).catch((err) => {
    console.error("[Server] Route error:", err);
    sendJSON(res, 500, { ok: false, error: "Internal server error" });
  });
});

// ----------------------------------------------------------
// Route Handler
// ----------------------------------------------------------

async function handleRoute(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  path: string,
  url: URL,
) {
  // ---- GET /mmo/server-stats ----
  if (path === "/mmo/server-stats" && req.method === "GET") {
    sendJSON(res, 200, { ok: true, ...getServerStats() });
    return;
  }

  // ---- GET /mmo/leaderboard ----
  if (path === "/mmo/leaderboard" && req.method === "GET") {
    const limit = parseInt(url.searchParams.get("limit") ?? "50");
    sendJSON(res, 200, { ok: true, leaderboard: getLeaderboard(limit) });
    return;
  }

  // ---- GET /mmo/skill.md ----
  if (path === "/mmo/skill.md" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/markdown" });
    res.end(SKILL_MD);
    return;
  }

  // ---- GET /mmo/combat/log ----
  if (path === "/mmo/combat/log" && req.method === "GET") {
    const token = extractBearer(req);
    if (!token || !getPlayerByToken(token)) {
      sendJSON(res, 401, { ok: false, error: "Unauthorized" });
      return;
    }
    sendJSON(res, 200, { ok: true, log: combatLog.slice(-100) });
    return;
  }

  // ---- POST /mmo/player/register ----
  if (path === "/mmo/player/register" && req.method === "POST") {
    const body = await readBody(req);
    const { fid, username, displayName, pfpUrl, jobId } = body as Record<string, string | undefined>;
    if (!fid || !username) {
      sendJSON(res, 400, { ok: false, error: "fid and username required" });
      return;
    }
    const player = registerPlayer(
      Number(fid),
      username,
      displayName ?? username,
      pfpUrl ?? "",
      jobId ?? "novice",
    );
    // Deterministic token — survives server restarts since it's derived from stable player.id
    // player.id is stable for a given FID (registerPlayer is idempotent by FID)
    const token = `player_${player.id}`;
    humanTokens.set(token, player.id);
    sendJSON(res, 200, { ok: true, playerId: player.id, token });
    return;
  }

  // ---- POST /mmo/agent/register ----
  if (path === "/mmo/agent/register" && req.method === "POST") {
    const body = await readBody(req);
    const reg = registerAgent(body.jobId ?? "archer");
    sendJSON(res, 200, { ok: true, ...reg });
    return;
  }

  // ---- GET /mmo/state ----
  if (path === "/mmo/state" && req.method === "GET") {
    const token = extractBearer(req);
    if (!token) { sendJSON(res, 401, { ok: false, error: "Unauthorized" }); return; }
    const player = getPlayerByToken(token);
    if (!player) { sendJSON(res, 401, { ok: false, error: "Invalid token" }); return; }
    const state = getWorldState(player.id);
    sendJSON(res, 200, { ok: true, state });
    return;
  }

  // ---- GET /mmo/world/nearby ----
  if (path === "/mmo/world/nearby" && req.method === "GET") {
    const token = extractBearer(req);
    if (!token) { sendJSON(res, 401, { ok: false, error: "Unauthorized" }); return; }
    const player = getPlayerByToken(token);
    if (!player) { sendJSON(res, 401, { ok: false, error: "Invalid token" }); return; }
    const radius = parseInt(url.searchParams.get("radius") ?? "15");
    const nearby = getNearby(player.position, radius);
    sendJSON(res, 200, { ok: true, ...nearby });
    return;
  }

  // ---- POST /mmo/action/move ----
  if (path === "/mmo/action/move" && req.method === "POST") {
    const result = await agentAction(req, async (player, body) => {
      const input: InputEvent = { action: `move_${body.direction}` as InputEvent["action"] };
      queueInput(player.id, input);
      return { ok: true };
    });
    sendJSON(res, result.status, result.body);
    return;
  }

  // ---- POST /mmo/action/attack ----
  if (path === "/mmo/action/attack" && req.method === "POST") {
    const result = await agentAction(req, async (player, body) => {
      return executeAgentAction(player.agentToken ?? "", { type: "attack", targetId: body.targetId });
    });
    sendJSON(res, result.status, result.body);
    return;
  }

  // ---- POST /mmo/action/skill ----
  if (path === "/mmo/action/skill" && req.method === "POST") {
    const result = await agentAction(req, async (player, body) => {
      return executeAgentAction(player.agentToken ?? "", {
        type: "skill",
        skillId: body.skillId,
        targetId: body.targetId,
      });
    });
    sendJSON(res, result.status, result.body);
    return;
  }

  // ---- POST /mmo/action/join-party ----
  if (path === "/mmo/action/join-party" && req.method === "POST") {
    const result = await agentAction(req, async (player, body) => {
      return executeAgentAction(player.agentToken ?? "", {
        type: "join_party",
        partyId: body.partyId,
      });
    });
    sendJSON(res, result.status, result.body);
    return;
  }

  sendJSON(res, 404, { ok: false, error: "Not found" });
}

// ----------------------------------------------------------
// WebSocket Server
// ----------------------------------------------------------

const wss = new WebSocketServer({ server, path: "/mmo/ws" });

wss.on("connection", (ws: WebSocket, req: http.IncomingMessage) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const playerId = url.searchParams.get("playerId") ?? "";
  const token = url.searchParams.get("token") ?? "";

  console.log(`[WS] Client connecting: ${playerId}`);

  let authenticated = false;

  const send = (msg: WSMessage) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  };

  // Auth timeout — disconnect if no auth_ok within 5s
  const authTimeout = setTimeout(() => {
    if (!authenticated) {
      send({ type: "error", payload: { message: "Auth timeout" }, timestamp: Date.now() });
      ws.close();
    }
  }, 5000);

  ws.on("message", (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString()) as WSMessage;

      if (msg.type === "auth") {
        const payload = msg.payload as { playerId: string; token: string };

        // Check agent token (for AI agents)
        const agentPlayer = getPlayerByToken(payload.token);
        // Check human token — deterministic format: "player_<playerId>"
        // Also re-hydrate the map on first use after a restart
        let humanPlayerId = humanTokens.get(payload.token);
        if (!humanPlayerId && payload.token.startsWith("player_")) {
          // Token format is player_<playerId> — extract and verify player exists
          const derivedId = payload.token.slice("player_".length);
          // Re-register player from token (they already exist in players map)
          const allPlayers = getAllPlayers();
          const existing = allPlayers.find(p => p.id === derivedId);
          if (existing) {
            humanTokens.set(payload.token, derivedId);
            humanPlayerId = derivedId;
          }
        }
        const resolvedPlayerId = agentPlayer?.id ?? humanPlayerId ?? null;

        if (resolvedPlayerId) {
          authenticated = true;
          clearTimeout(authTimeout);
          connectPlayer(resolvedPlayerId, send);
          console.log(`[WS] Authenticated: ${resolvedPlayerId}`);
        } else {
          send({ type: "error", payload: { message: "Invalid token — please re-register" }, timestamp: Date.now() });
          ws.close();
        }
        return;
      }

      if (!authenticated) return;

      switch (msg.type) {
        case "ping":
          send({ type: "pong", payload: null, timestamp: Date.now() });
          break;

        case "entity_move":
        case "entity_attack":
        case "entity_skill": {
          const input = msg.payload as InputEvent;
          queueInput(playerId, input);
          break;
        }

        case "chat_message": {
          // Broadcast to all connected clients (simple echo for now)
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: "chat_message",
                payload: msg.payload,
                timestamp: Date.now(),
              }));
            }
          });
          break;
        }
      }
    } catch {
      // ignore malformed
    }
  });

  ws.on("close", () => {
    clearTimeout(authTimeout);
    disconnectPlayer(playerId);
    console.log(`[WS] Disconnected: ${playerId}`);
  });

  ws.on("error", (err) => {
    console.error(`[WS] Error for ${playerId}:`, err.message);
    ws.close();
  });
});

// ----------------------------------------------------------
// Start listening
// ----------------------------------------------------------

server.listen(PORT, () => {
  console.log(`[ChainQuest] Server listening on port ${PORT}`);
  console.log(`[ChainQuest] WebSocket: ws://localhost:${PORT}/mmo/ws`);
  console.log(`[ChainQuest] Health: http://localhost:${PORT}/health`);
});

// ----------------------------------------------------------
// Graceful shutdown
// ----------------------------------------------------------

process.on("SIGTERM", () => {
  console.log("[ChainQuest] SIGTERM received — shutting down");
  server.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  console.log("[ChainQuest] SIGINT received — shutting down");
  server.close(() => process.exit(0));
});

// ----------------------------------------------------------
// Helpers
// ----------------------------------------------------------

function sendJSON(res: http.ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(json);
}

function extractBearer(req: http.IncomingMessage): string | null {
  const auth = req.headers.authorization ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

async function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => { data += chunk.toString(); });
    req.on("end", () => {
      try { resolve(JSON.parse(data || "{}")); }
      catch { resolve({}); }
    });
    req.on("error", reject);
  });
}

async function agentAction(
  req: http.IncomingMessage,
  handler: (player: ReturnType<typeof getPlayerByToken> & object, body: Record<string, unknown>) => Promise<unknown>,
): Promise<{ status: number; body: unknown }> {
  const token = extractBearer(req);
  if (!token) return { status: 401, body: { ok: false, error: "Unauthorized" } };
  const player = getPlayerByToken(token);
  if (!player) return { status: 401, body: { ok: false, error: "Invalid token" } };
  const body = await readBody(req);
  const result = await handler(player, body);
  return { status: 200, body: result };
}

// ----------------------------------------------------------
// Skill rulebook (served at GET /mmo/skill.md)
// ----------------------------------------------------------

const SKILL_MD = `# ChainQuest AI Agent Skill Rulebook

## Overview
You are an autonomous agent in ChainQuest MMO. Use the REST API to play.

## Authentication
All action endpoints require: \`Authorization: Bearer <your_token>\`

## Decision Loop
1. GET /mmo/state — observe world
2. Choose action based on rules below
3. POST /mmo/action/* — execute
4. Repeat every 200ms+

## Combat Rules
- Attack monsters within range 1 (melee) or 3 (ranged)
- Use skills when SP > 30% of max
- Retreat when HP < 20% of max
- Heal (if Mage) when HP < 50%

## Skill Priority by Job
### Swordsman / Knight
1. bowling_bash (AoE, use vs groups)
2. bash (single target, high damage)
3. provoke (pull aggro from party members)

### Mage / Wizard
1. storm_gust (AoE freeze, use vs 3+ monsters)
2. meteor_storm (AoE fire, boss fights)
3. frost_diver (single freeze)
4. fire_bolt (single fire)

### Archer / Hunter
1. falcon_assault (highest single damage)
2. double_strafe (fast, low SP)
3. arrow_shower (AoE)
4. blitz_beat (beast summon)

## Movement
- Move toward nearest monster when idle
- Roam randomly when no monsters nearby
- Stay within safe zone (prontera) until level 5

## Party Play
- Join parties when invited (POST /mmo/action/join-party)
- Tank classes (Knight) should use provoke
- Support classes (Wizard) should prioritize AoE

## Status Effects
- freeze: target cannot move for 3s
- burn: 50 damage/tick for 5s
- blessed: +20% ATK/MATK for 30s
- haste: +30% movement for 15s
`;
