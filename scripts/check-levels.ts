// ---------------------------------------------------------------------------
// Level checker — the game's test suite.
//
// Three independent checks per level:
//
//   1. STRUCTURE  the ASCII map is well formed (right size, one spawn, one door)
//   2. FAIRNESS   no deadly hazard ever materialises on top of the player.
//                 This is the rule that separates a troll from a cheat: the
//                 room may lie to you, but it may never kill you without
//                 giving you somewhere to be.
//   3. BEATABILITY a competent simulated player clears the room. Failure here
//                 is a warning to inspect by hand, not always a bug.
//
// Run: npm run check:levels
// ---------------------------------------------------------------------------

import { Game, type Input } from "../game/engine";
import { LEVELS } from "../game/levels";
import { COLS, ROWS, STEP, TILE } from "../game/constants";
import type { Coord } from "../game/types";

const blank = (): Input => ({
  left: false,
  right: false,
  jump: false,
  jumpPressed: false,
});

const HAZARD_LOOKAHEAD_TILES = 3; // what a player can reasonably see coming

function spikeRectsAt(g: Game): { x: number; y: number; w: number; h: number }[] {
  const out: { x: number; y: number; w: number; h: number }[] = [];
  for (const [k, dir] of g.spikes) {
    const [cx, cy] = k.split(",").map(Number);
    const x0 = cx * TILE;
    const y0 = cy * TILE;
    const inset = TILE * 0.2;
    if (dir === "up")
      out.push({ x: x0 + inset, y: y0 + TILE * 0.5, w: TILE - inset * 2, h: TILE * 0.5 });
    else if (dir === "down")
      out.push({ x: x0 + inset, y: y0, w: TILE - inset * 2, h: TILE * 0.5 });
    else if (dir === "left")
      out.push({ x: x0 + TILE * 0.5, y: y0 + inset, w: TILE * 0.5, h: TILE - inset * 2 });
    else
      out.push({ x: x0, y: y0 + inset, w: TILE * 0.5, h: TILE - inset * 2 });
  }
  return out;
}

const overlaps = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function crushRectNow(c: Game["crushes"][number], hold = 0.7) {
  let progress = 0;
  if (c.t <= c.dur) progress = c.t / c.dur;
  else if (c.t <= c.dur + hold) progress = 1;
  else progress = Math.max(0, 1 - (c.t - c.dur - hold) / c.dur);
  return { x: c.x, y: c.y, w: c.w, h: c.h + progress * c.dy };
}

// ---------------------------------------------------------------------------
// The simulated player.
//
// Deliberately *competent but not superhuman*: it can see one screen, it waits
// out machinery, and it knows when its controls were reversed. If this player
// cannot clear a room, a human probably can, but the room deserves a look.
// ---------------------------------------------------------------------------

type Memory = { waitUntil: number };

