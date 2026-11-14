import * as THREE from 'three';

function glowTexture() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.22, 'rgba(140,250,255,0.55)');
  grad.addColorStop(1, 'rgba(60,200,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(c);
}

// ---------------------------------------------------------------------------
// 40 neon cores to collect around the city. Each is a floating torus + halo.
// No per-core lights — one shared light is moved to the nearest core instead,
// which keeps the forward renderer's light loop tiny.
// ---------------------------------------------------------------------------
export class Cores {
  constructor(scene, count = 40, worldBounds = 640) {
    this.scene = scene;
    this.count = count;
    this.items = [];
    this.collected = 0;

    const halo = glowTexture();
    const ringGeo = new THREE.TorusGeometry(1.5, 0.2, 8, 22);
    const innerGeo = new THREE.OctahedronGeometry(0.72, 0);

    // deterministic placement along road lanes so they're always reachable
    const GRID = 96;
    const roads = [];
    for (let i = -6; i <= 6; i++) roads.push(i * GRID);

    let placed = 0;
    let attempt = 0;
    while (placed < count && attempt < count * 60) {
      attempt++;
      const alongX = Math.random() > 0.5;
      const lane = roads[(Math.random() * roads.length) | 0];
      const t = (Math.random() - 0.5) * worldBounds * 1.75;
      const laneOffset = (Math.random() > 0.5 ? 1 : -1) * 4.4;
      const x = alongX ? t : lane + laneOffset;
      const z = alongX ? lane + laneOffset : t;
      if (Math.abs(x) > worldBounds - 24 || Math.abs(z) > worldBounds - 24) continue;

      const hue = 0.48 + Math.random() * 0.16;
      const color = new THREE.Color().setHSL(hue, 1, 0.62);

      const group = new THREE.Group();

      const ringMat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 2.6,
        roughness: 0.2,
        metalness: 0.5,
        toneMapped: false,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      const inner = new THREE.Mesh(
        innerGeo,
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, toneMapped: false })
      );
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: halo,
          color,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        })
      );
      sprite.scale.setScalar(9);

      group.add(ring, inner, sprite);
      group.position.set(x, 1.9, z);
      scene.add(group);

      this.items.push({
        group,
        ring,
        inner,
        sprite,
        color,
        baseY: 1.9,
        phase: Math.random() * Math.PI * 2,
        alive: true,
        pos: new THREE.Vector3(x, 1.9, z),
      });
      placed++;
    }
  }

  /** player = { x, z } — returns the collected core or null */
  checkPickup(player, radius = 3.6) {
    for (const it of this.items) {
      if (!it.alive) continue;
      const dx = it.pos.x - player.x;
      const dz = it.pos.z - player.z;
      if (dx * dx + dz * dz < radius * radius) {
        it.alive = false;
        it.group.visible = false;
        this.collected++;
        return it;
      }
    }
    return null;
  }

  update(dt, t, player) {
    for (const it of this.items) {
      if (!it.alive) continue;
      it.ring.rotation.x += dt * 1.5;
      it.ring.rotation.y += dt * 0.9;
      it.inner.rotation.y -= dt * 2.2;
      it.inner.rotation.x += dt * 1.1;
      it.group.position.y = it.baseY + Math.sin(t * 1.7 + it.phase) * 0.42;
      const pulse = 8.6 + Math.sin(t * 3 + it.phase) * 1.1;
      it.sprite.scale.setScalar(pulse);
      const dist = Math.hypot(it.pos.x - player.x, it.pos.z - player.z);
      it.group.visible = dist < 460;
    }
  }

  nearest(player) {
    let best = null;
    let bestD = Infinity;
    for (const it of this.items) {
      if (!it.alive) continue;
      const d = Math.hypot(it.pos.x - player.x, it.pos.z - player.z);
      if (d < bestD) {
        bestD = d;
        best = it;
      }
    }
    return { item: best, distance: bestD };
  }

  get remaining() {
    let n = 0;
    for (const it of this.items) if (it.alive) n++;
    return n;
  }
}
