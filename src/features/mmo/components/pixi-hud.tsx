"use client";
// ============================================================
// ChainQuest MMO - PixiJS HUD Overlay
// Renders: HP/SP/EXP bars, damage numbers, skill wheel,
//          cast bar, status effects, floating combat text
// RULE: PixiJS handles ALL UI. Phaser handles world only.
// ============================================================

import { useEffect, useRef, useCallback } from "react";
import type { GameClientState, PlayerEntity, DamageNumber, SkillId } from "../types";
import { SKILL_DEFINITIONS, DAMAGE_COLORS, STATUS_COLORS } from "../constants";

interface PixiHUDProps {
  gameState: GameClientState;
  currentPlayer?: PlayerEntity;
  selectedTarget?: { id: string; type: "player" | "monster"; hp: number; maxHp: number; name: string } | null;
  onSkillActivate: (skillIndex: number) => void;
}

export function PixiHUD({ gameState, currentPlayer, selectedTarget, onSkillActivate }: PixiHUDProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<import("pixi.js").Application | null>(null);
  const dmgContainerRef = useRef<import("pixi.js").Container | null>(null);
  const hudContainerRef = useRef<import("pixi.js").Container | null>(null);
  const skillWheelRef = useRef<import("pixi.js").Container | null>(null);
  const castBarRef = useRef<import("pixi.js").Container | null>(null);
  const animFrameRef = useRef<number>(0);
  const onSkillRef = useRef(onSkillActivate);
  onSkillRef.current = onSkillActivate;

  // ----------------------------------------------------------
  // Initialize PixiJS Application
  // ----------------------------------------------------------

  useEffect(() => {
    if (!canvasRef.current || appRef.current) return;
    let app: import("pixi.js").Application;

    const initPixi = async () => {
      const PIXI = await import("pixi.js");

      app = new PIXI.Application();
      const canvas = canvasRef.current!;

      await app.init({
        canvas,
        width: canvas.parentElement?.clientWidth ?? 424,
        height: canvas.parentElement?.clientHeight ?? 500,
        backgroundAlpha: 0, // Transparent — overlays on Phaser
        antialias: true,
        resolution: window.devicePixelRatio ?? 1,
        autoDensity: true,
      });

      appRef.current = app;

      // Containers (layered)
      const hudContainer = new PIXI.Container();
      const dmgContainer = new PIXI.Container();
      const skillContainer = new PIXI.Container();
      const castContainer = new PIXI.Container();

      hudContainerRef.current = hudContainer;
      dmgContainerRef.current = dmgContainer;
      skillWheelRef.current = skillContainer;
      castBarRef.current = castContainer;

      app.stage.addChild(hudContainer);
      app.stage.addChild(dmgContainer);
      app.stage.addChild(skillContainer);
      app.stage.addChild(castContainer);

      // Resize handler
      const resizeObserver = new ResizeObserver(() => {
        if (!canvas.parentElement) return;
        app.renderer.resize(
          canvas.parentElement.clientWidth,
          canvas.parentElement.clientHeight,
        );
        renderHUD(PIXI);
      });
      if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);

      renderHUD(PIXI);

      return () => resizeObserver.disconnect();
    };

    initPixi();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      appRef.current?.destroy(false);
      appRef.current = null;
    };
  }, []);

  // ----------------------------------------------------------
  // Re-render HUD when state changes
  // ----------------------------------------------------------

  useEffect(() => {
    if (!appRef.current) return;
    import("pixi.js").then(PIXI => renderHUD(PIXI));
  }, [currentPlayer, selectedTarget]);

  // ----------------------------------------------------------
  // Damage Numbers (animated)
  // ----------------------------------------------------------

  useEffect(() => {
    if (!dmgContainerRef.current || !appRef.current) return;

    import("pixi.js").then(PIXI => {
      const container = dmgContainerRef.current!;
      container.removeChildren();

      for (const dmg of gameState.damageNumbers) {
        spawnDamageNumber(PIXI, container, dmg);
      }
    });
  }, [gameState.damageNumbers]);

  // ----------------------------------------------------------
  // Render Functions
  // ----------------------------------------------------------

  async function renderHUD(PIXI: typeof import("pixi.js")) {
    const container = hudContainerRef.current;
    if (!container || !appRef.current) return;

    container.removeChildren();

    const W = appRef.current.renderer.width;
    const H = appRef.current.renderer.height;

    // ---- HP/SP/EXP Bars (bottom left) ----
    if (currentPlayer) {
      const barW = Math.min(180, W * 0.42);
      const barH = 10;
      const barX = 8;
      const barY = H - 90;

      // HP Bar
      drawBar(PIXI, container, barX, barY, barW, barH, "HP", currentPlayer.derived.hp, currentPlayer.derived.maxHp, 0xff2222, 0x660000);
      // SP Bar
      drawBar(PIXI, container, barX, barY + 16, barW, barH, "SP", currentPlayer.derived.sp, currentPlayer.derived.maxSp, 0x2244ff, 0x001166);
      // EXP Bar
      const expToNext = 500 + currentPlayer.baseLevel * 200;
      drawBar(PIXI, container, barX, barY + 32, barW, barH, "EXP", currentPlayer.baseExp % expToNext, expToNext, 0xf59e0b, 0x4a3000);

      // Level + Job badge
      const levelBg = new PIXI.Graphics();
      levelBg.roundRect(barX, barY - 28, 110, 22, 4);
      levelBg.fill({ color: 0x000000, alpha: 0.7 });
      container.addChild(levelBg);

      const levelText = new PIXI.Text({
        text: `Lv.${currentPlayer.baseLevel} ${currentPlayer.jobId.replace("_", " ").toUpperCase()}`,
        style: new PIXI.TextStyle({
          fontFamily: "monospace",
          fontSize: 10,
          fill: 0xffd700,
          fontWeight: "bold",
        }),
      });
      levelText.x = barX + 4;
      levelText.y = barY - 24;
      container.addChild(levelText);

      // Status effects
      renderStatusEffects(PIXI, container, barX, barY + 50);
    }

    // ---- Target HP Bar (top center) ----
    if (selectedTarget) {
      const barW = Math.min(200, W * 0.48);
      const barX = (W - barW) / 2;

      const bg = new PIXI.Graphics();
      bg.roundRect(barX - 4, 8, barW + 8, 36, 6);
      bg.fill({ color: 0x000000, alpha: 0.8 });
      container.addChild(bg);

      const nameText = new PIXI.Text({
        text: selectedTarget.name,
        style: new PIXI.TextStyle({ fontFamily: "monospace", fontSize: 11, fill: 0xff8888, fontWeight: "bold" }),
      });
      nameText.x = barX;
      nameText.y = 10;
      container.addChild(nameText);

      drawBar(PIXI, container, barX, 24, barW, 10, "", selectedTarget.hp, selectedTarget.maxHp, 0xff2222, 0x440000);
    }

    // ---- Network Status (top right) ----
    const pingText = new PIXI.Text({
      text: gameState.connected
        ? `●  ${gameState.latency}ms | Tick ${gameState.tick}`
        : "● OFFLINE",
      style: new PIXI.TextStyle({
        fontFamily: "monospace",
        fontSize: 9,
        fill: gameState.connected ? 0x44ff44 : 0xff4444,
      }),
    });
    pingText.x = W - pingText.width - 8;
    pingText.y = 8;
    container.addChild(pingText);

    // ---- Skill Wheel (bottom right) ----
    if (currentPlayer) {
      renderSkillWheel(PIXI, container, currentPlayer, W, H);
    }
  }

  function drawBar(
    PIXI: typeof import("pixi.js"),
    container: import("pixi.js").Container,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    current: number,
    max: number,
    fillColor: number,
    bgColor: number,
  ) {
    if (max <= 0) return;
    const pct = Math.max(0, Math.min(1, current / max));

    const bg = new PIXI.Graphics();
    bg.roundRect(x, y, w, h, 3);
    bg.fill({ color: bgColor, alpha: 1 });
    container.addChild(bg);

    if (pct > 0) {
      const fill = new PIXI.Graphics();
      fill.roundRect(x, y, Math.max(2, w * pct), h, 3);
      fill.fill({ color: fillColor, alpha: 1 });
      container.addChild(fill);
    }

    // Border
    const border = new PIXI.Graphics();
    border.roundRect(x, y, w, h, 3);
    border.stroke({ color: 0x000000, width: 1, alpha: 0.6 });
    container.addChild(border);

    // Label
    if (label) {
      const text = new PIXI.Text({
        text: `${label} ${current}/${max}`,
        style: new PIXI.TextStyle({
          fontFamily: "monospace",
          fontSize: 8,
          fill: 0xffffff,
          dropShadow: { distance: 1, blur: 0, color: 0x000000, alpha: 1 },
        }),
      });
      text.x = x + 2;
      text.y = y + 1;
      container.addChild(text);
    }
  }

  function renderSkillWheel(
    PIXI: typeof import("pixi.js"),
    container: import("pixi.js").Container,
    player: PlayerEntity,
    W: number,
    H: number,
  ) {
    const skills = player.skills.slice(0, 4);
    const btnSize = 44;
    const gap = 4;
    const startX = W - (btnSize + gap) * 2 - 8;
    const startY = H - (btnSize + gap) * 2 - 8;

    skills.forEach((skillId, i) => {
      const skill = SKILL_DEFINITIONS[skillId];
      if (!skill) return;

      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = startX + col * (btnSize + gap);
      const y = startY + row * (btnSize + gap);

      // Button background
      const btn = new PIXI.Graphics();
      btn.roundRect(x, y, btnSize, btnSize, 6);
      btn.fill({ color: 0x1a1a3a, alpha: 0.85 });
      btn.stroke({ color: 0x4444aa, width: 1.5 });
      btn.eventMode = "static";
      btn.cursor = "pointer";
      btn.on("pointerdown", () => onSkillRef.current(i));
      container.addChild(btn);

      // Skill icon (emoji as text)
      const iconText = new PIXI.Text({
        text: skill.icon,
        style: new PIXI.TextStyle({ fontFamily: "sans-serif", fontSize: 20 }),
      });
      iconText.x = x + btnSize / 2 - iconText.width / 2;
      iconText.y = y + 4;
      iconText.eventMode = "none";
      container.addChild(iconText);

      // Hotkey label
      const hotkeyText = new PIXI.Text({
        text: `[${i + 1}]`,
        style: new PIXI.TextStyle({ fontFamily: "monospace", fontSize: 8, fill: 0xaaaaaa }),
      });
      hotkeyText.x = x + 2;
      hotkeyText.y = y + 2;
      container.addChild(hotkeyText);

      // SP cost
      const spText = new PIXI.Text({
        text: skill.spCost > 0 ? `${skill.spCost}sp` : "",
        style: new PIXI.TextStyle({ fontFamily: "monospace", fontSize: 8, fill: 0x4488ff }),
      });
      spText.x = x + btnSize / 2 - spText.width / 2;
      spText.y = y + btnSize - 12;
      container.addChild(spText);
    });
  }

  function renderStatusEffects(
    PIXI: typeof import("pixi.js"),
    container: import("pixi.js").Container,
    x: number,
    y: number,
  ) {
    if (!currentPlayer) return;
    currentPlayer.statusEffects.forEach((effect, i) => {
      const iconBg = new PIXI.Graphics();
      iconBg.roundRect(x + i * 22, y, 20, 20, 3);
      iconBg.fill({ color: STATUS_COLORS[effect.effect] ?? 0x888888, alpha: 0.8 });
      container.addChild(iconBg);

      const statusIcons: Record<string, string> = {
        burn: "🔥", freeze: "❄️", stun: "⭐", poison: "☠️", slow: "🐢", blessed: "✨", haste: "💨",
      };
      const icon = new PIXI.Text({
        text: statusIcons[effect.effect] ?? "?",
        style: new PIXI.TextStyle({ fontFamily: "sans-serif", fontSize: 12 }),
      });
      icon.x = x + i * 22 + 3;
      icon.y = y + 2;
      container.addChild(icon);
    });
  }

  function spawnDamageNumber(
    PIXI: typeof import("pixi.js"),
    container: import("pixi.js").Container,
    dmg: DamageNumber,
  ) {
    const app = appRef.current;
    if (!app) return;

    const W = app.renderer.width;
    const H = app.renderer.height;

    // Spread damage numbers across the play area
    const x = W * 0.2 + Math.random() * W * 0.6;
    const y = H * 0.3 + Math.random() * H * 0.3;

    const isCrit = dmg.type === "crit";
    const isHeal = dmg.type === "heal";
    const isMiss = dmg.type === "miss";

    const text = new PIXI.Text({
      text: isMiss ? "MISS" : isHeal ? `+${dmg.value}` : dmg.value.toString(),
      style: new PIXI.TextStyle({
        fontFamily: "monospace",
        fontSize: isCrit ? 20 : 14,
        fontWeight: isCrit ? "bold" : "normal",
        fill: DAMAGE_COLORS[dmg.type as keyof typeof DAMAGE_COLORS] ?? 0xffffff,
        stroke: { color: 0x000000, width: 2 },
      }),
    });
    text.x = x;
    text.y = y;
    text.anchor.set(0.5);

    container.addChild(text);

    // Animate: float up and fade
    const startY = y;
    const startTime = Date.now();
    const duration = 1200;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      if (progress >= 1) {
        text.destroy();
        return;
      }

      text.y = startY - progress * 40;
      text.alpha = 1 - progress;
      if (isCrit) text.scale.set(1 + progress * 0.3);

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 10 }}
    />
  );
}
