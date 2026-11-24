import { COLS, H, ROWS, TILE, W } from "./constants";
import type { Game } from "./engine";
import type { Dir } from "./types";

// ---------------------------------------------------------------------------
// Palette. Deliberately warm and friendly — the joke only works if the room
// looks trustworthy right up until it isn't.
// ---------------------------------------------------------------------------

const C = {
  bgTop: "#f4efe6",
  bgBot: "#e7dfd2",
  grid: "rgba(30, 22, 14, 0.045)",
  solid: "#3b322a",
  solidTop: "#584b3e",
  solidLip: "#6d5c4a",
  spike: "#c8503c",
  spikeDark: "#8f3426",
  coin: "#e0a32b",
  coinDark: "#a8741a",
  door: "#2f7d5d",
  doorDark: "#1d5842",
  doorLit: "#3fa377",
  decoy: "#8b7f72",
  player: "#1d1a17",
  playerEye: "#f4efe6",
  saw: "#9aa0a6",
  sawDark: "#5f6368",
  dust: "rgba(59, 50, 42, 0.16)",
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawSolid(ctx: CanvasRenderingContext2D, x: number, y: number, exposeTop: boolean) {
  ctx.fillStyle = C.solid;
  ctx.fillRect(x, y, TILE, TILE);
  if (exposeTop) {
    ctx.fillStyle = C.solidTop;
    ctx.fillRect(x, y, TILE, TILE * 0.22);
    ctx.fillStyle = C.solidLip;
    ctx.fillRect(x, y, TILE, 3);
  }
}

function drawSpike(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: Dir,
) {
  // Two big, unmistakable teeth. Readability beats elegance: the player has
  // about 200ms to react, so the silhouette has to be obvious at a glance.
  const n = 2;
  const step = TILE / n;
  const base = TILE;
  const tip = TILE * 0.02;

  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    if (dir === "up") {
      const bx = x + i * step;
      ctx.moveTo(bx, y + base);
      ctx.lineTo(bx + step / 2, y + tip);
      ctx.lineTo(bx + step, y + base);
    } else if (dir === "down") {
      const bx = x + i * step;
      ctx.moveTo(bx, y);
      ctx.lineTo(bx + step / 2, y + base - tip);
      ctx.lineTo(bx + step, y);
    } else if (dir === "left") {
      const by = y + i * step;
      ctx.moveTo(x + base, by);
      ctx.lineTo(x + tip, by + step / 2);
      ctx.lineTo(x + base, by + step);
    } else {
      const by = y + i * step;
      ctx.moveTo(x, by);
      ctx.lineTo(x + base - tip, by + step / 2);
      ctx.lineTo(x, by + step);
    }
  }
  ctx.closePath();

  const grad =
    dir === "up" || dir === "down"
      ? ctx.createLinearGradient(0, y, 0, y + TILE)
      : ctx.createLinearGradient(x, 0, x + TILE, 0);
  grad.addColorStop(0, C.spike);
  grad.addColorStop(1, C.spikeDark);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = C.spikeDark;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.stroke();

  // A dark base plate anchors the spikes to their tile so they never look
  // like they are floating.
  ctx.fillStyle = "rgba(29, 26, 23, 0.55)";
  if (dir === "up") ctx.fillRect(x, y + TILE - 4, TILE, 4);
  else if (dir === "down") ctx.fillRect(x, y, TILE, 4);
  else if (dir === "left") ctx.fillRect(x + TILE - 4, y, 4, TILE);
  else ctx.fillRect(x, y, 4, TILE);
}

