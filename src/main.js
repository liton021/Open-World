import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { CityWorld, CITY_LIMIT } from './world.js';
import { createCar, CarPhysics } from './car.js';
import { Cores } from './cores.js';
import { Traffic } from './traffic.js';
import { Effects } from './effects.js';
import { GameAudio } from './audio.js';
import { Hud } from './hud.js';

// ---------------------------------------------------------------------------
// Renderer / scene
// ---------------------------------------------------------------------------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 3000);

// night lighting: cool moon key + magenta rim
const hemi = new THREE.HemisphereLight(0x5f7bff, 0x2a0f33, 0.55);
scene.add(hemi);
const moonKey = new THREE.DirectionalLight(0x9fc4ff, 0.85);
moonKey.position.set(-120, 220, -160);
scene.add(moonKey);
const rim = new THREE.DirectionalLight(0xff2fd0, 0.5);
rim.position.set(160, 90, 180);
scene.add(rim);

// cheap procedural environment map so paint has something to reflect
(function buildEnvMap() {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x05060d);
  const geo = new THREE.BoxGeometry();
  const colors = [0x1a2f6b, 0x3b1350, 0x0a1230, 0x5b1450, 0x102b4a, 0x241040];
  colors.forEach((c, i) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: c, side: THREE.BackSide }));
    m.position.set((i % 2 ? 1 : -1) * 30, 0, 0);
    envScene.add(m);
  });
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(40, 16, 8),
    new THREE.MeshBasicMaterial({ color: 0x0a1030, side: THREE.BackSide })
  );
  envScene.add(sky);
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 6),
    new THREE.MeshBasicMaterial({ color: 0x37f8ff })
  );
  strip.position.set(0, 14, -26);
  envScene.add(strip);
  const strip2 = strip.clone();
  strip2.material = new THREE.MeshBasicMaterial({ color: 0xff2fd0 });
  strip2.position.set(0, 6, 26);
  envScene.add(strip2);

  const tex = pmrem.fromScene(envScene, 0.06).texture;
  scene.environment = tex;
  pmrem.dispose();
})();

// ---------------------------------------------------------------------------
// World, car, effects
// ---------------------------------------------------------------------------
const world = new CityWorld(scene);

const car = createCar(0xff2f6d);
// headlights are the most expensive thing in a forward renderer; keep only
// the underglow point light + a single spot light with no shadow map
car.userData.spot.castShadow = false;
car.userData.spot.intensity = 55;
scene.add(car);
const physics = new CarPhysics(car, world);
physics.reset(6, 300, Math.PI);

const cores = new Cores(scene, 40, CITY_LIMIT - 40);
const traffic = new Traffic(scene, 26);
const effects = new Effects(scene, camera);

const audio = new GameAudio();
const hud = new Hud(world, cores, CITY_LIMIT);

// postprocessing
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.72,  // strength
  0.62,  // radius
  0.62   // threshold
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
const keys = Object.create(null);
const input = { gas: false, brake: false, steer: 0, drift: false, boost: false };

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyC') cycleCamera();
  if (e.code === 'KeyR') respawn();
  if (e.code === 'KeyM') {
    const muted = audio.toggleMute();
    hud.callout(muted ? 'sound off' : 'sound on', 1200);
  }
  if (!started && (e.code === 'Enter' || e.code === 'Space')) begin();
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

// touch buttons
document.querySelectorAll('.tbtn').forEach((btn) => {
  const key = btn.dataset.key;
  const map = { left: 'ArrowLeft', right: 'ArrowRight', gas: 'ArrowUp', brake: 'ArrowDown', drift: 'Space' };
  const on = (e) => {
    e.preventDefault();
    keys[map[key]] = true;
    btn.classList.add('on');
  };
  const off = (e) => {
    e.preventDefault();
    keys[map[key]] = false;
    btn.classList.remove('on');
  };
  btn.addEventListener('touchstart', on, { passive: false });
  btn.addEventListener('touchend', off);
  btn.addEventListener('touchcancel', off);
  btn.addEventListener('mousedown', on);
  btn.addEventListener('mouseup', off);
  btn.addEventListener('mouseleave', off);
});

