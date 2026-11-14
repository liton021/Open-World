# How people are making awesome car games with AI right now

A field guide to the actual 2026 workflow — plus the receipts of how this repo
(`Night Drive`) was built the same way.

> Short version: nobody is asking an AI for "a car game" and shipping the output.
> They build **in a loop** — a fast, playable slice first, then they spend their
> time on the three things AI can't feel for them: **driving feel, camera, and
> difficulty**. Everything else (city, cars, HUD, audio, menus) is now mostly
> generated.

---

## 1. The four lanes people actually work in

| Lane | What it is | Tools people use | Ceiling |
|---|---|---|---|
| **Prompt → playable** | Describe a game, get a hosted URL in minutes | Rosebud AI, Astrocade, Cinevva, Websim, Gemini Canvas / Claude artifacts | Great for 2D arcade loops and jam games; small 3D toys |
| **Prompt → code (the one that makes "awesome")** | An agent writes and iterates on real source in your repo | Claude Code, Cursor, Codex, Gemini CLI, this Arena agent | High — you own the code, can optimise, can ship to Steam |
| **Generative assets** | Text/image → 3D models, textures, skies, VO, music | Meshy, Tripo, Rodin for GLB cars; Scenario / Layer for textures; ElevenLabs for voice; Suno / Udio for the soundtrack | Asset pipeline, not gameplay |
| **Engine-side agents** | Assistant inside a real engine project | GDevelop AI, Unity AI, Godot agents (Ziva, Orca), Buildbox 4 | Console/desktop ambitions |

The pattern in every "wow, that's a browser car game?" post is lane 2: a coding
agent plus **three.js** for rendering and **Rapier** (or a hand-written arcade
model) for physics. That is exactly the stack in this repo.

---

## 2. The proof it works (and the honest math)