function drawDoor(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  t: number,
  fake = false,
) {
  const x = gx * TILE + TILE * 0.16;
  const y = gy * TILE + TILE * 0.08;
  const w = TILE * 0.68;
  const h = TILE * 0.92;

  // Soft glow so the eye is pulled toward it — that is the whole point.
  if (!fake) {
    const glow = ctx.createRadialGradient(
      x + w / 2,
      y + h / 2,
      4,
      x + w / 2,
      y + h / 2,
      TILE * 1.15,
    );
    glow.addColorStop(0, "rgba(63, 163, 119, 0.30)");
    glow.addColorStop(1, "rgba(63, 163, 119, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - TILE, y - TILE, w + TILE * 2, h + TILE * 2);
  }

  ctx.fillStyle = fake ? C.decoy : C.doorDark;
  roundRect(ctx, x, y, w, h, 5);
  ctx.fill();

  ctx.fillStyle = fake ? "#a59a8c" : C.door;
  roundRect(ctx, x + 4, y + 4, w - 8, h - 8, 3);
  ctx.fill();

  if (!fake) {
    // A faint pulse, like something is waiting on the other side.
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
    ctx.fillStyle = `rgba(63, 163, 119, ${0.18 + pulse * 0.22})`;
    roundRect(ctx, x + 4, y + 4, w - 8, h - 8, 3);
    ctx.fill();
  }

  ctx.fillStyle = fake ? "#6d6357" : C.doorLit;
  ctx.beginPath();
  ctx.arc(x + w - 12, y + h / 2, 3.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawCoin(ctx: CanvasRenderingContext2D, gx: number, gy: number, t: number) {
  const cx = gx * TILE + TILE / 2;
  const cy = gy * TILE + TILE / 2;
  const squash = Math.abs(Math.cos(t * 2.4)); // gentle spin
  ctx.fillStyle = C.coinDark;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 10 * Math.max(0.18, squash), 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.coin;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 8 * Math.max(0.15, squash), 8, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawSaw(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, t: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 9);
  ctx.fillStyle = C.sawDark;
  ctx.beginPath();
  const teeth = 10;
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const rad = i % 2 === 0 ? r : r * 0.74;
    const px = Math.cos(a) * rad;
    const py = Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = C.saw;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.solid;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, g: Game) {
  const p = g.player;

  if (g.status === "dead") {
    // Squash into a small smear. Comedic, instant, non-gory.
    const cx = p.x + p.w / 2;
    const feet = p.y + p.h;
    ctx.fillStyle = C.player;
    ctx.beginPath();
    ctx.ellipse(cx, feet - 4, p.w * 0.75, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const r = 7;
  // Shadow
  ctx.fillStyle = C.dust;
  ctx.beginPath();
  ctx.ellipse(p.x + p.w / 2, p.y + p.h + 2, p.w * 0.42, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = C.player;
  roundRect(ctx, p.x, p.y, p.w, p.h, r);
  ctx.fill();

  // Two eyes, looking the way you're going. The only "character" the game has.
  const eyeY = p.y + p.h * 0.36;
  const eyeDX = p.face * 2.2;
  ctx.fillStyle = C.playerEye;
  ctx.beginPath();
  ctx.arc(p.x + p.w * 0.34 + eyeDX, eyeY, 3, 0, Math.PI * 2);
  ctx.arc(p.x + p.w * 0.68 + eyeDX, eyeY, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = C.player;
  ctx.beginPath();
  ctx.arc(p.x + p.w * 0.34 + eyeDX + p.face * 0.9, eyeY, 1.5, 0, Math.PI * 2);
  ctx.arc(p.x + p.w * 0.68 + eyeDX + p.face * 0.9, eyeY, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

export function render(ctx: CanvasRenderingContext2D, g: Game, t: number) {
  ctx.save();

  if (g.shake > 0.2) {
    const s = g.shake;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, C.bgTop);
  bg.addColorStop(1, C.bgBot);
  ctx.fillStyle = bg;
  ctx.fillRect(-40, -40, W + 80, H + 80);

  // Faint grid — makes the room feel like graph paper, i.e. designed.
  // Drawn as a flat fill rather than strokes: a stroked 0.5px line lands on a
  // half-device-pixel at some boundaries and aliases into a visible seam.
  ctx.fillStyle = C.grid;
  for (let x = 1; x < COLS; x++) {
    ctx.fillRect(x * TILE, 0, 1, H);
  }
  for (let y = 1; y < ROWS; y++) {
    ctx.fillRect(0, y * TILE, W, 1);
  }

  // Crush slabs sit behind solids so they read as part of the ceiling.
  for (const c of g.crushes) {
    const prog = (() => {
      if (c.t <= c.dur) return c.t / c.dur;
      return 1;
    })();
    const h = c.h + prog * c.dy;
    ctx.fillStyle = C.solid;
    ctx.fillRect(c.x, c.y, c.w, h);
    ctx.fillStyle = C.solidLip;
    ctx.fillRect(c.x, c.y + h - 5, c.w, 5);
    // Warning stripes on the leading edge.
    ctx.fillStyle = "rgba(200, 80, 60, 0.85)";
    const stripes = Math.floor(c.w / 14);
    for (let i = 0; i < stripes; i += 2) {
      ctx.fillRect(c.x + i * 14, c.y + h - 12, 7, 7);
    }
  }

  // Solids
  for (const k of g.solid) {
    const [sx, sy] = k.split(",").map(Number);
    const above = g.solid.has(`${sx},${sy - 1}`);
    drawSolid(ctx, sx * TILE, sy * TILE, !above);
  }

  // Door(s)
  drawDoor(ctx, g.door.x, g.door.y, t);
  if (g.decoy) drawDoor(ctx, g.decoy.x, g.decoy.y, t, true);

  // Coins
  for (const k of g.coins) {
    const [sx, sy] = k.split(",").map(Number);
    drawCoin(ctx, sx, sy, t);
  }

  // Spikes
  for (const [k, dir] of g.spikes) {
    const [sx, sy] = k.split(",").map(Number);
    drawSpike(ctx, sx * TILE, sy * TILE, dir);
  }

  // Saws
  for (const s of g.saws) {
    const pos = g.sawPos(s);
    // Track line so the movement is readable before it kills you.
    ctx.strokeStyle = "rgba(95, 99, 104, 0.16)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    if (s.axis === "x") {
      ctx.moveTo(pos.x - (s.range * TILE) / 2, pos.y);
      ctx.lineTo(pos.x + (s.range * TILE) / 2, pos.y);
    } else {
      ctx.moveTo(pos.x, pos.y - (s.range * TILE) / 2);
      ctx.lineTo(pos.x, pos.y + (s.range * TILE) / 2);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    drawSaw(ctx, pos.x, pos.y, s.r, t);
  }

  drawPlayer(ctx, g);

  // Control-flip indicator: the one trap that needs a visible cue, because it
  // changes your *input*, not the world.
  if (g.flipped) {
    ctx.fillStyle = "rgba(200, 80, 60, 0.85)";
    ctx.font = "600 13px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.fillText("⇄ CONTROLS REVERSED", W / 2, 26);
  }

  // In-world message
  if (g.message) {
    const msg = g.message;
    const fade = Math.min(1, (msg.until - g.time) / 0.35);
    ctx.globalAlpha = Math.max(0, fade);
    ctx.font = "600 17px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    const text = msg.text;
    const metrics = ctx.measureText(text);
    const padX = 16;
    const bw = metrics.width + padX * 2;
    const bh = 34;
    const bx = W / 2 - bw / 2;
    // Pinned high on purpose: the bottom of the screen is where the door, the
    // player and the floor all live, and the sarcasm must not cover any of them.
    const by = 44;
    ctx.fillStyle = "rgba(29, 26, 23, 0.92)";
    roundRect(ctx, bx, by, bw, bh, 8);
    ctx.fill();
    ctx.fillStyle = "#f4efe6";
    ctx.fillText(text, W / 2, by + 22);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}
