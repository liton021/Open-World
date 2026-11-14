import * as THREE from 'three';

function softSprite(color = '255,255,255', size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${color},1)`);
  grad.addColorStop(0.4, `rgba(${color},0.55)`);
  grad.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

// ---------------------------------------------------------------------------
// Particle pool used for tyre smoke, boost sparks and pickup bursts.
// ---------------------------------------------------------------------------
class ParticlePool {
  constructor(scene, count, texture, blending = THREE.AdditiveBlending) {
    this.count = count;
    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);
    this.sizes = new Float32Array(count);
    this.alphas = new Float32Array(count);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.maxLife = new Float32Array(count);
    this.cursor = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: texture },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute float aAlpha;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uPixelRatio;
        void main() {
          vColor = color;
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uPixelRatio * (300.0 / max(-mv.z, 0.1));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec4 tex = texture2D(uMap, gl_PointCoord);
          if (tex.a * vAlpha < 0.01) discard;
          gl_FragColor = vec4(vColor, tex.a * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      blending,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.geo = geo;
    this._c = new THREE.Color();
  }

  spawn({ x, y, z, vx = 0, vy = 0, vz = 0, life = 1, size = 2, color = 0xffffff }) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.count;
    const i3 = i * 3;
    this.positions[i3] = x;
    this.positions[i3 + 1] = y;
    this.positions[i3 + 2] = z;
    this.vel[i3] = vx;
    this.vel[i3 + 1] = vy;
    this.vel[i3 + 2] = vz;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.sizes[i] = size;
    this._c.set(color);
    this.colors[i3] = this._c.r;
    this.colors[i3 + 1] = this._c.g;
    this.colors[i3 + 2] = this._c.b;
    this.alphas[i] = 1;
    return i;
  }

  update(dt) {
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) {
        if (this.alphas[i] !== 0) this.alphas[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const t = Math.max(this.life[i] / this.maxLife[i], 0);
      const i3 = i * 3;
      this.positions[i3] += this.vel[i3] * dt;
      this.positions[i3 + 1] += this.vel[i3 + 1] * dt;
      this.positions[i3 + 2] += this.vel[i3 + 2] * dt;
      this.vel[i3] *= 0.98;
      this.vel[i3 + 1] += (2.2 - this.vel[i3 + 1] * 0.1) * dt; // smoke drifts up
      this.vel[i3 + 2] *= 0.98;
      this.alphas[i] = t * t;
      this.sizes[i] += dt * 6;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
export class Effects {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;

    this.smoke = new ParticlePool(scene, 700, softSprite('180,225,255', 64), THREE.NormalBlending);
    this.sparks = new ParticlePool(scene, 500, softSprite('255,220,140', 48), THREE.AdditiveBlending);

    // speed lines live in camera space
    this.streaks = this._buildStreaks();
    scene.add(this.streaks);

    this.shake = 0;
    this.time = 0;
  }

  _buildStreaks() {
    const N = 320;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 2 * 3);
    const col = new Float32Array(N * 2 * 3);
    for (let i = 0; i < N; i++) {
      const r = 2.6 + Math.random() * 5.5;
      const a = Math.random() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r * 0.55;
      const z = -Math.random() * 90 - 4;
      const len = 2 + Math.random() * 6;
      pos.set([x, y, z, x, y, z - len], i * 6);
      const c = new THREE.Color().setHSL(0.52 + Math.random() * 0.12, 1, 0.72);
      col.set([c.r, c.g, c.b, c.r, c.g, c.b], i * 6);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const lines = new THREE.LineSegments(geo, mat);
    lines.frustumCulled = false;
    return lines;
  }

  // called every frame
  update(dt, state) {
    this.time += dt;
    this.smoke.update(dt);
    this.sparks.update(dt);

    // --- tyre smoke from the rear wheels while drifting / hard braking ---
    const { car, drifting, driftAmount, speed, input } = state;
    const rear = car.localToWorld(new THREE.Vector3(0.95, 0.12, -1.42));
    const rear2 = car.localToWorld(new THREE.Vector3(-0.95, 0.12, -1.42));

    if (drifting && speed > 6) {
      const n = Math.min(4, 1 + Math.floor(driftAmount * 4));
      for (let i = 0; i < n; i++) {
        const p = i % 2 ? rear : rear2;
        this.smoke.spawn({
          x: p.x + (Math.random() - 0.5) * 0.6,
          y: 0.25 + Math.random() * 0.25,
          z: p.z + (Math.random() - 0.5) * 0.6,
          vx: (Math.random() - 0.5) * 5,
          vy: 0.6 + Math.random() * 1.4,
          vz: (Math.random() - 0.5) * 5,
          life: 0.65 + Math.random() * 0.55,
          size: 1.4 + Math.random() * 1.6,
          color: 0x9fd8ff,
        });
      }
    }

    // --- brake lockup sparks ---
    if (input.brake && speed > 22) {
      for (let i = 0; i < 2; i++) {
        const p = Math.random() > 0.5 ? rear : rear2;
        this.sparks.spawn({
          x: p.x, y: 0.2, z: p.z,
          vx: (Math.random() - 0.5) * 6, vy: 0.5 + Math.random() * 2, vz: (Math.random() - 0.5) * 6,
          life: 0.28 + Math.random() * 0.3, size: 0.55, color: 0xffc46b,
        });
      }
    }

    // --- speed streaks scale with velocity ---
    const spd = Math.min(speed / 75, 1);
    const targetOpacity = state.boosting ? 0.55 : spd > 0.55 ? (spd - 0.55) * 0.45 : 0;
    this.streaks.material.opacity += (targetOpacity - this.streaks.material.opacity) * Math.min(dt * 6, 1);
    this.streaks.position.copy(this.camera.position);
    this.streaks.quaternion.copy(this.camera.quaternion);
    // scroll the lines backwards relative to speed
    const arr = this.streaks.geometry.attributes.position.array;
    const zSpeed = speed * dt * 2.4;
    for (let i = 2; i < arr.length; i += 3) {
      arr[i] += zSpeed;
      if (arr[i] > 0) arr[i] -= 220;
    }
    this.streaks.geometry.attributes.position.needsUpdate = true;

    this.shake *= Math.exp(-dt * 3.6);
  }

  burst(position, color = 0x37f8ff, n = 26) {
    for (let i = 0; i < n; i++) {
      this.sparks.spawn({
        x: position.x,
        y: position.y,
        z: position.z,
        vx: (Math.random() - 0.5) * 16,
        vy: Math.random() * 10,
        vz: (Math.random() - 0.5) * 16,
        life: 0.5 + Math.random() * 0.6,
        size: 0.7 + Math.random() * 0.8,
        color,
      });
    }
  }

  impact(strength = 1) {
    this.shake = Math.min(1, this.shake + strength);
  }
}
