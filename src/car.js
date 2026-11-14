import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Low-poly hero car, assembled from primitives. No GLB, no textures.
// ---------------------------------------------------------------------------
export function createCar(color = 0xff2f6d) {
  const group = new THREE.Group();
  group.name = 'car';
  // everything visual lives in `body`, so body roll never tilts the wheels
  const body = new THREE.Group();
  group.add(body);

  const paint = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.86,
    roughness: 0.28,
    envMapIntensity: 1.6,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x0a1220,
    metalness: 0.95,
    roughness: 0.08,
    transparent: true,
    opacity: 0.82,
    envMapIntensity: 2,
  });
  const trim = new THREE.MeshStandardMaterial({ color: 0x14181f, metalness: 0.6, roughness: 0.5 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0c0d11, roughness: 0.92, metalness: 0.05 });
  const rim = new THREE.MeshStandardMaterial({ color: 0xc8d6e6, metalness: 1, roughness: 0.2 });
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xbdf3ff,
    emissiveIntensity: 3.2,
    toneMapped: false,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0x330008,
    emissive: 0xff1a3c,
    emissiveIntensity: 3.4,
    toneMapped: false,
  });

  // ---- main body: a lofted wedge made from a few stacked boxes ----
  const lower = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.52, 4.3), paint);
  lower.position.y = 0.62;
  lower.castShadow = true;
  body.add(lower);

  const midGeo = new THREE.BoxGeometry(1.86, 0.42, 4.05);
  const mid = new THREE.Mesh(midGeo, paint);
  mid.position.set(0, 0.99, -0.05);
  body.add(mid);

  // nose taper
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.34, 1.1), paint);
  nose.position.set(0, 0.78, 1.72);
  nose.rotation.x = -0.12;
  body.add(nose);

  // cabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.5, 2.0), glass);
  cabin.position.set(0, 1.34, -0.22);
  cabin.scale.set(1, 1, 1);
  body.add(cabin);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 1.62), paint);
  roof.position.set(0, 1.6, -0.3);
  body.add(roof);

  // windshield / rear glass slabs give the silhouette a slope
  const wind = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.1, 0.9), glass);
  wind.position.set(0, 1.52, 0.62);
  wind.rotation.x = 0.62;
  body.add(wind);

  const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.8), glass);
  rearGlass.position.set(0, 1.5, -1.22);
  rearGlass.rotation.x = -0.62;
  body.add(rearGlass);

  // splitter + diffuser
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.09, 0.5), trim);
  splitter.position.set(0, 0.38, 2.12);
  body.add(splitter);
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.22, 0.4), trim);
  diffuser.position.set(0, 0.42, -2.18);
  body.add(diffuser);

  // rear wing
  const wingPostL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.36, 0.14), trim);
  wingPostL.position.set(-0.62, 1.02, -1.98);
  body.add(wingPostL);
  const wingPostR = wingPostL.clone();
  wingPostR.position.x = 0.62;
  body.add(wingPostR);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.07, 0.52), trim);
  wing.position.set(0, 1.24, -2.04);
  wing.rotation.x = -0.08;
  body.add(wing);

  // head + tail lights
  for (const sx of [-0.66, 0.66]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.1), headMat);
    hl.position.set(sx, 0.84, 2.24);
    body.add(hl);
  }
  const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.11, 0.08), tailMat);
  tailBar.position.set(0, 0.92, -2.21);
  body.add(tailBar);

  // underglow
  const underglow = new THREE.PointLight(0x37f8ff, 9, 10, 2);
  underglow.position.set(0, 0.28, 0);
  body.add(underglow);

  // ---- wheels ----
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 20);
  wheelGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.34, 12);
  rimGeo.rotateZ(Math.PI / 2);
  const wheelPivots = [];
  const offsets = [
    [-0.92, 0.42, 1.44],
    [0.92, 0.42, 1.44],
    [-0.95, 0.42, -1.42],
    [0.95, 0.42, -1.42],
  ];
  offsets.forEach(([x, y, z], i) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    const spin = new THREE.Group();
    const tyre = new THREE.Mesh(wheelGeo, rubber);
    tyre.castShadow = true;
    const hub = new THREE.Mesh(rimGeo, rim);
    spin.add(tyre, hub);
    pivot.add(spin);
    group.add(pivot);
    wheelPivots.push(pivot);
    wheels.push(spin);
  });

  // headlight cones
  const spot = new THREE.SpotLight(0xcdefff, 70, 74, Math.PI / 5.5, 0.55, 1.4);
  spot.position.set(0, 0.9, 2.1);
  const target = new THREE.Object3D();
  target.position.set(0, -0.4, 40);
  group.add(spot, target);
  spot.target = target;

  group.userData = { body, wheels, wheelPivots, tailMat, headMat, underglow, paint, spot };
  return group;
}

