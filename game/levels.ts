import type { Level } from "./types";
import { SPEED, TILE, H } from "./constants";

// ---------------------------------------------------------------------------
// Levels.
//
// Geometry is ASCII so a level reads like the room it describes:
//   #  solid        .  empty        =  platform
//   ^  spike up     v  spike down   < >  spike left / right
//   D  the door     ?  a door (allegedly)   o  coin   P  where you start
//
// Authoring rules, derived from the jump arc (apex 3.1 tiles, reach 4.3):
//   • a gap a player must clear is never wider than 2 tiles
//   • a hazard a player must clear is never taller than 1 tile
//   • every trap fires *ahead* of the player, never on top of them
// ---------------------------------------------------------------------------

export const LEVELS: Level[] = [
  {
    id: 1,
    title: "Completely Normal",
    flavor: "Run right. Reach the door. Nothing else happens.",
    map: [
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      ".P..........D...",
      "################",
    ],
    traps: [
      {
        when: { t: "enter", x: 3, y: 0, w: 1, h: 9 },
        then: [
          { e: "vanish", at: [[6, 8], [7, 8]] },
          { e: "sfx", name: "trap" },
          { e: "message", text: "Sorry." },
        ],
      },
    ],
  },
  {
    id: 2,
    title: "The Floor Is A Suggestion",
    flavor: "The ground has decided to stop participating.",
    map: [
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      ".P............D.",
      "################",
    ],
    traps: [
      {
        when: { t: "enter", x: 3, y: 0, w: 1, h: 9 },
        then: [
          { e: "vanish", at: [[5, 8], [6, 8]] },
          { e: "sfx", name: "trap" },
        ],
      },
      {
        when: { t: "enter", x: 8, y: 0, w: 1, h: 9 },
        then: [
          { e: "vanish", at: [[9, 8], [10, 8]] },
          { e: "sfx", name: "trap" },
          { e: "message", text: "Keep moving." },
        ],
      },
    ],
  },
  {
    id: 3,
    title: "Mind The Gap",
    flavor: "Spikes were always there. You just couldn't see them.",
    map: [
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      ".P..........D...",
      "################",
    ],
    traps: [
      {
        when: { t: "enter", x: 3, y: 0, w: 1, h: 9 },
        then: [
          { e: "spike", at: [[6, 7], [7, 7]], dir: "up" },
          { e: "sfx", name: "trap" },
        ],
      },
      {
        when: { t: "enter", x: 8, y: 0, w: 1, h: 9 },
        then: [
          { e: "spike", at: [[10, 7]], dir: "up" },
          { e: "sfx", name: "trap" },
          { e: "message", text: "Just one more." },
        ],
      },
    ],
  },
  {
    id: 4,
    title: "Ceiling Problems",
    flavor: "The room is smaller than you think.",
    map: [
      "################",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      ".P..........D...",
      "################",
    ],
    traps: [
      {
        when: { t: "enter", x: 4, y: 0, w: 1, h: 9 },
        then: [
          { e: "crush", at: [[8, 0], [9, 0]], tiles: 9, dur: 0.55 },
          { e: "sfx", name: "crush" },
          { e: "shake", amount: 10 },
          { e: "message", text: "Duck." },
        ],
      },
    ],
  },
  {
    id: 5,
    title: "The Door Is Right There",
    flavor: "It is. That is the problem.",
    map: [
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      ".P...?...D......",
      "################",
    ],
    traps: [
      {
        when: { t: "decoy" },
        then: [
          { e: "doorTo", at: [14, 7] },
          { e: "spike", at: [[7, 7], [8, 7]], dir: "up" },
          { e: "sfx", name: "trap" },
          { e: "shake", amount: 12 },
          { e: "message", text: "Not that one." },
        ],
      },
    ],
  },
  {
    id: 6,
    title: "Left Is Right",
    flavor: "You have been holding it the wrong way round.",
    map: [
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      ".P..........D...",
      "################",
    ],
    traps: [
      {
        when: { t: "enter", x: 4, y: 0, w: 1, h: 9 },
        then: [
          { e: "flip" },
          { e: "sfx", name: "flip" },
          { e: "shake", amount: 8 },
          { e: "message", text: "No." },
        ],
      },
    ],
  },
  {
    id: 7,
    title: "Gravity Is Optional",
    flavor: "Up is a suggestion. Down is a lifestyle.",
    map: [
      "################",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      ".P..........D...",
      "################",
    ],
    traps: [
      {
        when: { t: "enter", x: 5, y: 0, w: 1, h: 9 },
        then: [
          { e: "gravity", v: -1 },
          { e: "sfx", name: "flip" },
          { e: "shake", amount: 10 },
          { e: "message", text: "The ceiling is a floor now." },
        ],
      },
      {
        when: { t: "enter", x: 10, y: 0, w: 2, h: 3 },
        then: [
          { e: "gravity", v: 1 },
          { e: "sfx", name: "flip" },
          { e: "message", text: "And back." },
        ],
      },
    ],
  },
  {
    id: 8,
    title: "Extra Jumps",
    flavor: "We ran out of floor, so here are some more jumps.",
    map: [
      "................",
      "................",
      "............D...",
      "................",
      "................",
      "................",
      "................",
      ".P..............",
      "################",
    ],
    traps: [
      {
        when: { t: "enter", x: 3, y: 0, w: 1, h: 9 },
        then: [
          { e: "jumps", v: 99 },
          { e: "sfx", name: "trap" },
          { e: "message", text: "Go on, then." },
        ],
      },
    ],
  },
  {
    id: 9,
    title: "Saw Business",
    flavor: "It has a schedule. You are not on it.",
    map: [
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      ".P..........D...",
      "################",
    ],
    traps: [
      {
        when: { t: "enter", x: 4, y: 0, w: 1, h: 9 },
        then: [
          { e: "saw", at: [7, 5], axis: "y", range: 3, speed: 1.5 },
          { e: "sfx", name: "trap" },
        ],
      },
      {
        when: { t: "enter", x: 9, y: 0, w: 1, h: 9 },
        then: [
          { e: "saw", at: [11, 3], axis: "y", range: 4, speed: 1.9 },
          { e: "sfx", name: "trap" },
          { e: "message", text: "Two of them. Sorry." },
        ],
      },
    ],
  },
  {
    id: 10,
    title: "The Last One",
    flavor: "Everything you have learned, used against you at once.",
    map: [
      "################",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      ".P..........D...",
      "################",
    ],
    traps: [
      {
        when: { t: "enter", x: 3, y: 0, w: 1, h: 9 },
        then: [
          { e: "vanish", at: [[6, 8], [7, 8]] },
          { e: "sfx", name: "trap" },
          { e: "message", text: "Almost." },
        ],
      },
      {
        when: { t: "enter", x: 10, y: 0, w: 1, h: 9 },
        then: [
          { e: "flip" },
          { e: "doorTo", at: [15, 7] },
          { e: "sfx", name: "flip" },
          { e: "shake", amount: 14 },
          { e: "message", text: "Wrong way." },
        ],
      },
    ],
  },
];

export const TOTAL_LEVELS = LEVELS.length;

/** Obstacle heights/widths a player must clear, for the level checker. */
export const SAFE_GAP_TILES = 2;
export const JUMP_REACH_PX = (2 * 860) / 2400 * SPEED * 0.92;
export const VOID_Y = H + 80;
export const TILE_PX = TILE;
