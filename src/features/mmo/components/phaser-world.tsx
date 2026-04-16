"use client";
// ============================================================
// ChainQuest MMO - Phaser 4 World Engine
// Handles: tilemap, player sprites, monster sprites, camera,
//          movement interpolation, combat animations
// PixiJS handles: HUD overlay (separate layer)
// ============================================================

import { useEffect, useRef, useCallback } from "react";
import type { GameClientState, PlayerEntity, MonsterEntity, EntityId } from "../types";
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT } from "../constants";

interface PhaserWorldProps {
  gameState: GameClientState;
  currentPlayerId?: string;
  onEntityClick: (id: EntityId, type: "player" | "monster") => void;
}

// Tile colors per type (Phaser will render via graphics when no tileset)
const TILE_COLORS: Record<string, number> = {
  grass: 0x2d5a27,
  stone: 0x4a4a5a,
  dungeon: 0x1a1a2e,
  lava: 0x8b1a1a,
  town: 0x5a4a3a,
  water: 0x1a3a5a,
};

const JOB_COLORS: Record<string, number> = {
  novice: 0x94a3b8,
  swordsman: 0xef4444,
  knight: 0xf97316,
  lord_knight: 0xf59e0b,
  mage: 0x8b5cf6,
  wizard: 0x6366f1,
  high_wizard: 0xa78bfa,
  archer: 0x10b981,
  hunter: 0x34d399,
  sniper: 0x059669,
};

const MONSTER_COLORS: Record<string, number> = {
  poring: 0xcc44cc,
  zombie: 0x44aa44,
  skeleton: 0xeeeeee,
  orc: 0x886622,
  drake: 0xff2200,
};

