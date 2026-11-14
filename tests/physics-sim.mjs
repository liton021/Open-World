import * as THREE from 'three';
import { CarPhysics, createCar } from '../src/car.js';

// stub world: a blocker building at the origin + city bounds, like CityWorld
const world = { bounds: 672, colliders: [{ minX: -20, maxX: 20, minZ: -20, maxZ: 20, h: 50 }] };
const car = createCar();
const p = new CarPhysics(car, world);
const dt = 1 / 60;
const idle = { gas: false, brake: false, steer: 0, drift: false, boost: false };

function run(seconds, inputFn = () => ({})) {
  for (let i = 0, n = Math.round(seconds / dt); i < n; i++) p.update(dt, { ...idle, ...inputFn(i * dt) });
}

const ok = (label, cond, detail) => console.log(`${cond ? 'PASS' : 'FAIL'}  ${label.padEnd(26)} ${detail}`);

// 1. acceleration curve
p.reset(0, 300, Math.PI);
run(6, () => ({ gas: true }));
ok('accelerate 6s', p.speedKmh > 150 && p.speedKmh < 260, `${p.speedKmh.toFixed(0)} km/h`);

// 2. boost accelerates harder than plain throttle (measured from a standstill,
//    in the middle of the map so we don't run out of road)
p.reset(0, 0, Math.PI);
run(2, () => ({ gas: true }));
const plain = p.speedKmh;
p.reset(0, 0, Math.PI);
run(2, () => ({ gas: true, boost: true }));
ok('boost', p.speedKmh > plain + 8, `2s: ${plain.toFixed(0)} plain vs ${p.speedKmh.toFixed(0)} boosting, tank ${p.boost.toFixed(2)}`);

// 3. drifting produces a slip angle and a drift score signal
p.reset(0, 0, Math.PI);
run(5, () => ({ gas: true }));
run(1.6, () => ({ gas: true, steer: 1, drift: true }));
ok('handbrake drift', p.driftAmount > 0.2 && Math.abs(p.driftAngle) > 0.15,
  `slip ${(p.driftAngle * 180 / Math.PI).toFixed(0)}deg, amount ${p.driftAmount.toFixed(2)}`);

// 4. no drift when driving straight
p.reset(0, 0, Math.PI);
run(5, () => ({ gas: true }));
ok('grip when straight', p.driftAmount < 0.02, `slip ${(p.driftAngle * 180 / Math.PI).toFixed(2)}deg`);

// 5. braking stops the car, then reverses
p.reset(0, 0, Math.PI);
run(5, () => ({ gas: true }));
const top = p.speedKmh;
run(2.2, () => ({ brake: true }));
const stopped = p.speedKmh;
run(2.5, () => ({ brake: true }));
ok('brake then reverse', stopped < top && p.vLong < -5, `${top.toFixed(0)} -> ${stopped.toFixed(0)} -> reverse ${p.vLong.toFixed(1)} m/s`);

// 6. a building actually blocks the car
p.reset(0, 120, Math.PI); // facing -Z, building at the origin
run(10, () => ({ gas: true }));
const inside = Math.abs(p.pos.x) < 20 + 1.3 && Math.abs(p.pos.y) < 20 + 1.3;
ok('building collision', !inside && p.pos.y > 20, `resting at z=${p.pos.y.toFixed(1)} (wall is z=20)`);

// 7. map edge is a hard wall
p.reset(0, 600, 0);
run(6, () => ({ gas: true, boost: true }));
ok('map edge', p.pos.y <= 672 && p.pos.y > 660, `y=${p.pos.y.toFixed(1)}, speed ${p.speedKmh.toFixed(0)}`);

// 8. 120 s of chaos never produces NaN
p.reset(0, 300, Math.PI);
let nan = false;
let maxSpeed = 0;
for (let i = 0; i < 60 * 120; i++) {
  p.update(dt, {
    gas: Math.random() > 0.2,
    brake: Math.random() > 0.9,
    steer: Math.random() * 2 - 1,
    drift: Math.random() > 0.7,
    boost: Math.random() > 0.7,
  });
  maxSpeed = Math.max(maxSpeed, p.speedKmh);
  if (!Number.isFinite(p.pos.x + p.pos.y + p.yaw)) { nan = true; break; }
}
ok('120s random input', !nan && maxSpeed < 400, `finite=${!nan}, peak ${maxSpeed.toFixed(0)} km/h`);

// 9. frame-rate independence: 30fps vs 144fps should land in the same place
function drive(fps) {
  const q = new CarPhysics(createCar(), world);
  q.reset(0, 300, Math.PI);
  const d = 1 / fps;
  for (let i = 0; i < fps * 4; i++) q.update(d, { ...idle, gas: true, steer: 0.4 });
  return q;
}
const a = drive(30);
const b = drive(144);
const drift = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y);
ok('30 vs 144 fps', drift < 45, `${drift.toFixed(1)}m apart after 4s`);