function makePolicy(mem: Memory) {
  return (g: Game): Input => {
    const i = blank();
    const p = g.player;
    if (g.status !== "live") return i;

    const doorRect = g.doorRect;
    const doorCx = doorRect.x + doorRect.w / 2;
    const px = p.x + p.w / 2;
    const py = p.y + p.h / 2;

    // --- 0. respect a pending wait -------------------------------------
    if (g.time < mem.waitUntil) return i;

    // --- 1. wait out any machinery occupying our path ------------------
    // A crusher that is down (or on its way down) over us is a wall, not a
    // puzzle. Patience is the skill being tested.
    for (const c of g.crushes) {
      const spanX = p.x + p.w > c.x - 10 && p.x < c.x + c.w + 10;
      if (!spanX) continue;
      const r = crushRectNow(c);
      const stillDown = c.t < c.dur + 0.7;
      if (stillDown && r.y + r.h >= p.y - TILE * 2) {
        mem.waitUntil = g.time + 0.12;
        return i;
      }
      if (r.y + r.h >= p.y - 4) {
        // Wait for the full retract cycle, then go.
        mem.waitUntil = g.time + Math.max(0.12, c.dur * 2 + 0.8 - c.t);
        return i;
      }
    }

    // --- 2. saws: do not walk into a blade -----------------------------
    for (const s of g.saws) {
      const pos = g.sawPos(s);
      const dx = pos.x - px;
      const dy = pos.y - py;
      const dist = Math.hypot(dx, dy);
      if (dist < s.r + 46) {
        // Back off to a safe distance and let it swing past.
        if (dx > 0) i.left = true;
        else i.right = true;
        mem.waitUntil = g.time + 0.1;
        return i;
      }
    }

    // --- 3. horizontal intention, through the control-flip filter ------
    const wantRight = px < doorCx - 5;
    const wantLeft = px > doorCx + 5;
    if (wantRight) {
      if (g.flipped) i.left = true;
      else i.right = true;
    } else if (wantLeft) {
      if (g.flipped) i.right = true;
      else i.left = true;
    }

    // --- 4. look ahead for holes and spikes ---------------------------
    const movingRight = (wantRight && !g.flipped) || (wantLeft && g.flipped);
    const dirSign = movingRight ? 1 : -1;
    const footY = p.y + p.h;
    const rowBelow = Math.floor((footY + 3) / TILE);

    let hazardAhead = false;
    let holeAhead = false;
    for (let d = 1; d <= HAZARD_LOOKAHEAD_TILES; d++) {
      const probeX =
        dirSign > 0 ? p.x + p.w + d * TILE * 0.55 : p.x - d * TILE * 0.55;
      const col = Math.floor(probeX / TILE);
      if (col < 0 || col >= COLS) break;

      if (!g.solid.has(`${col},${rowBelow}`)) holeAhead = true;
      if (g.spikes.has(`${col},${rowBelow}`)) hazardAhead = true;
      if (g.spikes.has(`${col},${rowBelow - 1}`)) hazardAhead = true;
      if (holeAhead || hazardAhead) break;
    }

    // --- 5. jump decisions -------------------------------------------
    const doorAbove = doorCx - 20 < px && px < doorCx + 20 && doorRect.y + doorRect.h < p.y - 12;

    if (p.onGround) {
      // Jump early enough to clear a 2-tile hazard, not on the lip.
      if (hazardAhead || (holeAhead && !p.onGround)) {
        i.jump = true;
        i.jumpPressed = true;
      } else if (holeAhead) {
        // edge of a hole: commit
        i.jump = true;
        i.jumpPressed = true;
      } else if (doorAbove || (doorRect.y + doorRect.h < p.y - 12 && Math.abs(px - doorCx) < TILE * 2)) {
        i.jump = true;
        i.jumpPressed = true;
      }
    } else {
      // Airborne. Hold for height, but spend air jumps once the rise stalls.
      if (p.vy * g.gravityDir > -60 && p.jumpsLeft > 0) {
        i.jump = true;
        i.jumpPressed = true;
      } else {
        i.jump = true;
      }
    }

    return i;
  };
}

// ---------------------------------------------------------------------------

let failures = 0;
let warnings = 0;
const rows: string[] = [];

