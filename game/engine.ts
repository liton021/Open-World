import {
  COLS,
  COYOTE,
  DEATH_DELAY,
  GRAVITY,
  H,
  JUMP,
  JUMP_BUFFER,
  MAX_FALL,
  PLAYER_H,
  PLAYER_W,
  ROWS,
  SPEED,
  TILE,
  W,
} from "./constants";
import type {
  Crush,
  Dir,
  Effect,
  Player,
  Saw,
  Snapshot,
  Status,
  Trap,
  When,
} from "./types";
import type { Level } from "./types";

const key = (x: number, y: number) => `${x},${y}`;

export type Input = {
  left: boolean;
  right: boolean;
  jump: boolean;
  jumpPressed: boolean;
};

const NO_INPUT: Input = {
  left: false,
  right: false,
  jump: false,
  jumpPressed: false,
};

type TrapState = { trap: Trap; prev: boolean; fired: boolean };

export class Game {
  readonly level: Level;

  solid = new Set<string>();
  spikes = new Map<string, Dir>();
  coins = new Set<string>();
  door = { x: 0, y: 0 };
  decoy: { x: number; y: number } | null = null;
  spawn = { x: 0, y: 0 };

  player: Player;
  saws: Saw[] = [];
  crushes: Crush[] = [];
  traps: TrapState[] = [];

  status: Status = "live";
  time = 0;
  deaths = 0;
  coinCount = 0;
  coinTotal = 0;

  flipped = false;
  gravityDir: 1 | -1 = 1;
  maxAirJumps = 0;
  jumpMul = 1;
  shake = 0;
  message: { text: string; until: number } | null = null;

  private deathTimer = 0;
  private jumpHeld = false;

  constructor(level: Level) {
    this.level = level;
    this.player = this.freshPlayer();
    this.reset();
  }

  private freshPlayer(): Player {
    return {
      x: 0,
      y: 0,
      w: PLAYER_W,
      h: PLAYER_H,
      vx: 0,
      vy: 0,
      onGround: false,
      face: 1,
      coyote: 0,
      buffer: 0,
      jumpsLeft: 0,
      jumpsUsed: 0,
    };
  }

  /** Full level reset — used on load and on every respawn. */
  reset(keepStats = false) {
    this.solid.clear();
    this.spikes.clear();
    this.coins.clear();
    this.saws = [];
    this.crushes = [];
    this.decoy = null;

    this.flipped = false;
    this.gravityDir = 1;
    this.maxAirJumps = 0;
    this.jumpMul = 1;
    this.shake = 0;
    this.message = null;
    this.deathTimer = 0;
    this.jumpHeld = false;

    this.level.map.forEach((row, y) => {
      for (let x = 0; x < COLS; x++) {
        const ch = row[x] ?? ".";
        switch (ch) {
          case "#":
          case "=":
            this.solid.add(key(x, y));
            break;
          case "^":
            this.spikes.set(key(x, y), "up");
            break;
          case "v":
            this.spikes.set(key(x, y), "down");
            break;
          case "<":
            this.spikes.set(key(x, y), "left");
            break;
          case ">":
            this.spikes.set(key(x, y), "right");
            break;
          case "D":
            this.door = { x, y };
            break;
          case "?":
            this.decoy = { x, y };
            break;
          case "o":
            this.coins.add(key(x, y));
            break;
          case "P":
            // Feet sit on the tile below the marker.
            this.spawn = {
              x: x * TILE + TILE / 2 - PLAYER_W / 2,
              y: (y + 1) * TILE - PLAYER_H,
            };
            break;
        }
      }
    });

    this.coinTotal = this.coins.size;
    this.coinCount = 0;

    this.traps = this.level.traps.map((trap) => ({
      trap,
      prev: false,
      fired: false,
    }));

    this.player = this.freshPlayer();
    this.player.x = this.spawn.x;
    this.player.y = this.spawn.y;
    this.status = "live";

    if (!keepStats) {
      this.time = 0;
      this.deaths = 0;
    }
  }

  respawn() {
    this.reset(true);
  }

  // -- helpers --------------------------------------------------------------

  private solidRects(): { x: number; y: number; w: number; h: number }[] {
    const out: { x: number; y: number; w: number; h: number }[] = [];
    for (const k of this.solid) {
      const [sx, sy] = k.split(",");
      out.push({
        x: Number(sx) * TILE,
        y: Number(sy) * TILE,
        w: TILE,
        h: TILE,
      });
    }
    return out;
  }

