# NICE TRY

> A completely fair platformer.

Reach the door. The room disagrees. Ten one-screen levels, instant respawns, and
no unfair surprises whatsoever.

---

## What this is

A troll platformer in the spirit of **Level Devil** (Unept, 2023) — the viral
browser/Steam game built entirely on betraying your expectations. The design
principles it inherits:

- **One screen per room.** A death costs ~2 seconds, not 2 minutes. That short
  loop is what turns frustration into "one more try".
- **Traps fire on proximity, not on a timer.** The level reacts to where you
  are, so memorising a static layout is useless.
- **The room may lie, but it may never cheat.** Every trap gives you somewhere
  to be. Nothing is allowed to materialise underneath you.

The last point is the whole design, and it is enforced by a test.

## Play it

**[nice-try-tau.vercel.app](https://nice-try-tau.vercel.app)**

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm run check:levels # verify all levels are beatable and fair
npm run build
```

## Deploying

Hosted on Vercel as project `nice-try`. Pushes to `main` can be deployed from
the git repo:

```bash
# deploy the current state of main
vercel deploy --prod
```

Note: the Vercel GitHub integration is authorised as a different account
(`onelitonbd`) than the repo owner (`liton021`), so automatic push-to-deploy is
not wired up. Until that's connected, deploy by triggering a git deployment of
`main` (that's how the live build was made — commit `5973d11`).

## Controls

| Action | Keys |
| --- | --- |
| Move | `←` `→` or `A` `D` |
| Jump | `Space`, `W`, or `↑` |
| Retry level | `R` |
| Pause | `P` / `Esc` |
| Next level | `Enter` (when cleared) |

Touch controls appear automatically on phones. Short-tap jump for a small hop,
hold for full height.

## How it's built

The interesting decision is that **the engine is pure and separate from React**.

```
game/
  constants.ts   world size + feel (tuned, then verified numerically)
  types.ts       the trap language: When → Effect
  engine.ts      the simulation. No React, no DOM, no canvas.
  levels.ts      levels as ASCII maps + declarative traps
  render.ts      canvas painting, reads engine state
  audio.ts       all sound synthesised at runtime (no asset files)
app/
  hooks/useGame  fixed-step loop, input, level lifecycle
  components/    canvas stage + overlays
scripts/
  check-levels   the test suite
```

**Levels are data.** A room is an ASCII map and a list of traps:

```ts
{
  when: { t: "enter", x: 3, y: 0, w: 1, h: 9 },   // player crosses x=3
  then: [
    { e: "vanish", at: [[6, 8], [7, 8]] },        // floor drops out
    { e: "message", text: "Sorry." },
  ],
}
```

That means a new trap type is one entry in a union, and a new level is a string
literal — not a thousand-line update loop.

**Physics is fixed-step** at 120Hz, so behaviour is identical on a 60Hz and a
144Hz display. The render loop runs on `requestAnimationFrame` and only *reads*
the engine; React re-renders solely on coarse changes (level, status, deaths,
coins), never on a physics frame.

## The jump arc, and why it's documented

Every gap and hazard in every level is authored against measured numbers, not
vibes:

| | Value |
| --- | --- |
| Jump apex | **3.01 tiles** (150.5px) |
| Air time | **0.708s** |
| Horizontal reach | **4.25 tiles** (212.5px) |
| Short hop (tap) | **2.15 tiles** (107.8px) |

Authoring rules that fall out of this:

- a gap you must clear is **never wider than 2 tiles** (you can reach 4.25)
- a hazard you must clear is **never taller than 1 tile** (you can apex 3.01)
- a trap always fires **ahead** of you, never on top of you

## The test suite

`npm run check:levels` simulates a competent player through every level and
asserts three things independently:

1. **Structure** — the ASCII map is well formed; every trap points at a real
   tile; no trap crowds the door.
2. **Fairness** — no deadly hazard ever appears inside the player's body. This
   is the line between a troll and a cheat.
3. **Beatability** — a simulated player actually clears the room within 90s.

It also has to teach the bot to *use air jumps*, which is how level 8 was
validated: the door sits 3 tiles up and needs a chained double jump. Current
state:

```
✓  1 "Completely Normal"         cleared in 1.7s
✓  2 "The Floor Is A Suggestion" cleared in 2.1s
✓  3 "Mind The Gap"              cleared in 1.8s
✓  4 "Ceiling Problems"          cleared in 3.0s
✓  5 "The Door Is Right There"   cleared in 2.1s
✓  6 "Left Is Right"             cleared in 1.8s
✓  7 "Gravity Is Optional"       cleared in 2.0s
✓  8 "Extra Jumps"               cleared in 1.9s
✓  9 "Saw Business"              cleared in 2.6s
✓ 10 "The Last One"              cleared in 2.3s

levels 10 · unfair 0 · unclear 0
```

## Trap types implemented

Collapsing floor · pop-up spikes · falling ceiling/crusher · vanishing
platforms · fleeing exit door · decoy door · control reversal · gravity
inversion · air-jump grants · swinging saws · teleport (warp) · jump booster.

## Roadmap

- [ ] 40+ levels across three worlds, escalating by combining trap types
- [ ] Hidden collectible keys that unlock a secret final room
- [ ] Level editor + shareable level strings (levels are already pure data)
- [ ] Local 2-player race (shared trap triggers, first to the door)
- [ ] Global death counter, because that number is funny

## Notes

- No web fonts, no CDN assets — everything is system fonts, canvas drawing, and
  synthesised audio, so it renders identically offline.
- Palette is deliberately warm. The joke only lands if the room looks
  trustworthy right up until it isn't.

---

*Inspired by Level Devil by Adam Corey (Unept). This is an original
implementation, not a copy — no assets, code, or level layouts were reused.*
