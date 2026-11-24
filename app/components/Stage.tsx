"use client";

import { useEffect, useRef, type RefObject } from "react";
import { H, W } from "@/game/constants";
import type { Game } from "@/game/engine";
import { render } from "@/game/render";

type Props = {
  gameRef: RefObject<Game | null>;
  levelId: number;
};

/** Canvas that draws the engine every animation frame. Never re-renders React. */
export function Stage({ gameRef, levelId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let raf = 0;
    const start = performance.now();

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const g = gameRef.current;
      if (!g) return;
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, W, H);
      render(ctx, g, t);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [gameRef, levelId]);

  return (
    <canvas
      ref={canvasRef}
      className="stage-canvas"
      style={{ aspectRatio: `${W} / ${H}` }}
      aria-label="Game stage"
      role="img"
    />
  );
}