  private overlapsAny() {
    const p = this.player;
    for (const r of this.solidRects()) {
      if (
        p.x < r.x + r.w &&
        p.x + p.w > r.x &&
        p.y < r.y + r.h &&
        p.y + p.h > r.y
      ) {
        return r;
      }
    }
    return null;
  }

  private spikeBox(cx: number, cy: number, dir: Dir) {
    // Forgiveness by design: the kill zone is smaller than the drawn spike.
    const inset = TILE * 0.2;
    const y0 = cy * TILE;
    const x0 = cx * TILE;
    switch (dir) {
      case "up":
        return { x: x0 + inset, y: y0 + TILE * 0.5, w: TILE - inset * 2, h: TILE * 0.5 };
      case "down":
        return { x: x0 + inset, y: y0, w: TILE - inset * 2, h: TILE * 0.5 };
      case "left":
        return { x: x0 + TILE * 0.5, y: y0 + inset, w: TILE * 0.5, h: TILE - inset * 2 };
      case "right":
        return { x: x0, y: y0 + inset, w: TILE * 0.5, h: TILE - inset * 2 };
    }
  }

  private rectOverlapPlayer(r: { x: number; y: number; w: number; h: number }) {
    const p = this.player;
    return (
      p.x < r.x + r.w && p.x + p.w > r.x && p.y < r.y + r.h && p.y + p.h > r.y
    );
  }

  get doorRect() {
    const t = TILE;
    return {
      x: this.door.x * t + t * 0.18,
      y: this.door.y * t + t * 0.1,
      w: t * 0.64,
      h: t * 0.9,
    };
  }

  // -- main update ----------------------------------------------------------