for (const level of LEVELS) {
  const problems: string[] = [];

  // ---- 1. structure ----
  if (level.map.length !== ROWS)
    problems.push(`map has ${level.map.length} rows, expected ${ROWS}`);
  level.map.forEach((row, y) => {
    if (row.length !== COLS)
      problems.push(`row ${y} is ${row.length} wide, expected ${COLS}`);
  });
  const flat = level.map.join("");
  const pCount = [...flat].filter((c) => c === "P").length;
  const dCount = [...flat].filter((c) => c === "D").length;
  if (pCount !== 1) problems.push(`found ${pCount} spawns, expected 1`);
  if (dCount !== 1) problems.push(`found ${dCount} doors, expected 1`);
  if (!flat.includes("P")) problems.push("no spawn");
  if (!flat.includes("D")) problems.push("no door");

  // Every effect must point at a tile that actually exists. A trap placed
  // off-map is silently a no-op, which is the worst kind of broken: the level
  // still "works" and is just quietly easier than designed.
  let doorAt: Coord[] = [];
  level.map.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === "D") doorAt.push([x, y]);
    }),
  );

  level.traps.forEach((trap, ti) => {
    for (const eff of trap.then) {
      if (eff.e === "doorTo") {
        const [x, y] = eff.at;
        if (x < 0 || x >= COLS || y < 0 || y >= ROWS) {
          problems.push(`trap#${ti} doorTo out of bounds (${x},${y})`);
        }
        doorAt = [eff.at];
      }
      if (eff.e === "spike" || eff.e === "vanish" || eff.e === "appear" || eff.e === "unspike") {
        for (const [x, y] of eff.at) {
          if (x < 0 || x >= COLS || y < 0 || y >= ROWS) {
            problems.push(`trap#${ti} ${eff.e} out of bounds (${x},${y})`);
          }
        }
        if (eff.e === "spike") {
          // Do not park spikes against the door. It reads as a cheap shot
          // rather than a prank, because there is nowhere to have gone.
          for (const [x, y] of eff.at) {
            for (const [dx, dy] of doorAt) {
              if (Math.abs(dx - x) + Math.abs(dy - y) <= 1) {
                problems.push(`trap#${ti} spike (${x},${y}) crowds the door`);
              }
            }
          }
        }
      }
    }
  });

  if (problems.length) {
    rows.push(`✗ ${String(level.id).padStart(2)} "${level.title}" STRUCTURE`);
    problems.forEach((pr) => rows.push(`      ${pr}`));
    failures++;
    continue;
  }

  // ---- 2 & 3. simulate ----
  const g = new Game(level);
  const mem: Memory = { waitUntil: 0 };
  const policy = makePolicy(mem);

  let prevSpikes = new Map(g.spikes);
  const unfair: string[] = [];
  let deaths = 0;
  let won = false;
  let prevStatus = g.status;

  const MAX_FRAMES = 60 * 90; // 90 simulated seconds is plenty for one room

  for (let f = 0; f < MAX_FRAMES; f++) {
    const before = { x: g.player.x, y: g.player.y, w: g.player.w, h: g.player.h };

    g.update(STEP, policy(g));

    // Track unstable geometry so we can report only *newly created* hazards.
    const nowSpikes = new Map(g.spikes);
    const newlyDeadly: { x: number; y: number; w: number; h: number }[] = [];

    for (const [k, dir] of nowSpikes) {
      if (!prevSpikes.has(k)) {
        const [cx, cy] = k.split(",").map(Number);
        const x0 = cx * TILE;
        const y0 = cy * TILE;
        const inset = TILE * 0.2;
        if (dir === "up")
          newlyDeadly.push({ x: x0 + inset, y: y0 + TILE * 0.5, w: TILE - inset * 2, h: TILE * 0.5 });
        else if (dir === "down")
          newlyDeadly.push({ x: x0 + inset, y: y0, w: TILE - inset * 2, h: TILE * 0.5 });
        else if (dir === "left")
          newlyDeadly.push({ x: x0 + TILE * 0.5, y: y0 + inset, w: TILE * 0.5, h: TILE - inset * 2 });
        else
          newlyDeadly.push({ x: x0, y: y0 + inset, w: TILE * 0.5, h: TILE - inset * 2 });
      }
    }

    for (const r of newlyDeadly) {
      if (overlaps(r, before)) {
        unfair.push(
          `spike spawned inside player at (${Math.round(before.x)},${Math.round(before.y)})`,
        );
      }
    }

    if (g.status === "dead" && prevStatus !== "dead") {
      deaths++;
      // A fair death is one where the world gave warning. We only *fail* on
      // hazards that appear underneath you; everything else is the game.
    }
    prevStatus = g.status;
    prevSpikes = nowSpikes;

    if (g.status === "won") {
      won = true;
      break;
    }
  }

  const time = g.time.toFixed(1);
  if (unfair.length) {
    failures++;
    rows.push(`✗ ${String(level.id).padStart(2)} "${level.title}" UNFAIR`);
    [...new Set(unfair)].slice(0, 4).forEach((u) => rows.push(`      ${u}`));
    continue;
  }

  if (!won) {
    warnings++;
    rows.push(
      `! ${String(level.id).padStart(2)} "${level.title}" not cleared by policy (${deaths} deaths, ${MAX_FRAMES / 60}s cap)`,
    );
  } else {
    rows.push(
      `✓ ${String(level.id).padStart(2)} "${level.title}" cleared in ${time}s, ${deaths} deaths`,
    );
  }
}

console.log(rows.join("\n"));
console.log("");
console.log(`levels ${LEVELS.length} · unfair ${failures} · unclear ${warnings}`);
process.exit(failures > 0 ? 1 : 0);