function readInput() {
  const left = keys['KeyA'] || keys['ArrowLeft'];
  const right = keys['KeyD'] || keys['ArrowRight'];
  const up = keys['KeyW'] || keys['ArrowUp'];
  const down = keys['KeyS'] || keys['ArrowDown'];

  // keyboard steering lerps so it doesn't feel binary
  const steerTarget = (left ? -1 : 0) + (right ? 1 : 0);
  input.steer += (steerTarget - input.steer) * 0.24;

  input.gas = !!up;
  input.brake = !!down;
  input.drift = !!keys['Space'];
  input.boost = !!(keys['ShiftLeft'] || keys['ShiftRight']);
  return input;
}

// ---------------------------------------------------------------------------
// Cameras
// ---------------------------------------------------------------------------
const CAMERAS = ['chase', 'far', 'hood', 'drift'];
let camIndex = 0;
const camPos = new THREE.Vector3(0, 6, 14);
const camLook = new THREE.Vector3();

function cycleCamera() {
  camIndex = (camIndex + 1) % CAMERAS.length;
  hud.callout(`camera · ${CAMERAS[camIndex]}`, 1100);
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();

function updateCamera(dt, carPos) {
  const mode = CAMERAS[camIndex];
  const yaw = physics.yaw;
  const back = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)); // car forward
  const speed = physics.speedKmh;
  const speedT = Math.min(speed / 240, 1);

  let desired = _v1;
  let lookAt = _v2;

  if (mode === 'hood') {
    desired.set(carPos.x + back.x * 0.4, 1.55, carPos.z + back.z * 0.4);
    lookAt.set(carPos.x + back.x * 30, 1.5, carPos.z + back.z * 30);
    camPos.lerp(desired, 1 - Math.exp(-dt * 22));
    camLook.lerp(lookAt, 1 - Math.exp(-dt * 16));
  } else {
    const dist = mode === 'far' ? 19 : 11.2;
    const height = mode === 'far' ? 10.5 : 5.3;
    let lag = 0;

    if (mode === 'drift') {
      // lock the camera to velocity direction so drifts read as slides
      const velYaw = Math.atan2(physics.vel.x, physics.vel.y);
      const blend = Math.min(1, physics.vel.length() / 12);
      lag = THREE.MathUtils.lerp(yaw, velYaw, blend * 0.85);
    } else {
      lag = yaw - physics.angVel * 0.09;
    }

    const dir = new THREE.Vector3(Math.sin(lag), 0, Math.cos(lag));
    const d = dist + speedT * 2.6;
    const h = height - speedT * 0.7;

    desired.set(carPos.x - dir.x * d, h, carPos.z - dir.z * d);
    lookAt.set(carPos.x + dir.x * 9, 1.5, carPos.z + dir.z * 9);

    const follow = mode === 'far' ? 3.6 : 6.2;
    camPos.lerp(desired, 1 - Math.exp(-dt * follow));
    camLook.lerp(lookAt, 1 - Math.exp(-dt * 9));
  }

  // keep the camera out of buildings (cheap: push up if inside a collider)
  for (const b of world.colliders) {
    if (camPos.x > b.minX - 1 && camPos.x < b.maxX + 1 && camPos.z > b.minZ - 1 && camPos.z < b.maxZ + 1) {
      camPos.y = Math.max(camPos.y, b.h + 4);
    }
  }

  camera.position.copy(camPos);
  camera.lookAt(camLook);

  // FOV kick with speed + boost
  const targetFov = 60 + speedT * 12 + (physics.boosting ? 9 : 0);
  camera.fov += (targetFov - camera.fov) * Math.min(dt * 4, 1);
  camera.updateProjectionMatrix();

  // shake
  const shake = effects.shake;
  if (shake > 0.001) {
    camera.position.x += (Math.random() - 0.5) * shake * 0.9;
    camera.position.y += (Math.random() - 0.5) * shake * 0.7;
    camera.rotation.z += (Math.random() - 0.5) * shake * 0.04;
  }
}

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------
let started = false;
let running = false;
let title = true;
let finishing = false;
let finishTimer = 0;
let elapsed = 0;
let score = 0;
let driftCharge = 0;
let driftRun = 0;
let driftTimer = 0;
let comboTimer = 0;
let coresCollected = 0;
let finished = false;

