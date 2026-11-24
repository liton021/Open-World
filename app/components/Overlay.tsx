"use client";

import type { Snapshot } from "@/game/types";

type Props = {
  snap: Snapshot | null;
  paused: boolean;
  onRetry: () => void;
  onNext: () => void;
  onResume: () => void;
  onRestart: () => void;
  isLast: boolean;
};

export function Overlay({
  snap,
  paused,
  onRetry,
  onNext,
  onResume,
  onRestart,
  isLast,
}: Props) {
  if (!snap) return null;

  if (paused) {
    return (
      <div className="overlay">
        <div className="panel">
          <span className="eyebrow">Paused</span>
          <h2>Taking a moment?</h2>
          <p>The room is happy to wait. It is very patient.</p>
          <div className="row">
            <button className="btn" onClick={onResume}>
              Resume
            </button>
            <button className="btn ghost" onClick={onRestart}>
              Restart level
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (snap.status === "won") {
    return (
      <div className="overlay solid">
        <div className="panel">
          <span className="eyebrow">
            Level {snap.levelId} cleared · {snap.deaths}{" "}
            {snap.deaths === 1 ? "death" : "deaths"}
          </span>
          <h2>{isLast ? "You got out." : "Fine. Next room."}</h2>
          <div className="big">{snap.time.toFixed(1)}s</div>
          {snap.coinTotal > 0 && (
            <p>
              Coins: {snap.coins} / {snap.coinTotal}
            </p>
          )}
          <div className="row">
            <button className="btn" onClick={onNext}>
              {isLast ? "Play again" : "Next level →"}
            </button>
            <button className="btn ghost" onClick={onRetry}>
              Replay
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (snap.status === "dead") {
    // A death is a two-second joke, not a failure screen. Keep it quiet.
    return (
      <div className="overlay">
        <div className="panel">
          <span className="eyebrow">Death {snap.deaths}</span>
          <h2>Noted.</h2>
          <p>Resetting you. Try not to do that again.</p>
        </div>
      </div>
    );
  }

  return null;
}
