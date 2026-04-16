"use client";
// ============================================================
// Virtual Joystick — mobile touch movement control
// Used for player directional movement input
// ============================================================

import { useRef, useCallback } from "react";

interface VirtualJoystickProps {
  onMove: (dx: number, dy: number) => void;
  onRelease: () => void;
  size?: number;
}

export function VirtualJoystick({ onMove, onRelease, size = 80 }: VirtualJoystickProps) {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const centerRef = useRef({ x: 0, y: 0 });

  const maxRadius = size * 0.32;

  const handleStart = useCallback((clientX: number, clientY: number) => {
    isDraggingRef.current = true;
    const rect = baseRef.current?.getBoundingClientRect();
    if (rect) {
      centerRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
  }, []);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!isDraggingRef.current || !knobRef.current) return;

    const dx = clientX - centerRef.current.x;
    const dy = clientY - centerRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clamped = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);

    const knobX = Math.cos(angle) * clamped;
    const knobY = Math.sin(angle) * clamped;

    knobRef.current.style.transform = `translate(${knobX}px, ${knobY}px)`;

    // Normalize to -1..1
    onMove(dx / maxRadius, dy / maxRadius);
  }, [maxRadius, onMove]);

  const handleEnd = useCallback(() => {
    isDraggingRef.current = false;
    if (knobRef.current) {
      knobRef.current.style.transform = "translate(0px, 0px)";
    }
    onRelease();
  }, [onRelease]);

  return (
    <div
      ref={baseRef}
      className="relative rounded-full select-none touch-none"
      style={{
        width: size,
        height: size,
        background: "rgba(0,0,0,0.4)",
        border: "2px solid rgba(255,255,255,0.2)",
      }}
      onTouchStart={e => { e.preventDefault(); const t = e.touches[0]; handleStart(t.clientX, t.clientY); }}
      onTouchMove={e => { e.preventDefault(); const t = e.touches[0]; handleMove(t.clientX, t.clientY); }}
      onTouchEnd={e => { e.preventDefault(); handleEnd(); }}
      onMouseDown={e => handleStart(e.clientX, e.clientY)}
      onMouseMove={e => { if (isDraggingRef.current) handleMove(e.clientX, e.clientY); }}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
    >
      {/* Knob */}
      <div
        ref={knobRef}
        className="absolute rounded-full transition-none"
        style={{
          width: size * 0.45,
          height: size * 0.45,
          top: "50%",
          left: "50%",
          marginTop: -(size * 0.225),
          marginLeft: -(size * 0.225),
          background: "rgba(255,255,255,0.35)",
          border: "2px solid rgba(255,255,255,0.6)",
          boxShadow: "0 0 8px rgba(245,158,11,0.4)",
        }}
      />
      {/* Direction indicators */}
      {["↑", "↓", "←", "→"].map((arrow, i) => {
        const positions = [
          { top: 2, left: "50%", transform: "translateX(-50%)" },
          { bottom: 2, left: "50%", transform: "translateX(-50%)" },
          { top: "50%", left: 2, transform: "translateY(-50%)" },
          { top: "50%", right: 2, transform: "translateY(-50%)" },
        ];
        return (
          <span
            key={arrow}
            className="absolute text-white/30 text-xs font-bold select-none"
            style={positions[i] as React.CSSProperties}
          >
            {arrow}
          </span>
        );
      })}
    </div>
  );
}