const clock = new THREE.Clock();

function begin() {
  if (started) return;
  started = true;
  running = true;
  title = false;
  document.getElementById('overlay').classList.add('hidden');
  hud.show();
  // hand the camera over cleanly instead of flying 500m in from the orbit
  camPos.set(physics.pos.x - Math.sin(physics.yaw) * 12, 5.3, physics.pos.y - Math.cos(physics.yaw) * 12);
  camLook.set(physics.pos.x, 1.5, physics.pos.y);
  audio.init();
  audio.resume();
  hud.callout('collect 40 neon cores · drift for points', 3800);
}

function respawn() {
  physics.reset(6, 300, Math.PI);
  camPos.set(6, 8, 315);
  camLook.set(6, 1.5, 300);
  driftRun = 0;
  driftTimer = 0;
  if (running) hud.callout('respawned', 1100);
}

document.getElementById('start-btn').addEventListener('click', begin);
document.getElementById('guide-btn').addEventListener('click', () => {
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('guide').classList.remove('hidden');
});
document.getElementById('guide-close').addEventListener('click', () => {
  document.getElementById('guide').classList.add('hidden');
  document.getElementById('overlay').classList.remove('hidden');
});

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.resolution.set(w, h);
}
window.addEventListener('resize', onResize);

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
let visualTime = 0;
// Cores work in world (x,z); physics keeps a Vector2 where .y is world z.
const playerXZ = { x: 0, z: 0 };
function syncPlayerXZ() {
  playerXZ.x = physics.pos.x;
  playerXZ.z = physics.pos.y;
  return playerXZ;
}

function frame() {
  requestAnimationFrame(frame);
  frames++;
  const dt = Math.min(clock.getDelta(), 0.05);
  const inp = running ? readInput() : IDLE;

  // ---- simulation ----
  physics.update(dt, inp);
  visualTime += dt;

  if (running) {
    elapsed += dt;
    updateGameLogic(dt, inp);
  } else if (finishing) {
    // let the car roll to a stop behind the results panel
    finishTimer += dt;
    if (finishTimer > 2.4) {
      finishing = false;
      showResults();
    }
  }

  // ---- presentation ----
  const carPos = new THREE.Vector3(physics.pos.x, 0, physics.pos.y);
  if (title) titleCamera(dt);
  else updateCamera(dt, carPos);

  syncPlayerXZ();
  cores.update(dt, visualTime, playerXZ);
  traffic.update(dt, physics.pos);
  traffic.collide(physics);
  effects.update(dt, {
    car,
    drifting: physics.drifting,
    driftAmount: physics.driftAmount,
    speed: physics.vel.length(),
    boosting: physics.boosting,
    input: inp,
  });
  world.update(dt);

  if (!title && cores.remaining === 0) finishRun();

  const bloomTarget = physics.boosting ? bloomBase * 1.3 : bloomBase;
  bloom.strength += (bloomTarget - bloom.strength) * Math.min(dt * 3, 1);

  const nearest = cores.nearest(playerXZ);
  const gearLabel =
    physics.speedKmh < 1 ? 'N' : physics.vLong < -1 ? 'R' : String(Math.min(6, 1 + Math.floor(physics.speedKmh / 42)));

  hud.update({
    speedKmh: physics.speedKmh,
    gear: gearLabel,
    time: elapsed,
    cores: coresCollected,
    driftCharge,
    boost: physics.boost,
    score,
    car: physics,
    nearestCore: nearest,
    boosting: physics.boosting,
  });

  audio.updateEngine({
    speedKmh: physics.speedKmh,
    throttle: inp.gas,
    drifting: physics.drifting && physics.speedKmh > 20,
    boost: physics.boosting,
  });

  composer.render();
}

