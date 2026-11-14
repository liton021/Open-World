// Headless smoke test for the procedural city + core placement.
// Canvas is stubbed so THREE.CanvasTexture can be created in Node.
const ctxStub = new Proxy(
  { canvas: null },
  {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createRadialGradient' || k === 'createLinearGradient')
        return () => ({ addColorStop() {} });
      if (k === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
      if (k === 'measureText') return () => ({ width: 10 });
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
  }
);
globalThis.document = {
  createElement() {
    const c = { width: 1, height: 1, getContext: () => ctxStub };
    return c;
  },
};

const THREE = await import('three');
const { CityWorld, CITY_LIMIT } = await import('../src/world.js');
const { Cores } = await import('../src/cores.js');

const added = [];
const scene = { add: (...o) => added.push(...o), fog: null };
const t0 = performance.now();
const world = new CityWorld(scene);
const buildMs = performance.now() - t0;

let tris = 0;
scene.add = () => {};
for (const o of added) {
  if (o.isMesh && o.geometry?.attributes?.position) {
    const g = o.geometry;
    const count = g.index ? g.index.count : g.attributes.position.count;
    tris += (count / 3) * (o.isInstancedMesh ? o.count : 1);
  }
}

const ok = (label, cond, detail) => console.log(`${cond ? 'PASS' : 'FAIL'}  ${label.padEnd(28)} ${detail}`);

ok('city builds', world.colliders.length > 200, `${world.colliders.length} buildings, ${buildMs.toFixed(0)}ms`);
ok('triangle budget', tris < 1_500_000, `${(tris / 1000).toFixed(0)}k tris, ${added.length} scene objects`);
ok('draw call budget', added.length < 120, `${added.length} objects added to the scene`);

// every collider is sane and finite
let bad = 0;
for (const b of world.colliders) {
  if (![b.minX, b.maxX, b.minZ, b.maxZ, b.h].every(Number.isFinite)) bad++;
  if (b.maxX <= b.minX || b.maxZ <= b.minZ || b.h <= 0) bad++;
}
ok('colliders valid', bad === 0, `${bad} malformed`);

// colliders stay inside the city
const outside = world.colliders.filter((b) => Math.abs(b.minX) > CITY_LIMIT || Math.abs(b.minZ) > CITY_LIMIT).length;
ok('city bounded', outside === 0, `${outside} outside bounds (limit ${CITY_LIMIT})`);

// cores
const scene2 = { add: () => {} };
const cores = new Cores(scene2, 40, CITY_LIMIT - 40);
ok('40 cores placed', cores.items.length === 40, `${cores.items.length} placed`);
const onRoad = cores.items.every((c) => {
  const gx = Math.abs(((c.pos.x % 96) + 96) % 96);
  const gz = Math.abs(((c.pos.z % 96) + 96) % 96);
  return gx < 8 || gx > 88 || gz < 8 || gz > 88;
});
ok('cores sit on roads', onRoad, 'all within road lanes');

// pickup only fires when actually driving over one
const c0 = cores.items[0];
const far = cores.checkPickup({ x: c0.pos.x + 50, z: c0.pos.z });
const hit = cores.checkPickup({ x: c0.pos.x, z: c0.pos.z });
ok('pickup radius', far === null && hit === c0, `far=>${far}, near=>${hit ? 'hit' : 'null'}`);
ok('remaining decrements', cores.remaining === 39 && cores.collected === 1, `${cores.remaining} left`);

// nearest() reports a real distance
const near = cores.nearest({ x: 0, z: 0 });
ok('nearest query', Number.isFinite(near.distance) && near.item.alive, `${near.distance.toFixed(1)}m away`);

// no core spawns inside a building
const insideBuilding = cores.items.filter((c) =>
  world.colliders.some(
    (b) => c.pos.x > b.minX - 2 && c.pos.x < b.maxX + 2 && c.pos.z > b.minZ - 2 && c.pos.z < b.maxZ + 2 && b.h > 2
  )
).length;
ok('cores not in walls', insideBuilding === 0, `${insideBuilding} buried`);

// --- traffic sanity ---
const { Traffic } = await import('../src/traffic.js');
const scene3 = { add: () => {} };
const traffic = new Traffic(scene3, 26);
const ppos = { x: 0, y: 0 };
for (let i = 0; i < 60 * 30; i++) traffic.update(1 / 60, ppos);
const stuck = traffic.cars.filter((c) => Math.abs(c.group.position.x) > 700 || Math.abs(c.group.position.z) > 700).length;
const moving = traffic.cars.filter((c) => c.speed > 1).length;
ok('traffic 30s sim', stuck === 0 && moving > 10, `${moving}/${traffic.cars.length} moving, ${stuck} escaped the map`);

// collision resolves overlap
const fakePhysics = {
  pos: new THREE.Vector2(traffic.cars[0].group.position.x + 0.2, traffic.cars[0].group.position.z),
  vel: new THREE.Vector2(-10, 0),
  impact: 0,
};
traffic.collide(fakePhysics);
const sep = Math.hypot(
  fakePhysics.pos.x - traffic.cars[0].group.position.x,
  fakePhysics.pos.y - traffic.cars[0].group.position.z
);
ok('traffic collision', sep > 2 && fakePhysics.impact > 0, `pushed to ${sep.toFixed(2)}m apart, impact ${fakePhysics.impact.toFixed(2)}`);