export function PhaserWorld({ gameState, currentPlayerId, onEntityClick }: PhaserWorldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<import("phaser").Game | null>(null);
  const sceneRef = useRef<import("phaser").Scene | null>(null);
  const spriteMapRef = useRef<Map<EntityId, import("phaser").GameObjects.Container>>(new Map());
  const tileGraphicsRef = useRef<import("phaser").GameObjects.Graphics | null>(null);
  const onEntityClickRef = useRef(onEntityClick);
  onEntityClickRef.current = onEntityClick;

  // ----------------------------------------------------------
  // Initialize Phaser
  // ----------------------------------------------------------

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    let game: import("phaser").Game;

    const initPhaser = async () => {
      const Phaser = (await import("phaser")).default;

      class WorldScene extends Phaser.Scene {
        constructor() {
          super({ key: "WorldScene" });
        }

        preload() {
          // We use procedural graphics (no external assets needed)
        }

        create() {
          sceneRef.current = this;

          // World bounds
          this.physics.world.setBounds(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);

          // Camera
          this.cameras.main.setBounds(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
          this.cameras.main.setZoom(1.5);

          // Tile graphics
          const gfx = this.add.graphics();
          tileGraphicsRef.current = gfx;
          drawTileMap(this, gfx);

          // Grid overlay (subtle)
          const gridGfx = this.add.graphics();
          gridGfx.lineStyle(0.5, 0x000000, 0.1);
          for (let x = 0; x <= MAP_WIDTH; x++) {
            gridGfx.moveTo(x * TILE_SIZE, 0);
            gridGfx.lineTo(x * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
          }
          for (let y = 0; y <= MAP_HEIGHT; y++) {
            gridGfx.moveTo(0, y * TILE_SIZE);
            gridGfx.lineTo(MAP_WIDTH * TILE_SIZE, y * TILE_SIZE);
          }
          gridGfx.strokePath();
        }

        update() {
          // Entity interpolation happens via React state sync
        }
      }

      const width = containerRef.current!.clientWidth || 424;
      const height = containerRef.current!.clientHeight || 400;

      game = new Phaser.Game({
        type: Phaser.AUTO,
        width,
        height,
        parent: containerRef.current!,
        backgroundColor: "#0a0a1a",
        physics: {
          default: "arcade",
          arcade: { debug: false },
        },
        scene: [WorldScene],
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        render: {
          antialias: false,
          pixelArt: true,
        },
      });

      gameRef.current = game;
    };

    initPhaser();

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
      spriteMapRef.current.clear();
    };
  }, []);

  // ----------------------------------------------------------
  // Sync entities from React state → Phaser scene
  // ----------------------------------------------------------

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const updatedIds = new Set<EntityId>();

    // Update players
    for (const [id, player] of gameState.players) {
      updatedIds.add(id);
      syncEntitySprite(scene, id, player, "player");
    }

    // Update monsters
    for (const [id, monster] of gameState.monsters) {
      updatedIds.add(id);
      syncMonsterSprite(scene, id, monster);
    }

    // Remove despawned entities
    for (const [id, container] of spriteMapRef.current) {
      if (!updatedIds.has(id)) {
        container.destroy();
        spriteMapRef.current.delete(id);
      }
    }

    // Camera follow current player
    if (currentPlayerId) {
      const playerContainer = spriteMapRef.current.get(currentPlayerId);
      if (playerContainer) {
        scene.cameras.main.startFollow(playerContainer, true, 0.1, 0.1);
      }
    }
  }, [gameState, currentPlayerId]);

  // ----------------------------------------------------------
  // Sprite management
  // ----------------------------------------------------------

  function syncEntitySprite(
    scene: import("phaser").Scene,
    id: EntityId,
    player: PlayerEntity,
    type: "player",
  ) {
    const worldX = player.position.x * TILE_SIZE + TILE_SIZE / 2;
    const worldY = player.position.y * TILE_SIZE + TILE_SIZE / 2;

    let container = spriteMapRef.current.get(id);

    if (!container) {
      // Create new sprite container
      // @ts-ignore - Phaser types
      container = scene.add.container(worldX, worldY);
      // @ts-ignore
      const gfx = scene.add.graphics();

      const color = JOB_COLORS[player.jobId] ?? 0x94a3b8;
      const isCurrentPlayer = id === currentPlayerId;

      // Body
      gfx.fillStyle(color, 1);
      gfx.fillRect(-8, -12, 16, 20);
      // Head
      gfx.fillStyle(isCurrentPlayer ? 0xffffff : color, 1);
      gfx.fillCircle(0, -18, 8);
      // Outline
      gfx.lineStyle(isCurrentPlayer ? 2 : 1, 0x000000, 1);
      gfx.strokeRect(-8, -12, 16, 20);
      gfx.strokeCircle(0, -18, 8);

      // Name label
      // @ts-ignore
      const nameText = scene.add.text(0, 12, player.username, {
        fontFamily: "monospace",
        fontSize: "8px",
        color: isCurrentPlayer ? "#ffd700" : "#ffffff",
        stroke: "#000000",
        strokeThickness: 2,
        align: "center",
      }).setOrigin(0.5, 0);

      // HP bar background
      // @ts-ignore
      const hpBg = scene.add.graphics();
      hpBg.fillStyle(0x330000, 1);
      hpBg.fillRect(-10, 8, 20, 3);

      // HP bar fill
      // @ts-ignore
      const hpFill = scene.add.graphics();
      const hpPct = player.derived.maxHp > 0 ? player.derived.hp / player.derived.maxHp : 1;
      hpFill.fillStyle(0x44ff44, 1);
      hpFill.fillRect(-10, 8, Math.ceil(20 * hpPct), 3);
      hpFill.setName("hpFill");

      container.add([gfx, nameText, hpBg, hpFill]);

      // Click target
      // @ts-ignore
      const hitArea = scene.add.rectangle(0, -8, 20, 40, 0xffffff, 0);
      hitArea.setInteractive({ useHandCursor: true });
      hitArea.on("pointerdown", () => onEntityClickRef.current(id, "player"));
      container.add(hitArea);

      spriteMapRef.current.set(id, container);
    }

    // Smooth position interpolation
    // @ts-ignore
    scene.tweens.add({
      targets: container,
      x: worldX,
      y: worldY,
      duration: 80,
      ease: "Linear",
    });

    // Update HP bar
    const hpFill = container.getByName("hpFill") as import("phaser").GameObjects.Graphics | undefined;
    if (hpFill && player.derived.maxHp > 0) {
      hpFill.clear();
      const pct = player.derived.hp / player.derived.maxHp;
      const barColor = pct > 0.5 ? 0x44ff44 : pct > 0.25 ? 0xffaa00 : 0xff2200;
      hpFill.fillStyle(barColor, 1);
      hpFill.fillRect(-10, 8, Math.ceil(20 * pct), 3);
    }

    // Death fade
    container.setAlpha(player.isDead ? 0.3 : 1);
  }

  function syncMonsterSprite(
    scene: import("phaser").Scene,
    id: EntityId,
    monster: MonsterEntity,
  ) {
    const worldX = monster.position.x * TILE_SIZE + TILE_SIZE / 2;
    const worldY = monster.position.y * TILE_SIZE + TILE_SIZE / 2;

    let container = spriteMapRef.current.get(id);

    if (!container) {
      // @ts-ignore
      container = scene.add.container(worldX, worldY);
      // @ts-ignore
      const gfx = scene.add.graphics();

      const color = MONSTER_COLORS[monster.definitionId] ?? 0xff4444;

      // Monster body (different shapes per type)
      gfx.fillStyle(color, 1);
      if (monster.definitionId === "poring") {
        gfx.fillCircle(0, 0, 10);
        gfx.lineStyle(1, 0x000000, 1);
        gfx.strokeCircle(0, 0, 10);
      } else {
        gfx.fillRect(-8, -10, 16, 18);
        gfx.lineStyle(1, 0x000000, 1);
        gfx.strokeRect(-8, -10, 16, 18);
      }

      // Monster name
      // @ts-ignore
      const nameText = scene.add.text(0, 12, monster.definitionId, {
        fontFamily: "monospace",
        fontSize: "7px",
        color: "#ff8888",
        stroke: "#000000",
        strokeThickness: 2,
        align: "center",
      }).setOrigin(0.5, 0);

      // HP bar
      // @ts-ignore
      const hpBg = scene.add.graphics();
      hpBg.fillStyle(0x330000, 1);
      hpBg.fillRect(-10, 8, 20, 3);

      // @ts-ignore
      const hpFill = scene.add.graphics();
      const pct = monster.maxHp > 0 ? monster.hp / monster.maxHp : 1;
      hpFill.fillStyle(0xff2200, 1);
      hpFill.fillRect(-10, 8, Math.ceil(20 * pct), 3);
      hpFill.setName("hpFill");

      container.add([gfx, nameText, hpBg, hpFill]);

      // Click to target
      // @ts-ignore
      const hitArea = scene.add.rectangle(0, -5, 20, 30, 0xffffff, 0);
      hitArea.setInteractive({ useHandCursor: true });
      hitArea.on("pointerdown", () => onEntityClickRef.current(id, "monster"));
      container.add(hitArea);

      spriteMapRef.current.set(id, container);
    }

    // Interpolate position
    // @ts-ignore
    scene.tweens.add({
      targets: container,
      x: worldX,
      y: worldY,
      duration: 80,
      ease: "Linear",
    });

    // Update HP bar
    const hpFill = container.getByName("hpFill") as import("phaser").GameObjects.Graphics | undefined;
    if (hpFill && monster.maxHp > 0) {
      hpFill.clear();
      const pct = monster.hp / monster.maxHp;
      hpFill.fillStyle(0xff2200, 1);
      hpFill.fillRect(-10, 8, Math.ceil(20 * pct), 3);
    }

    // Death fade + combat flash
    container.setAlpha(monster.isDead ? 0.2 : 1);
    if (monster.state === "attacking") {
      container.setAlpha(0.8);
    }
  }

  // ----------------------------------------------------------
  // Tile map rendering
  // ----------------------------------------------------------

  function drawTileMap(scene: import("phaser").Scene, gfx: import("phaser").GameObjects.Graphics) {
    // Simple procedural map based on position patterns
    // In production: load from server tilemap data
    const patterns = [
      // Town center (prontera)
      { x: 5, y: 5, w: 54, h: 54, color: TILE_COLORS["town"] },
      // Paths
      { x: 0, y: 28, w: 64, h: 8, color: TILE_COLORS["stone"] },
      { x: 28, y: 0, w: 8, h: 64, color: TILE_COLORS["stone"] },
    ];

    // Base grass
    gfx.fillStyle(TILE_COLORS["grass"]!, 1);
    gfx.fillRect(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);

    // Town area
    gfx.fillStyle(TILE_COLORS["town"]!, 1);
    gfx.fillRect(5 * TILE_SIZE, 5 * TILE_SIZE, 54 * TILE_SIZE, 54 * TILE_SIZE);

    // Stone paths
    gfx.fillStyle(TILE_COLORS["stone"]!, 1);
    gfx.fillRect(0, 28 * TILE_SIZE, MAP_WIDTH * TILE_SIZE, 8 * TILE_SIZE);
    gfx.fillRect(28 * TILE_SIZE, 0, 8 * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);

    // Water features
    gfx.fillStyle(TILE_COLORS["water"]!, 1);
    gfx.fillCircle(15 * TILE_SIZE, 15 * TILE_SIZE, 5 * TILE_SIZE);
    gfx.fillCircle(50 * TILE_SIZE, 50 * TILE_SIZE, 4 * TILE_SIZE);

    // Dungeon entrance (dark)
    gfx.fillStyle(TILE_COLORS["dungeon"]!, 1);
    gfx.fillRect(30 * TILE_SIZE, 58 * TILE_SIZE, 4 * TILE_SIZE, 4 * TILE_SIZE);

    // Some decorative trees (dark green)
    gfx.fillStyle(0x1a4a1a, 1);
    const treePositions = [[8, 8], [12, 45], [50, 10], [55, 55], [22, 30], [40, 48]];
    for (const [tx, ty] of treePositions) {
      gfx.fillTriangle(
        tx * TILE_SIZE + TILE_SIZE / 2, ty * TILE_SIZE,
        tx * TILE_SIZE, (ty + 1) * TILE_SIZE,
        (tx + 1) * TILE_SIZE, (ty + 1) * TILE_SIZE,
      );
    }

    // Map border
    gfx.lineStyle(2, 0xff4400, 1);
    gfx.strokeRect(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden"
      style={{ background: "#0a0a1a" }}
    />
  );
}
