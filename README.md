# Night Drive 🌃🏎️

An open-world neon car game that runs in the browser — **built end to end by an AI agent**.

No downloaded models, no image files, no audio files. The city, the car, the
textures, the soundtrack and the physics are all generated at runtime from
`three.js` + Web Audio.

```
npm install
npm run dev      # http://localhost:5173
npm test         # headless physics + world + traffic checks
npm run build    # static build in dist/
```

| Drive | |
|---|---|
| `W A S D` / arrows | throttle, brake, steer |
| `Space` | handbrake — the drift button |
| `Shift` | boost (regenerating) |
| `C` | cycle camera: chase · far · hood · drift |
| `R` | respawn |
| `M` | mute |

**Goal:** collect all 40 neon cores before the clock runs out. Chained drifts
bank points; crashing scatters them. Touch controls appear on phones.

---

## What's in here

| File | What it does |
|---|---|
| `src/world.js` | Procedural city: 96 m grid, **566 towers merged into one mesh (51k tris, 21 draw calls)**, canvas-generated window/asphalt/billboard textures, neon signs, parks, sky dome, stars, moon |
| `src/car.js` | Low-poly hero car from primitives + the arcade drift model (grip/slip in the car's frame, AABB collisions, handbrake grip drop) |
| `src/traffic.js` | 26 ambient cars on lane splines that brake for you, plus player↔traffic collision resolve |
| `src/cores.js` | 40 pickups placed on road lanes, no per-core lights |
| `src/effects.js` | GPU point-sprite pools: tyre smoke, brake sparks, boost streaks, camera shake |
| `src/audio.js` | Fully synthesised engine (RPM-tracking saw/square), tyre scrub, crash, and a 112 BPM synthwave arpeggiator |
| `src/hud.js` | DOM HUD + canvas minimap with a pre-rendered static city layer |
| `src/main.js` | Renderer, PMREM environment, bloom, 4 cameras, input, game state, auto-quality |
| `tests/` | Headless Node tests: physics behaviour, frame-rate independence, city budgets, pickup logic, traffic |

## Performance notes

Forward rendering in a night city is a light-budget problem, so: emissive
materials + `UnrealBloomPass` instead of hundreds of point lights, merged static
geometry, `InstancedMesh` for lamps/tyres/trees, no shadow maps, and an
auto-quality throttle that drops pixel ratio and bloom if fps falls below 42.

## How this was made

It's a demonstration of the current AI game-making workflow — a coding agent
writing real `three.js` source, iterating against headless tests, with the human
providing the *feel* decisions. The full write-up, with sources on what people
are shipping right now:

➡️ **[docs/MAKING-AN-AI-CAR-GAME.md](docs/MAKING-AN-AI-CAR-GAME.md)**

## License

MIT