function updateGameLogic(dt, inp) {
  // --- pickups ---
  const hit = cores.checkPickup(playerXZ);
  if (hit) {
    coresCollected++;
    score += 100;
    effects.burst(hit.pos, hit.color.getHex(), 30);
    effects.impact(0.25);
    hud.flash();
    hud.callout(`core ${coresCollected}/40 · ${cores.remaining} left`, 1400);
    audio.pickup(Math.min(coresCollected, 12));
  }

  // --- drift scoring: bank the run when the slide ends ---
  const drifting = physics.drifting && physics.speedKmh > 28 && physics.driftAmount > 0.18;
  if (drifting) {
    driftCharge = Math.min(1, driftCharge + dt * 0.5);
    driftRun += dt * physics.driftAmount * physics.speedKmh * 0.5;
    driftTimer += dt;
    comboTimer = 1.6;
  } else {
    driftCharge = Math.max(0, driftCharge - dt * 0.35);
    comboTimer -= dt;
    if (driftTimer > 0.55 && driftRun > 80 && comboTimer <= 0) {
      const banked = Math.round(driftRun * (1 + Math.min(driftCharge, 0.5)));
      score += banked;
      hud.driftPop(banked);
      driftRun = 0;
      driftTimer = 0;
    }
  }

  // --- crash feedback ---
  if (physics.impact > 0.35 && !physics._crashed) {
    effects.impact(physics.impact * 0.8);
    audio.crash(Math.min(1, physics.impact + 0.2));
    hud.flash();
    physics._crashed = true;
    setTimeout(() => (physics._crashed = false), 320);
  }
}

const IDLE = { gas: false, brake: false, steer: 0, drift: false, boost: false };

function finishRun() {
  if (finished || !running) return;
  finishing = true;
  finishTimer = 0;
  running = false;
  finished = true;
  hud.callout('city cleaned — nice driving', 2600);
  audio.pickup(14);
}

function showResults() {
  const panel = document.querySelector('#overlay .panel');
  panel.innerHTML = `
    <p class="eyebrow">run complete</p>
    <h1 style="font-size:clamp(38px,9vw,68px)">ALL 40<span>CORES</span></h1>
    <p class="tagline">You cleaned the city in <b style="color:#37f8ff">${elapsed.toFixed(1)}s</b>
    with a drift score of <b style="color:#ff2fd0">${score.toLocaleString()}</b>.
    The whole world was generated at runtime — reload for a new spawn order.</p>
    <button class="cta" onclick="location.reload()">DRIVE AGAIN</button>
  `;
  document.getElementById('overlay').classList.remove('hidden');
  hud.el.hud.classList.add('hidden');
}

// ---------------------------------------------------------------------------
// auto-quality — a laptop iGPU should still hold 60fps in a 500-tower city
// ---------------------------------------------------------------------------
let frames = 0;
let qualityLevel = 2;
let bloomBase = 0.72;

setInterval(() => {
  const fps = frames / 2;
  frames = 0;
  if (fps < 42 && qualityLevel > 0) {
    qualityLevel--;
    if (qualityLevel === 1) {
      renderer.setPixelRatio(1);
      bloomBase = 0.5;
    } else {
      bloom.enabled = false;
    }
    onResize();
  }
}, 2000);

// title screen: slow orbit around the downtown core
let titleAngle = 0;
function titleCamera(dt) {
  titleAngle += dt * 0.045;
  const r = 520;
  camPos.set(Math.cos(titleAngle) * r, 210 + Math.sin(titleAngle * 0.7) * 26, Math.sin(titleAngle) * r);
  camLook.set(0, 46, 0);
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  camera.fov = 55;
  camera.updateProjectionMatrix();
}
titleCamera(0);
frame();

// expose for debugging in the console
window.__nightdrive = { scene, camera, renderer, physics, world, cores, bloom };
