"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Game, type Input } from "@/game/engine";
import { LEVELS } from "@/game/levels";
import { STEP } from "@/game/constants";
import type { Snapshot } from "@/game/types";
import { playSfx, unlockAudio } from "@/game/audio";

const KEYMAP: Record<string, keyof Input> = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowUp: "jump",
  KeyW: "jump",
  Space: "jump",
};

/**
 * Owns the game instance, the fixed-step loop, and input state.
 * React only ever re-renders on coarse changes (level, status, deaths, coins),
 * never on physics frames — that is what keeps it smooth.
 */
export function useGame() {
  const [levelIndex, setLevelIndex] = useState(0);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [paused, setPaused] = useState(false);

  const gameRef = useRef<Game | null>(null);
  const inputRef = useRef<Input>({
    left: false,
    right: false,
    jump: false,
    jumpPressed: false,
  });
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // --- level lifecycle -----------------------------------------------------
  useEffect(() => {
    const g = new Game(LEVELS[levelIndex]);
    gameRef.current = g;
    setSnap(g.snapshot());
  }, [levelIndex]);

  // --- sync coarse state out of the engine --------------------------------
  // Only coarse changes reach React. Physics never triggers a re-render, which
  // is what keeps a 10fps-looking React tree off the critical path.
  const publish = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    const s = g.snapshot();
    setSnap((prev) => {
      if (
        prev &&
        prev.status === s.status &&
        prev.deaths === s.deaths &&
        prev.coins === s.coins &&
        prev.levelId === s.levelId &&
        (prev.message?.text ?? null) === (s.message?.text ?? null)
      ) {
        return prev;
      }
      return s;
    });
  }, []);

  // --- keyboard ------------------------------------------------------------
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const mapped = KEYMAP[e.code];
      if (!mapped) {
        if (e.code === "KeyR") {
          gameRef.current?.respawn();
          publish();
        }
        if (e.code === "Escape" || e.code === "KeyP") {
          setPaused((p) => !p);
        }
        return;
      }
      e.preventDefault();
      unlockAudio();
      if (mapped === "jump" && !inputRef.current.jump) {
        inputRef.current.jumpPressed = true;
      }
      inputRef.current[mapped] = true;
    };

    const up = (e: KeyboardEvent) => {
      const mapped = KEYMAP[e.code];
      if (!mapped) return;
      e.preventDefault();
      inputRef.current[mapped] = false;
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [publish]);

  // --- fixed-step loop -----------------------------------------------------
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      const g = gameRef.current;
      if (!g) return;

      if (!pausedRef.current) {
        acc += dt;
        let guard = 0;
        while (acc >= STEP && guard++ < 8) {
          g.update(STEP, inputRef.current);
          inputRef.current.jumpPressed = false;
          acc -= STEP;
        }
        // Drain sounds generated during the sub-steps.
        let sfx = g.drainSfx();
        while (sfx) {
          playSfx(sfx);
          sfx = g.drainSfx();
        }
        publish();
      }
      acc = Math.min(acc, STEP * 4);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [publish]);

  const retry = useCallback(() => {
    gameRef.current?.respawn();
    publish();
  }, [publish]);

  const next = useCallback(() => {
    setLevelIndex((i) => (i + 1) % LEVELS.length);
  }, []);

  const goTo = useCallback((i: number) => {
    setLevelIndex(Math.max(0, Math.min(LEVELS.length - 1, i)));
  }, []);

  return {
    levelIndex,
    snap,
    paused,
    setPaused,
    retry,
    next,
    goTo,
    gameRef,
    inputRef,
    total: LEVELS.length,
    level: LEVELS[levelIndex],
  };
}