// ---------------------------------------------------------------------------
// Arcade drift physics — a small "bicycle model" with grip/slip terms.
// Fast, predictable, and it drifts on demand. (This is what racing games
// actually ship instead of full rigid-body tyre sims.)
// ---------------------------------------------------------------------------
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export class CarPhysics {
  constructor(car, world) {
    this.car = car;
    this.world = world;

    this.pos = new THREE.Vector2(0, 0);
    this.vel = new THREE.Vector2(0, 0);
    this.yaw = Math.PI;            // facing +Z? we start facing -Z
    this.angVel = 0;
    this.steer = 0;

    // tuning
    this.maxSteer = 0.62;
    this.engineForce = 30;
    this.brakeForce = 42;
    this.reverseForce = 13;
    this.maxSpeed = 68;            // m/s ~ 245 km/h
    this.boostMaxSpeed = 92;
    this.drag = 0.0016;
    this.rollResist = 0.55;

    this.gripRear = 13.5;
    this.driftGripRear = 3.1;

    this.wheelBase = 2.86;
    this.trackHalf = 0.95;

    this.boost = 1;                 // 0..1
    this.boosting = false;
    this.drifting = false;
    this.driftAngle = 0;
    this.speedKmh = 0;
    this.wheelSpin = 0;
    this.radius = 1.35;

    this.impact = 0;
  }

  reset(x = 0, z = 0, yaw = Math.PI) {
    this.pos.set(x, z);
    this.vel.set(0, 0);
    this.yaw = yaw;
    this.angVel = 0;
    this.steer = 0;
    this.boost = 1;
    this.boostCooldown = 0;
  }

  get forward() {
    return new THREE.Vector2(Math.sin(this.yaw), Math.cos(this.yaw));
  }
  get right() {
    return new THREE.Vector2(Math.cos(this.yaw), -Math.sin(this.yaw));
  }

  update(dt, input) {
    // clamp dt so tab-switches don't teleport the car
    dt = Math.min(dt, 0.033);

    const fwd = this.forward;
    const right = this.right;

    let vLong = this.vel.dot(fwd);
    let vLat = this.vel.dot(right);

    // ---- steering: rate-limited toward the input, less lock at speed ----
    const speedFactor = 1 - clamp(Math.abs(vLong) / 85, 0, 0.72);
    const targetSteer = input.steer * this.maxSteer * speedFactor;
    const steerRate = 4.6;
    this.steer += clamp(targetSteer - this.steer, -steerRate * dt, steerRate * dt);

    // ---- engine / brakes ----
    const boosting = input.boost && this.boost > 0.02 && vLong > 2;
    const boostAccel = boosting ? 26 : 0;
    if (boosting) {
      this.boost = clamp(this.boost - dt * 0.34, 0, 1);
    } else {
      this.boost = clamp(this.boost + dt * (Math.abs(vLong) < 4 ? 0.22 : 0.075), 0, 1);
    }
    this.boosting = boosting;

    const topSpeed = boosting ? this.boostMaxSpeed : this.maxSpeed;

    if (input.gas && vLong < topSpeed) {
      const falloff = 1 - clamp(vLong / topSpeed, 0, 1) * 0.72;
      vLong += (this.engineForce * falloff + boostAccel) * dt;
    }
    if (input.brake) {
      if (vLong > 0.6) vLong -= this.brakeForce * dt;
      else if (vLong > -22) vLong -= this.reverseForce * dt;
    }
    if (!input.gas && !input.brake) {
      vLong -= Math.sign(vLong) * Math.min(Math.abs(vLong), this.rollResist * dt + Math.abs(vLong) * 0.55 * dt);
    }

    // handbrake / drift
    const handbrake = input.drift && Math.abs(vLong) > 4;
    this.drifting = handbrake;

    // ---- lateral grip: how quickly sideways velocity is scrubbed ----
    let gripRear = handbrake ? this.driftGripRear : this.gripRear;
    if (input.gas && input.steer !== 0 && Math.abs(vLong) > 34) gripRear *= 0.62; // power-over

    const gripFactor = clamp(gripRear * dt, 0, 1);
    const scrub = vLat * gripFactor;
    vLat -= scrub;

    // steering + lateral force => yaw torque (bicycle approximation)
    const speedNorm = clamp(Math.abs(vLong) / 26, 0, 1.6);
    const turnRate = -this.steer * speedNorm * (handbrake ? 2.15 : 1.42);
    this.angVel += (turnRate - this.angVel) * clamp(6 * dt + Math.abs(scrub) * 0.02, 0, 1);

    // drag & rolling resistance
    const speed = this.vel.length();
    const dragForce = this.drag * speed * speed + 0.45;
    vLong -= Math.sign(vLong) * Math.min(Math.abs(vLong), dragForce * dt);

    // recombine
    this.vel.set(fwd.x * vLong + right.x * vLat, fwd.y * vLong + right.y * vLat);

    // apply yaw
    this.yaw += this.angVel * dt;

    // drift angle for HUD / effects
    const newFwd = this.forward;
    const newRight = this.right;
    const long2 = this.vel.dot(newFwd);
    const lat2 = this.vel.dot(newRight);
    this.driftAngle = Math.abs(long2) > 3 ? Math.atan2(lat2, Math.abs(long2)) : 0;
    this.driftAmount = clamp(Math.abs(this.driftAngle) / 1.1, 0, 1) * clamp(Math.abs(long2) / 22, 0, 1);

    // integrate position
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;

    this.speedKmh = Math.abs(this.vel.length()) * 3.6;
    this.vLong = long2;
    this.vLat = lat2;

    this._collide();

    // keep inside the map: hard wall that also kills the velocity into it,
    // otherwise the car can pin itself to the edge at full speed
    const lim = this.world.bounds;
    const r = this.radius;
    if (this.pos.x > lim - r) { this.pos.x = lim - r; this.vel.x = -Math.abs(this.vel.x) * 0.25; }
    if (this.pos.x < -lim + r) { this.pos.x = -lim + r; this.vel.x = Math.abs(this.vel.x) * 0.25; }
    if (this.pos.y > lim - r) { this.pos.y = lim - r; this.vel.y = -Math.abs(this.vel.y) * 0.25; }
    if (this.pos.y < -lim + r) { this.pos.y = -lim + r; this.vel.y = Math.abs(this.vel.y) * 0.25; }

    // ---- push into the visual model ----
    const car = this.car;
    car.position.set(this.pos.x, 0, this.pos.y);
    car.rotation.y = this.yaw;

    // body roll & pitch from lateral / longitudinal accel
    const lean = clamp(-lat2 * 0.0075, -0.1, 0.1);
    const dive = clamp((input.brake && long2 > 4 ? 0.028 : 0) - (input.gas ? 0.012 : 0), -0.02, 0.03);
    const chassis = car.userData.body;
    chassis.rotation.z += (lean - chassis.rotation.z) * clamp(8 * dt, 0, 1);
    chassis.rotation.x += (dive - chassis.rotation.x) * clamp(6 * dt, 0, 1);
    chassis.position.y = 0;

    // wheels
    this.wheelSpin += (long2 / 0.42) * dt;
    const { wheels, wheelPivots } = car.userData;
    wheels.forEach((w) => {
      w.rotation.x = this.wheelSpin;
    });
    wheelPivots[0].rotation.y = this.steer;
    wheelPivots[1].rotation.y = this.steer;

    // lights react to braking
    car.userData.tailMat.emissiveIntensity = input.brake && long2 > 0.5 ? 6.5 : 2.6;

    this.impact *= Math.exp(-dt * 4);
  }

  _collide() {
    const r = this.radius;
    const cols = this.world.colliders;
    // only test the buildings in nearby cells
    for (let i = 0; i < cols.length; i++) {
      const b = cols[i];
      if (this.pos.x + r < b.minX || this.pos.x - r > b.maxX) continue;
      if (this.pos.y + r < b.minZ || this.pos.y - r > b.maxZ) continue;

      // find shallowest axis to push out
      const dxL = this.pos.x + r - b.minX;
      const dxR = b.maxX - (this.pos.x - r);
      const dzL = this.pos.y + r - b.minZ;
      const dzR = b.maxZ - (this.pos.y - r);
      const min = Math.min(dxL, dxR, dzL, dzR);

      if (min === dxL) {
        this.pos.x -= dxL;
        this.vel.x = -Math.abs(this.vel.x) * 0.28;
      } else if (min === dxR) {
        this.pos.x += dxR;
        this.vel.x = Math.abs(this.vel.x) * 0.28;
      } else if (min === dzL) {
        this.pos.y -= dzL;
        this.vel.y = -Math.abs(this.vel.y) * 0.28;
      } else {
        this.pos.y += dzR;
        this.vel.y = Math.abs(this.vel.y) * 0.28;
      }
      // scrub speed on impact
      const speed = this.vel.length();
      if (speed > 12) this.impact = Math.min(1, speed / 60);
      this.vel.multiplyScalar(0.62);
      this.angVel *= 0.5;
    }
  }
}
