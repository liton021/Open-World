// ---------------------------------------------------------------------------
// The trap language.
//
// A level is static geometry (ASCII map) plus a list of `Trap`s. A trap is a
// WHEN paired with a THEN. Everything the game does to you is expressible as
// one of these, which is what makes the design reviewable instead of buried in
// a thousand-line update loop.
// ---------------------------------------------------------------------------

export type Dir = "up" | "down" | "left" | "right";
/** [column, row] in tile space. */
export type Coord = readonly [number, number];

/** Conditions are evaluated every frame until they fire. */
export type When =
  /** Player's body enters this tile rectangle. */
  | { t: "enter"; x: number; y: number; w: number; h: number }
  /** Player lands with their feet on this tile. */
  | { t: "land"; x: number; y: number }
  /** Seconds after the level starts. */
  | { t: "pause"; s: number }
  /** Player's centre comes within `px` of the door's centre. */
  | { t: "nearDoor"; px: number }
  /** Player jumped this frame. */
  | { t: "jump" }
  /** Player collected any coin this frame. */
  | { t: "coin" }
  /** Player fell past this world y. */
  | { t: "fall"; y: number }
  /** Player touched a decoy door. */
  | { t: "decoy" }
  /** Player's body enters this world-pixel rectangle. */
  | { t: "zone"; x: number; y: number; w: number; h: number };

/** Effects are applied in order. */
export type Effect =
  | { e: "vanish"; at: Coord[] }
  | { e: "appear"; at: Coord[] }
  | { e: "spike"; at: Coord[]; dir: Dir }
  | { e: "unspike"; at: Coord[] }
  /** Tiles detach as a solid slab and slide `tiles` units in the gravity
   *  direction over `dur` seconds. Landing on you is fatal. */
  | { e: "crush"; at: Coord[]; tiles: number; dur: number }
  | { e: "doorTo"; at: Coord }
  | { e: "flip" }
  | { e: "gravity"; v: number }
  | { e: "warp"; at: Coord }
  | { e: "saw"; at: Coord; axis: "x" | "y"; range: number; speed: number }
  | { e: "jumps"; v: number }
  /** Multiplies jump impulse for the rest of the level. */
  | { e: "boost"; v: number }
  | { e: "message"; text: string; s?: number }
  | { e: "shake"; amount?: number }
  | { e: "sfx"; name: SfxName };

export type Trap = {
  when: When;
  then: Effect[];
  /** Default true — traps fire once. Set false for repeated cycles. */
  once?: boolean;
};

export type Level = {
  id: number;
  title: string;
  /** One line of deadpan flavour, shown on the level card. */
  flavor: string;
  map: string[];
  traps: Trap[];
};

export type SfxName =
  | "jump"
  | "land"
  | "die"
  | "win"
  | "trap"
  | "coin"
  | "flip"
  | "crush";

export type Status = "live" | "dead" | "won";

export type Player = {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  onGround: boolean;
  face: 1 | -1;
  coyote: number;
  buffer: number;
  jumpsLeft: number;
  jumpsUsed: number;
};

export type Saw = {
  x: number;
  y: number;
  r: number;
  axis: "x" | "y";
  range: number;
  speed: number;
  phase: number;
};

export type Crush = {
  x: number;
  y: number;
  w: number;
  h: number;
  dy: number;
  t: number;
  dur: number;
};

export type Message = { text: string; until: number };

export type Snapshot = {
  levelId: number;
  title: string;
  status: Status;
  deaths: number;
  time: number;
  coins: number;
  coinTotal: number;
  message: Message | null;
};
