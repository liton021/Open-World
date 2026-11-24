// ---------------------------------------------------------------------------
// World geometry. One screen, 16 x 9 tiles — the same shape as Level Devil's
// single-screen rooms, where a death costs two seconds and not two minutes.
// ---------------------------------------------------------------------------

export const TILE = 50;
export const COLS = 16;
export const ROWS = 9;
export const W = COLS * TILE; // 800
export const H = ROWS * TILE; // 450

// --- Player feel ------------------------------------------------------------
// Tuned by hand and then verified numerically (see scripts/jump-table.ts).
// Apex ≈ 154px ≈ 3.1 tiles, airtime ≈ 0.72s, horizontal reach ≈ 215px ≈ 4.3
// tiles. Every gap in every level is authored against those numbers.
export const SPEED = 300;
export const GRAVITY = 2400;
export const JUMP = 860;
export const MAX_FALL = 1150;

export const PLAYER_W = 28;
export const PLAYER_H = 36;

// Forgiveness that never undercuts a trap: coyote time and jump buffering only
// help you when you already pressed the right thing.
export const COYOTE = 0.09;
export const JUMP_BUFFER = 0.1;

// Physics runs on a fixed step so behaviour is identical on 60Hz and 144Hz.
export const STEP = 1 / 120;

export const DEATH_DELAY = 0.42;