- **fly.pieter.com** — Pieter Levels prompted a multiplayer browser flight sim
  into existence with Cursor + three.js in February 2025; first playable build in
  about 3 hours, and he reported **$87K MRR / "$1M ARR in 17 days"** from in-game
  billboards and paid planes. Self-reported, and the annualised framing flatters
  it — but the *build* story is real. ([case study](https://www.builtwithagents.ai/strategy/vibe-coded-flight-sim-1m-arr-17-days), [profile](https://indiemakerlist.com/p/pieter-levels/))
- **Vibe Jam** — the jam he started for AI-built browser games; the 2026 edition
  put up **$35,000** in prizes, required ~90% AI-written code, recommended
  three.js, and the hashtag pulled **>21M impressions**. That jam is why your
  timeline filled up with neon drift games. ([write-up](https://gamedevaihub.com/vibe-coding-games/))
- **Directories of playable AI car games** — `The Great Taxi Assignment` (Vibe Jam
  2025 winner, GTA-style taxi runs, three.js), `Neon Zenith` (hover car through a
  9,373-building Kowloon), `Turbo Rumble` (8-player drifting, three.js + Rapier),
  `FULL SEND`, `Draw Line Racing`, `Formula Minus One` (WebGPU). All built with
  Claude Code / Cursor / Codex. ([awesome-ai-built-games](https://github.com/lappemic/awesome-ai-built-games), [134 vibe-coded games](https://www.promptshipped.com/topics/games))
- **The denominator** — Levels' own ledger tracks ~113 projects with ~9 hits.
  Most AI-built games make nothing. The win is **iteration speed**, not a
  guarantee. ([analysis](https://okaneland.com/study/after-the-vibecode-wins-and-denominator/))

---

## 3. The recipe that reliably produces a *good* car game

### Step 0 — pick a slice, not a game
"Open world with missions, cops, traffic, tuning" is a six-month project.
The winning prompts are one paragraph with one mechanic and one goal:

> "Neon rain-soaked city grid at night, one drift-tuned car, collect 40 glowing
> cores before the timer, chained drifts score points, arcade handling."

That is the scope of this repo, and it is playable in one sitting.

### Step 1 — rendering: three.js, and respect the draw call budget
The single biggest difference between a demo that stutters and one that flies:

- **Merge geometry.** Every static building becomes one merged mesh with
  vertex colours — this city is **566 towers in 21 scene objects, 51k triangles**.
- **InstancedMesh** for repeated props (wheels lights poles dashes trees).
- **Fake the lights.** Real point lights per lamp will kill a forward renderer.
  Emissive materials + `UnrealBloomPass` give the neon look for ~free. Lights are
  reserved for: 1 spot (headlights), 1 point (underglow), a handful of signs.
- **Procedural textures from `<canvas>`** (windows, asphalt, billboards) mean zero
  asset downloads and instant load.
- **Post-processing is the "awesome" multiplier**: ACES tone mapping + bloom,
  plus a speed-dependent FOV kick and camera shake. People *feel* speed from FOV
  and streaks, not from the speedometer.

### Step 2 — driving feel: don't simulate, *tune*
People going for realism reach for **Rapier** (`@dimforge/rapier3d-compat`, wasm,
one dynamic body per wheel, fixed 1/60 step). That is right when cars must push
each other, stack, ragdoll.

For a drift game, an **arcade bicycle model** is better and 100× easier to tune:
longitudinal + lateral velocity in the car's frame, lateral grip that you *drop*
on handbrake, a yaw rate that follows steering × speed. The knobs that matter:

| Knob | Effect | Value here |
|---|---|---|
| lateral grip (normal) | how planted it feels | 13.5 |
| lateral grip (handbrake) | drift angle | 3.1 |
| steering lock falloff with speed | stops twitchiness at 200 km/h | 28% at top speed |
| FOV 60 → 72 with speed | perceived velocity | dynamic |
| camera lag behind yaw | weight / drama | 6.2 s⁻¹ chase |

Test it headless: `npm test` runs the physics at 30 and 144 fps and asserts the
car lands in the same place — frame-rate-dependent physics is the #1 "why does
it feel weird on my laptop" bug.

### Step 3 — the parts AI still needs you for
1. **Feel passes.** Drive it for 10 minutes, then change one number. Repeat.
   Grip, camera lag, bloom strength, engine pitch curve.
2. **Failure states.** Respawn key, invisible-wall behaviour, getting stuck on a
   kerb. Agents cheerfully ship a car that pins itself to the map edge at 240 km/h
   (this build did, until a test caught it).
3. **Pacing.** 40 cores across ~1.3 km² is a 4–6 minute run. Tune by playing.

### Step 4 — sound is the cheapest polish
All audio here is **synthesised with the Web Audio API**: a detuned saw+square
"engine" whose frequency tracks fake gear RPM, filtered noise for tyre scrub,
and a 112 BPM synthwave arpeggiator (Am–F–C–G). No files, no licensing, and it
reacts to input in ways a looped sample can't. (Alternative: Suno/ElevenLabs for
a real track and VO.)

### Step 5 — ship a link
`vite build` → GitHub Pages / Vercel / Cloudflare Pages. One link, plays on a
phone (this one has touch controls and auto-drops pixel ratio + bloom if fps
falls under 42).

---

## 4. Prompt shapes that actually work

Agents produce bad games when the prompt is a genre. Give them constraints:

**World**
> "600m × 600m neon city on a 96m grid, 22m roads, buildings as boxes 16–200m
> tall merged into one mesh with vertex colours, canvas-generated window texture
> tiled in real-world scale, no shadows, fog exp2, bloom threshold 0.62."

**Car**
> "Primitive-built low-poly coupe: body, glass cabin, rear wing, splitter, 4
> steerable wheels in groups. Underglow point light. Headlights = spot light with
> no shadow map, intensity 55, angle π/5.5."

**Physics**
> "Arcade drift model in the car's local frame. vLong/vLat split, handbrake drops
> rear grip from 13.5 to 3.1, yaw rate = steer × clamp(speed/26) × 1.42, AABB
> collision vs building list, clamp dt to 33ms."

**Game**
> "40 pickups on road lanes only, 3.6m radius, minimap in canvas with a
> pre-rendered static city layer, drift score = slip × speed banked when the slide
> ends, HUD in DOM not WebGL."

Notice every prompt names a **number, a limit, or an axis of failure**. That's the
difference between "make a cool car game" and something you'd actually play.

---

## 5. What's realistic in 2026

- **Yes:** a 3D open-world-ish browser game with one great mechanic, decent audio,
  a HUD, mobile controls, in a weekend. Absolutely — see this repo.
- **Yes:** a small commercial release on itch.io or Steam from an AI-assisted
  pipeline, with a human doing art direction and balance.
- **No:** a Forza/GTA-scale title from prompts. Full engines, netcode at scale,
  and content volume (hundreds of cars, missions, VO) still need teams.

### Further reading
- [awesome-ai-built-games](https://github.com/lappemic/awesome-ai-built-games) —
  curated, playable, credits the model used per game
- [AI-made browser games directory](https://neongamewall.com/ai-browser-games) — 61 games, creators' own words
- [Vibe coding games 2026](https://gamedevaihub.com/vibe-coding-games/) — tool-by-tool workflow
- [Best AI game generators 2026](https://www.taskade.com/blog/ai-game-generators) — generator vs. coding agent vs. asset tool
- [three.js game building guide](https://rationalgo.ai/resources/app-builder/platforms/build-a-threejs-browser-game-with-ai) — collision/BVH/physics decision table

*Figures like fly.pieter.com's revenue are self-reported by their creators; treat
them as marketing-adjacent. The code, jam entries and playable games are real.*