  update(dt: number, input: Input = NO_INPUT) {
    dt = Math.min(dt, 0.05);

    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 40);
    }
    if (this.message && this.time > this.message.until) this.message = null;

    if (this.status === "dead") {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) this.respawn();
      return;
    }
    if (this.status === "won") return;

    this.time += dt;

    this.evaluateTraps();

    if (this.status !== "live") return;

    this.stepPlayer(dt, input);
    if (this.status !== "live") return;

    this.stepHazards(dt);

    this.checkHazards();
  }

  private stepPlayer(dt: number, input: Input) {
    const p = this.player;
    const gdir = this.gravityDir;

    // Horizontal input, with the control-flip trap applied on the way in.
    let dir = 0;
    if (input.left) dir -= 1;
    if (input.right) dir += 1;
    if (this.flipped) dir *= -1;

    if (dir !== 0) {
      p.vx = dir * SPEED;
      p.face = dir > 0 ? 1 : -1;
    } else {
      // Snappy stop — Level Devil has almost no inertia, which is what makes
      // its precision traps readable.
      p.vx = 0;
    }

    // Jump buffering + coyote time.
    p.buffer = Math.max(0, p.buffer - dt);
    p.coyote = Math.max(0, p.coyote - dt);

    if (input.jumpPressed) p.buffer = JUMP_BUFFER;
    this.jumpHeld = input.jump;

    if (p.buffer > 0) {
      const grounded = p.onGround || p.coyote > 0;
      if (grounded) {
        p.vy = -gdir * JUMP * this.jumpMul;
        p.onGround = false;
        p.coyote = 0;
        p.buffer = 0;
        this.pushTrapCheck("jump");
      } else if (p.jumpsLeft > 0) {
        p.jumpsLeft -= 1;
        p.vy = -gdir * JUMP * this.jumpMul * 0.92;
        p.buffer = 0;
        this.pushTrapCheck("jump");
      }
    }

    // Variable jump height — releasing early cuts the arc. Never required,
    // always useful.
    if (!this.jumpHeld && p.vy * gdir < 0) {
      p.vy += gdir * GRAVITY * 1.9 * dt;
    }

    p.vy += gdir * GRAVITY * dt;
    const maxV = MAX_FALL;
    p.vy = Math.max(-maxV, Math.min(maxV, p.vy));

    const wasGrounded = p.onGround;
    p.onGround = false;

    // --- horizontal ---
    p.x += p.vx * dt;
    p.x = Math.max(0, Math.min(W - p.w, p.x));
    let r = this.overlapsAny();
    while (r) {
      if (p.vx > 0) p.x = r.x - p.w;
      else if (p.vx < 0) p.x = r.x + r.w;
      else break;
      r = this.overlapsAny();
    }

    // --- vertical ---
    p.y += p.vy * dt;
    let hit = this.overlapsAny();
    while (hit) {
      if (p.vy > 0) {
        p.y = hit.y - p.h;
        if (gdir === 1) p.onGround = true;
        p.vy = 0;
      } else if (p.vy < 0) {
        p.y = hit.y + hit.h;
        if (gdir === -1) p.onGround = true;
        p.vy = 0;
      } else break;
      hit = this.overlapsAny();
    }

    if (p.onGround) {
      p.coyote = COYOTE;
      p.jumpsLeft = this.maxAirJumps;
      p.jumpsUsed = 0;
    } else if (wasGrounded) {
      p.coyote = COYOTE;
    }

    // Fell out of the world.
    if (p.y > H + 60 || p.y + p.h < -60) {
      this.die();
      return;
    }

    // Coins.
    for (const k of [...this.coins]) {
      const [cx, cy] = k.split(",");
      const r2 = {
        x: Number(cx) * TILE + TILE * 0.28,
        y: Number(cy) * TILE + TILE * 0.28,
        w: TILE * 0.44,
        h: TILE * 0.44,
      };
      if (this.rectOverlapPlayer(r2)) {
        this.coins.delete(k);
        this.coinCount++;
        this.pushTrapCheck("coin");
      }
    }

    // Decoy door.
    if (this.decoy) {
      const d = {
        x: this.decoy.x * TILE + TILE * 0.2,
        y: this.decoy.y * TILE + TILE * 0.1,
        w: TILE * 0.6,
        h: TILE * 0.9,
      };
      if (this.rectOverlapPlayer(d)) this.pushTrapCheck("decoy");
    }

    // Real door.
    if (this.rectOverlapPlayer(this.doorRect)) {
      this.status = "won";
      this.emit({ e: "sfx", name: "win" });
    }
  }

  private stepHazards(dt: number) {
    for (const c of this.crushes) {
      if (c.t < c.dur) {
        c.t = Math.min(c.dur, c.t + dt);
      } else if (c.t < c.dur + HOLD) {
        c.t += dt;
      } else if (c.t < c.dur * 2 + HOLD) {
        c.t = Math.min(c.dur * 2 + HOLD, c.t + dt);
      }
    }
  }

  private crushRect(c: Crush) {
    let progress = 0;
    if (c.t <= c.dur) progress = c.t / c.dur;
    else if (c.t <= c.dur + HOLD) progress = 1;
    else progress = Math.max(0, 1 - (c.t - c.dur - HOLD) / c.dur);
    return { x: c.x, y: c.y, w: c.w, h: c.h + progress * c.dy };
  }

  private checkHazards() {
    const p = this.player;

    for (const [k, dir] of this.spikes) {
      const [sx, sy] = k.split(",");
      const box = this.spikeBox(Number(sx), Number(sy), dir);
      if (this.rectOverlapPlayer(box)) {
        this.die();
        return;
      }
    }

    for (const c of this.crushes) {
      if (this.rectOverlapPlayer(this.crushRect(c))) {
        this.die();
        return;
      }
    }

    for (const s of this.saws) {
      const pos = this.sawPos(s);
      const cx = Math.max(p.x, Math.min(pos.x, p.x + p.w));
      const cy = Math.max(p.y, Math.min(pos.y, p.y + p.h));
      const dx = pos.x - cx;
      const dy = pos.y - cy;
      if (dx * dx + dy * dy < (s.r - 4) * (s.r - 4)) {
        this.die();
        return;
      }
    }
  }

  sawPos(s: Saw) {
    const base = { x: s.x * TILE + TILE / 2, y: s.y * TILE + TILE / 2 };
    const off = Math.sin(this.time * s.speed) * ((s.range * TILE) / 2);
    return s.axis === "x"
      ? { x: base.x + off, y: base.y }
      : { x: base.x, y: base.y + off };
  }

  die() {
    if (this.status !== "live") return;
    this.status = "dead";
    this.deaths++;
    this.deathTimer = DEATH_DELAY;
    this.shake = Math.max(this.shake, 14);
    this.emit({ e: "sfx", name: "die" });
  }

  // -- trap machinery -------------------------------------------------------

  /** One-shot condition checks raised by the player step (jump, coin, decoy). */
  private pending = new Set<string>();

  private pushTrapCheck(k: "jump" | "coin" | "decoy") {
    this.pending.add(k);
  }

  private evaluateTraps() {
    for (const ts of this.traps) {
      const cond = this.test(ts.trap.when, ts.prev);
      const rising = cond && !ts.prev;
      ts.prev = cond;

      if (!rising) continue;
      if (ts.fired && ts.trap.once !== false) continue;

      ts.fired = true;
      for (const eff of ts.trap.then) this.apply(eff);
    }
    this.pending.clear();
  }

  private test(w: When, prev: boolean): boolean {
    const p = this.player;
    switch (w.t) {
      case "enter":
        return this.rectOverlapPlayer({
          x: w.x * TILE,
          y: w.y * TILE,
          w: w.w * TILE,
          h: w.h * TILE,
        });
      case "zone":
        return this.rectOverlapPlayer({ x: w.x, y: w.y, w: w.w, h: w.h });
      case "land": {
        const feet = p.y + p.h;
        return (
          p.onGround &&
          Math.abs(feet - (w.y + 1) * TILE) < 2 &&
          p.x + p.w > w.x * TILE &&
          p.x < (w.x + 1) * TILE
        );
      }
      case "pause":
        return this.time >= w.s;
      case "nearDoor": {
        const d = this.doorRect;
        const dx = p.x + p.w / 2 - (d.x + d.w / 2);
        const dy = p.y + p.h / 2 - (d.y + d.h / 2);
        return Math.hypot(dx, dy) < w.px;
      }
      case "jump":
        return this.pending.has("jump");
      case "coin":
        return this.pending.has("coin");
      case "decoy":
        return this.pending.has("decoy");
      case "fall":
        return p.y > w.y;
    }
  }

  private apply(e: Effect) {
    switch (e.e) {
      case "vanish":
        for (const [x, y] of e.at) this.solid.delete(key(x, y));
        break;
      case "appear":
        for (const [x, y] of e.at) this.solid.add(key(x, y));
        break;
      case "spike":
        for (const [x, y] of e.at) this.spikes.set(key(x, y), e.dir);
        break;
      case "unspike":
        for (const [x, y] of e.at) this.spikes.delete(key(x, y));
        break;
      case "crush": {
        const xs = e.at.map((c) => c[0]);
        const ys = e.at.map((c) => c[1]);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        this.crushes.push({
          x: minX * TILE,
          y: minY * TILE,
          w: (maxX - minX + 1) * TILE,
          h: TILE,
          dy: e.tiles * TILE,
          t: 0,
          dur: e.dur,
        });
        break;
      }
      case "doorTo":
        this.door = { x: e.at[0], y: e.at[1] };
        break;
      case "flip":
        this.flipped = !this.flipped;
        break;
      case "gravity":
        this.gravityDir = e.v >= 0 ? 1 : -1;
        this.player.vy = 0;
        this.player.onGround = false;
        break;
      case "warp":
        this.player.x = e.at[0] * TILE + TILE / 2 - this.player.w / 2;
        this.player.y = (e.at[1] + 1) * TILE - this.player.h;
        this.player.vx = 0;
        this.player.vy = 0;
        break;
      case "saw":
        this.saws.push({
          x: e.at[0],
          y: e.at[1],
          r: 22,
          axis: e.axis,
          range: e.range,
          speed: e.speed,
          phase: 0,
        });
        break;
      case "jumps":
        this.maxAirJumps = e.v;
        this.player.jumpsLeft = e.v;
        break;
      case "boost":
        this.jumpMul = e.v;
        break;
      case "message":
        this.message = { text: e.text, until: this.time + (e.s ?? 2.2) };
        break;
      case "shake":
        this.shake = Math.max(this.shake, e.amount ?? 10);
        break;
      case "sfx":
        this.lastSfx = e.name;
        break;
    }
  }

  /** Renderer drains this. */
  lastSfx: string | null = null;
  drainSfx(): string | null {
    const s = this.lastSfx;
    this.lastSfx = null;
    return s;
  }

  private emit(e: Effect) {
    this.apply(e);
  }

  // -- snapshot for React ---------------------------------------------------

  snapshot(): Snapshot {
    return {
      levelId: this.level.id,
      title: this.level.title,
      status: this.status,
      deaths: this.deaths,
      time: this.time,
      coins: this.coinCount,
      coinTotal: this.coinTotal,
      message: this.message,
    };
  }
}

const HOLD = 0.7;

export { ROWS, COLS };
