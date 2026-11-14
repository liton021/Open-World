import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Ambient traffic. Cars are simple enough to be drawn from 5 merged boxes and
// are driven by a tiny "lane follower with stop-at-red" brain — the kind of
// cheap agent you can simulate hundreds of without a navmesh.
// ---------------------------------------------------------------------------
const GRID = 96;
const LANE = 5.2;
const HALF = 7;

const PALETTE = [0x2a3b5c, 0x4a4f63, 0xb8324f, 0x2cd3a0, 0xd9c27a, 0x8a5cf6, 0xe4e8f2, 0x1f2937];

export class Traffic {
  constructor(scene, count = 26) {
    this.scene = scene;
    this.cars = [];
    this.rand = Math.random;

    // one shared geometry per car part? no — merge each car into a single mesh
    for (let i = 0; i < count; i++) {
      this.cars.push(this._spawn(i));
    }
  }

  _spawn(i) {
    const horizontal = i % 2 === 0;
    const dir = this.rand() > 0.5 ? 1 : -1;
    // pick a random avenue, then a random point along it
    const road = (Math.floor(this.rand() * (HALF * 2 + 1)) - HALF) * GRID;
    const along = (this.rand() - 0.5) * (HALF * GRID * 1.7);

    const group = new THREE.Group();
    const color = new THREE.Color(PALETTE[i % PALETTE.length]);

    const bodyMat = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.6,
      roughness: 0.4,
      envMapIntensity: 1.1,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x111a26,
      metalness: 0.9,
      roughness: 0.12,
    });
    const lightMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xdff4ff,
      emissiveIntensity: 2,
      toneMapped: false,
    });
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0x330008,
      emissive: 0xff2233,
      emissiveIntensity: 2,
      toneMapped: false,
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 4.3), bodyMat);
    body.position.y = 0.72;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.62, 2.0), glassMat);
    cabin.position.set(0, 1.32, -0.2);
    const lampL = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.16, 0.1), lightMat);
    lampL.position.set(-0.62, 0.8, 2.16);
    const lampR = lampL.clone();
    lampR.position.x = 0.62;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.08), tailMat);
    tail.position.set(0, 0.86, -2.16);

    group.add(body, cabin, lampL, lampR, tail);
    group.position.set(0, 0, 0);
    this.scene.add(group);

    return {
      group,
      horizontal,
      dir,
      road,
      along,
      speed: 12 + this.rand() * 9,
      cruise: 12 + this.rand() * 9,
      brakeTimer: 0,
    };
  }

  /**
   * Bump the player out of any traffic car it overlaps. Called after the
   * player's own physics step so the resolve always wins.
   */
  collide(physics) {
    const R = 2.5;
    for (const c of this.cars) {
      const dx = physics.pos.x - c.group.position.x;
      const dz = physics.pos.y - c.group.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > R * R || d2 < 1e-6) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const nz = dz / d;
      // push the player out, lose a chunk of speed, and bounce a little
      physics.pos.x = c.group.position.x + nx * R;
      physics.pos.y = c.group.position.z + nz * R;
      const closing = -(physics.vel.x * nx + physics.vel.y * nz);
      if (closing > 0) {
        physics.vel.x += nx * closing * 0.7;
        physics.vel.y += nz * closing * 0.7;
        physics.vel.multiplyScalar(0.55);
        physics.impact = Math.min(1, Math.max(physics.impact, closing / 40));
      }
      c.speed *= 0.4;
      c.brakeTimer = 1.2;
    }
  }

  /** move the traffic + slow down around the player */
  update(dt, player) {
    for (const c of this.cars) {
      // decide whether it must slow down
      c.brakeTimer = Math.max(0, c.brakeTimer - dt);

      const px = c.horizontal ? c.along : c.road + c.dir * LANE;
      const pz = c.horizontal ? c.road + c.dir * LANE : c.along;

      const dx = player.x - px;
      const dz = player.y - pz;
      const distSq = dx * dx + dz * dz;

      // brake if the player is close ahead in our lane (or just near us)
      const aheadX = c.horizontal ? Math.sign(dx) === c.dir : true;
      const aheadZ = c.horizontal ? true : Math.sign(dz) === c.dir;
      const closeAhead = distSq < 26 * 26 && (aheadX || aheadZ);
      const veryClose = distSq < 11 * 11;
      if ((closeAhead || veryClose) && c.brakeTimer <= 0) c.brakeTimer = 0.35;

      const target = c.brakeTimer > 0 ? 0 : c.cruise;
      c.speed += (target - c.speed) * Math.min(dt * 2.6, 1);

      c.along += c.speed * dt * c.dir;

      // wrap around the avenue so traffic never runs out
      const limit = HALF * GRID + 30;
      if (c.along > limit) c.along = -limit;
      if (c.along < -limit) c.along = limit;

      if (c.horizontal) {
        c.group.position.set(c.along + 30, 0, c.road + c.dir * LANE);
        c.group.rotation.y = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        c.group.position.set(c.road + c.dir * LANE, 0, c.along);
        c.group.rotation.y = c.dir > 0 ? 0 : Math.PI;
      }
    }
  }
}
