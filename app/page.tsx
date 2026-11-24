"use client";

import { useEffect, useState } from "react";
import { Stage } from "./components/Stage";
import { Overlay } from "./components/Overlay";
import { useGame } from "./hooks/useGame";
import { isMuted, setMuted, unlockAudio } from "@/game/audio";

const BEST_KEY = "nice-try.best";

export default function Page() {
  const {
    levelIndex,
    level,
    snap,
    paused,
    setPaused,
    retry,
    next,
    goTo,
    gameRef,
    inputRef,
    total,
  } = useGame();

  const [cleared, setCleared] = useState<Set<number>>(new Set());
  const [muted, setMutedState] = useState(false);

  // Remember which levels you have beaten. Small win, real motivation.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BEST_KEY);
      if (raw) setCleared(new Set(JSON.parse(raw) as number[]));
    } catch {
      /* private mode — fine */
    }
  }, []);

  useEffect(() => {
    if (snap?.status !== "won") return;
    setCleared((prev) => {
      if (prev.has(level.id)) return prev;
      const nextSet = new Set(prev);
      nextSet.add(level.id);
      try {
        localStorage.setItem(BEST_KEY, JSON.stringify([...nextSet]));
      } catch {
        /* ignore */
      }
      return nextSet;
    });
  }, [snap?.status, level.id]);

  // Enter advances, which is what everyone tries first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Enter") return;
      if (snap?.status === "won") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [snap?.status, next]);

  const toggleMute = () => {
    const m = !isMuted();
    setMuted(m);
    setMutedState(m);
    if (!m) unlockAudio();
  };

  const totalDeaths = snap?.deaths ?? 0;

  return (
    <main className="shell">
      <header className="masthead">
        <div className="wordmark">
          <h1>
            NICE TRY<span className="thin"> / not a troll game</span>
          </h1>
          <p>Reach the door · the room disagrees</p>
        </div>

        <div className="readout" aria-live="polite">
          <div className="stat">
            <span className="k">Level</span>
            <span className="v">
              {level.id}
              <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>
                /{total}
              </span>
            </span>
          </div>
          <div className="stat">
            <span className="k">Deaths</span>
            <span className={`v ${totalDeaths > 0 ? "warn" : ""}`}>
              {totalDeaths}
            </span>
          </div>
          <div className="stat">
            <span className="k">Time</span>
            <span className="v">
              {snap ? snap.time.toFixed(1) : "0.0"}
              <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>s</span>
            </span>
          </div>
          <div className="stat">
            <span className="k">Coins</span>
            <span className="v">
              {snap?.coins ?? 0}
              <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>
                /{snap?.coinTotal ?? 0}
              </span>
            </span>
          </div>
        </div>
      </header>

      <div className="frame">
        <div className="stage-wrap">
          <Stage gameRef={gameRef} levelId={levelIndex} />
          <Overlay
            snap={snap}
            paused={paused}
            onRetry={retry}
            onNext={next}
            onResume={() => setPaused(false)}
            onRestart={retry}
            isLast={levelIndex === total - 1}
          />
        </div>
      </div>

      {/* Touch controls for phones — hidden on pointer:fine devices. */}
      <div className="touchpad">
        <div className="group">
          <button
            className="touch-btn"
            aria-label="Move left"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              inputRef.current.left = true;
            }}
            onPointerUp={() => (inputRef.current.left = false)}
            onPointerCancel={() => (inputRef.current.left = false)}
          >
            ←
          </button>
          <button
            className="touch-btn"
            aria-label="Move right"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              inputRef.current.right = true;
            }}
            onPointerUp={() => (inputRef.current.right = false)}
            onPointerCancel={() => (inputRef.current.right = false)}
          >
            →
          </button>
        </div>
        <div className="group">
          <button
            className="touch-btn"
            aria-label="Retry level"
            onPointerDown={() => {
              retry();
            }}
          >
            ↺
          </button>
          <button
            className="touch-btn"
            aria-label="Jump"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              unlockAudio();
              inputRef.current.jump = true;
              inputRef.current.jumpPressed = true;
            }}
            onPointerUp={() => (inputRef.current.jump = false)}
            onPointerCancel={() => (inputRef.current.jump = false)}
          >
            ↑
          </button>
        </div>
      </div>

      <div className="strip">
        {Array.from({ length: total }, (_, i) => {
          const lvl = i;
          const isCurrent = lvl === levelIndex;
          const isDone = cleared.has(i + 1);
          return (
            <button
              key={lvl}
              className={`chip ${isCurrent ? "current" : ""} ${
                isDone && !isCurrent ? "done" : ""
              }`}
              onClick={() => goTo(lvl)}
              aria-label={`Level ${i + 1}`}
              aria-current={isCurrent}
            >
              {i + 1}
            </button>
          );
        })}
        <span className="spacer" />
        <span className="strip-note">{level.flavor}</span>
        <button
          className="btn ghost"
          onClick={toggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
          style={{ padding: "7px 12px" }}
        >
          {muted ? "♪ off" : "♪ on"}
        </button>
      </div>

      <section className="notes">
        <div className="note">
          <h3>Controls</h3>
          <p>
            <span className="kbd-hint">
              <span className="kbd">←</span> <span className="kbd">→</span> or{" "}
              <span className="kbd">A</span> <span className="kbd">D</span> to
              move · <span className="kbd">Space</span> /{" "}
              <span className="kbd">W</span> to jump.
            </span>{" "}
            <span className="kbd">R</span> restarts, <span className="kbd">P</span>{" "}
            pauses.
          </p>
        </div>
        <div className="note">
          <h3>How to survive</h3>
          <p>
            <strong>Bait everything.</strong> Traps fire when you get close, so
            approach, wait, watch the room commit, then move. Never trust the
            floor. Never rush the door.
          </p>
        </div>
        <div className="note">
          <h3>Why the deaths are fast</h3>
          <p>
            Every room is one screen and the restart is instant, so a mistake
            costs you about two seconds. The loop is meant to be{" "}
            <strong>information, not punishment</strong>.
          </p>
        </div>
      </section>
    </main>
  );
}
