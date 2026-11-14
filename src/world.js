import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------------------
// City layout constants (metres)
// ---------------------------------------------------------------------------
export const GRID = 96;            // distance between road centrelines
export const HALF_BLOCKS = 7;      // city spans -7..7 intersections
export const ROAD_W = 22;
export const CITY_LIMIT = HALF_BLOCKS * GRID + ROAD_W * 0.5;

export function roadCoord(i) {
  return i * GRID;
}

// deterministic RNG so the city is the same every reload
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Procedural textures (no external assets — everything is drawn in a canvas)
// ---------------------------------------------------------------------------
function makeWindowTexture() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#0a0c14';
  g.fillRect(0, 0, S, S);

  const cols = 8;
  const rows = 10;
  const cw = S / cols;
  const ch = S / rows;
  const palette = ['#8ef6ff', '#5fd0ff', '#ffd88a', '#ff8fe0', '#c9a6ff'];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = Math.random() > 0.42;
      const px = x * cw + cw * 0.19;
      const py = y * ch + ch * 0.22;
      const w = cw * 0.62;
      const h = ch * 0.5;
      if (lit) {
        const col = palette[(Math.random() * palette.length) | 0];
        g.fillStyle = col;
        g.globalAlpha = 0.55 + Math.random() * 0.45;
      } else {
        g.fillStyle = '#101422';
        g.globalAlpha = 1;
      }
      g.fillRect(px, py, w, h);
    }
  }
  g.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function makeAsphaltTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#0b0e16';
  g.fillRect(0, 0, S, S);
  const img = g.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = Math.random() * 22;
    img.data[i] += n * 0.7;
    img.data[i + 1] += n * 0.85;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);

  // faint wet sheen streaks
  g.globalAlpha = 0.05;
  for (let i = 0; i < 40; i++) {
    g.fillStyle = Math.random() > 0.5 ? '#9fe9ff' : '#ff6fd8';
    g.fillRect(Math.random() * S, Math.random() * S, Math.random() * 90, 1 + Math.random() * 2);
  }
  g.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(60, 60);
  return tex;
}

function makeBillboardTexture(text, color) {
  const W = 512;
  const H = 192;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#06080f';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = color;
  g.lineWidth = 8;
  g.strokeRect(10, 10, W - 20, H - 20);
  g.font = 'bold 92px ui-monospace, monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 34;
  g.fillStyle = color;
  g.fillText(text, W / 2, H / 2 + 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------
export class CityWorld {
  constructor(scene) {
    this.scene = scene;
    this.rand = mulberry32(20261114);
    this.colliders = [];       // AABBs {minX,maxX,minZ,maxZ}
    this.bounds = CITY_LIMIT;
    this.t = 0;

    this._buildSky();
    this._buildGround();
    this._buildBlocks();
    this._buildRoadMarkings();
    this._buildLampsAndSigns();
  }

  // ---------------------------------------------------------------- sky ----
  _buildSky() {
    const skyGeo = new THREE.SphereGeometry(2600, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(0x02030a) },
        mid: { value: new THREE.Color(0x140b2c) },
        bottom: { value: new THREE.Color(0x4a1246) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vPos;
        uniform vec3 top; uniform vec3 mid; uniform vec3 bottom;
        void main() {
          float h = normalize(vPos).y;
          vec3 col = mix(bottom, mid, smoothstep(-0.05, 0.28, h));
          col = mix(col, top, smoothstep(0.2, 0.85, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.frustumCulled = false;
    this.scene.add(sky);

    // stars
    const N = 1200;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 2200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.9 + 0.05);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi) + 60;
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      const tint = 0.6 + Math.random() * 0.4;
      col[i * 3] = tint * (0.8 + Math.random() * 0.2);
      col[i * 3 + 1] = tint * (0.85 + Math.random() * 0.15);
      col[i * 3 + 2] = 1;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({
        size: 6,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        fog: false,
      })
    );
    stars.frustumCulled = false;
    this.scene.add(stars);

    // moon
    const moonCanvas = document.createElement('canvas');
    moonCanvas.width = moonCanvas.height = 128;
    const mg = moonCanvas.getContext('2d');
    const grad = mg.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, 'rgba(255,240,255,1)');
    grad.addColorStop(0.35, 'rgba(210,190,255,0.75)');
    grad.addColorStop(1, 'rgba(120,80,200,0)');
    mg.fillStyle = grad;
    mg.fillRect(0, 0, 128, 128);
    const moonTex = new THREE.CanvasTexture(moonCanvas);
    const moon = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: moonTex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })
    );
    moon.scale.setScalar(420);
    moon.position.set(-900, 700, -1600);
    this.scene.add(moon);

    this.scene.fog = new THREE.FogExp2(0x0a0a1c, 0.0019);
  }

  // ------------------------------------------------------------- ground ----
  _buildGround() {
    const size = CITY_LIMIT * 2 + 700;
    const geo = new THREE.PlaneGeometry(size, size, 1, 1);
    const mat = new THREE.MeshStandardMaterial({
      map: makeAsphaltTexture(),
      color: 0x2a3040,
      roughness: 0.42,
      metalness: 0.55,
      envMapIntensity: 0.75,
    });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = false;
    this.scene.add(ground);
    this.ground = ground;
  }

  // ------------------------------------------------------------- blocks ----
  _buildBlocks() {
    const rand = this.rand;
    const windowTex = makeWindowTexture();
    const buildingGeos = [];
    const slabGeos = [];
    const neonGeos = [];
    const trees = [];
    const colliders = this.colliders;

    const half = GRID / 2;
    const blockSize = GRID - ROAD_W; // 74

    function addTower(bx, bz, w, d, h) {
      const geo = new THREE.BoxGeometry(w, h, d);
      geo.translate(bx, h / 2 + 0.2, bz);
      scaleBoxUVs(geo, w, h, d, 7.5);
      const base = rand();
      const hue = base > 0.72 ? 0.52 + rand() * 0.1 : base > 0.4 ? 0.62 + rand() * 0.08 : 0.78 + rand() * 0.08;
      addColor(geo, new THREE.Color().setHSL(hue, 0.35, 0.5 + rand() * 0.18));
      buildingGeos.push(geo);

      colliders.push({ minX: bx - w / 2, maxX: bx + w / 2, minZ: bz - d / 2, maxZ: bz + d / 2, h });

      // neon crown on taller towers
      if (h > 64 && rand() > 0.3) {
        const crown = new THREE.BoxGeometry(w * 1.04, 1.1, d * 1.04);
        crown.translate(bx, h + 0.9, bz);
        addColor(crown, new THREE.Color(rand() > 0.5 ? 0x37f8ff : 0xff2fd0));
        neonGeos.push(crown);
      }
      // rooftop antenna on the very tall ones
      if (h > 140 && rand() > 0.45) {
        const ant = new THREE.BoxGeometry(0.8, 14, 0.8);
        ant.translate(bx, h + 7.5, bz);
        addColor(ant, new THREE.Color(0x8fa8c8));
        buildingGeos.push(ant);
      }
    }

    const SUB = 2;                       // 2x2 lots per block
    const subSize = blockSize / SUB;

    for (let ix = -HALF_BLOCKS; ix < HALF_BLOCKS; ix++) {
      for (let iz = -HALF_BLOCKS; iz < HALF_BLOCKS; iz++) {
        const cx = ix * GRID + half;
        const cz = iz * GRID + half;

        // sidewalk / plaza slab
        const slab = new THREE.BoxGeometry(blockSize, 0.35, blockSize);
        slab.translate(cx, 0.175, cz);
        addColor(slab, new THREE.Color().setHSL(0.58, 0.2, 0.16 + rand() * 0.05));
        slabGeos.push(slab);

        // a few blocks are parks instead of towers
        if (rand() < 0.1) {
          for (let t = 0; t < 7; t++) {
            trees.push({
              x: cx + (rand() - 0.5) * (blockSize - 20),
              z: cz + (rand() - 0.5) * (blockSize - 20),
              h: 6 + rand() * 7,
            });
          }
          continue;
        }

        const downtown = Math.abs(ix) < 4 && Math.abs(iz) < 4;

        for (let sx = 0; sx < SUB; sx++) {
          for (let sz = 0; sz < SUB; sz++) {
            const lotCx = cx - blockSize / 2 + subSize * (sx + 0.5);
            const lotCz = cz - blockSize / 2 + subSize * (sz + 0.5);

            const isEdge = sx === 0 || sx === SUB - 1 || sz === 0 || sz === SUB - 1;
            if (isEdge && rand() < 0.16) continue;  // courtyard gap

            // keep the footprint inside its lot so roads stay clear
            const w = subSize * (0.7 + rand() * 0.2);
            const d = subSize * (0.7 + rand() * 0.2);
            const bx = lotCx + (rand() - 0.5) * (subSize - w - 1.5);
            const bz = lotCz + (rand() - 0.5) * (subSize - d - 1.5);

            const tall = downtown ? 1.7 : isEdge ? 0.72 : 1;
            const h = (16 + rand() * rand() * 118) * tall;
            addTower(bx, bz, w, d, h);
          }
        }
      }
    }

    // merged buildings — one draw call for the entire skyline
    const merged = mergeGeometries(buildingGeos, false);
    buildingGeos.forEach((g) => g.dispose());
    const buildingMat = new THREE.MeshStandardMaterial({
      map: windowTex,
      emissiveMap: windowTex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.62,
      color: 0x7f8ba8,
      vertexColors: true,
      roughness: 0.72,
      metalness: 0.25,
      envMapIntensity: 0.5,
    });
    const buildings = new THREE.Mesh(merged, buildingMat);
    buildings.matrixAutoUpdate = false;
    this.scene.add(buildings);
    this.buildings = buildings;

    const mergedSlabs = mergeGeometries(slabGeos, false);
    slabGeos.forEach((g) => g.dispose());
    const slabMesh = new THREE.Mesh(
      mergedSlabs,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.8,
        metalness: 0.2,
        envMapIntensity: 0.6,
      })
    );
    slabMesh.matrixAutoUpdate = false;
    this.scene.add(slabMesh);

    const mergedNeon = mergeGeometries(neonGeos, false);
    neonGeos.forEach((g) => g.dispose());
    const neonMesh = new THREE.Mesh(
      mergedNeon,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        emissive: 0xffffff,
        emissiveIntensity: 1.4,
        roughness: 0.3,
        metalness: 0.1,
      })
    );
    neonMesh.matrixAutoUpdate = false;
    this.scene.add(neonMesh);

    this._buildTrees(trees);
  }

  _buildTrees(trees) {
    if (!trees.length) return;
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.3, 1, 5);
    const canopyGeo = new THREE.ConeGeometry(1, 1, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x1a2130, roughness: 0.9 });
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x0e3a2c,
      emissive: 0x0f6b4a,
      emissiveIntensity: 0.55,
      roughness: 0.7,
      flatShading: true,
    });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, trees.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    trees.forEach((t, i) => {
      const trunkH = t.h * 0.45;
      p.set(t.x, trunkH / 2 + 0.3, t.z);
      s.set(1, trunkH, 1);
      m.compose(p, q, s);
      trunks.setMatrixAt(i, m);

      p.set(t.x, trunkH + t.h * 0.35 + 0.3, t.z);
      s.set(t.h * 0.32, t.h * 0.8, t.h * 0.32);
      m.compose(p, q, s);
      canopies.setMatrixAt(i, m);
    });
    trunks.instanceMatrix.needsUpdate = true;
    canopies.instanceMatrix.needsUpdate = true;
    this.scene.add(trunks, canopies);
  }

  // ----------------------------------------------------------- markings ----
  _buildRoadMarkings() {
    const dashGeo = new THREE.PlaneGeometry(0.34, 4.4);
    dashGeo.rotateX(-Math.PI / 2);
    const dashMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xdff6ff,
      emissiveIntensity: 0.3,
      roughness: 0.6,
      metalness: 0.1,
      transparent: true,
      opacity: 0.45,
    });

    const matrices = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const qRotX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3(1, 1, 1);
    const span = HALF_BLOCKS * GRID;

    const nearIntersection = (v) => Math.abs(v % GRID) < ROAD_W * 0.75;

    for (let line = -HALF_BLOCKS; line <= HALF_BLOCKS; line++) {
      const c = line * GRID;
      for (let d = -span + 6; d <= span - 6; d += 11) {
        if (nearIntersection(d)) continue;
        pos.set(c, 0.02, d);
        m.compose(pos, q, scl);
        matrices.push(m.clone());

        pos.set(d, 0.02, c);
        m.compose(pos, qRotX, scl);
        matrices.push(m.clone());
      }
    }

    const inst = new THREE.InstancedMesh(dashGeo, dashMat, matrices.length);
    matrices.forEach((mm, i) => inst.setMatrixAt(i, mm));
    inst.instanceMatrix.needsUpdate = true;
    inst.frustumCulled = false;
    this.scene.add(inst);
  }

  // -------------------------------------------------- lamps, signs, edge ----
  _buildLampsAndSigns() {
    const rand = this.rand;
    const lampPositions = [];
    const span = HALF_BLOCKS * GRID;
    for (let line = -HALF_BLOCKS; line <= HALF_BLOCKS; line++) {
      const c = line * GRID;
      for (let d = -span; d <= span; d += GRID / 2) {
        const off = ROAD_W / 2 + 1.6;
        lampPositions.push([c + off, d + 6]);
        lampPositions.push([c - off, d - 6]);
      }
    }

    const poleGeo = new THREE.CylinderGeometry(0.14, 0.2, 8, 5);
    poleGeo.translate(0, 4, 0);
    const headGeo = new THREE.BoxGeometry(0.5, 0.5, 2.2);
    headGeo.translate(0, 8.1, 0.9);

    const poleMat = new THREE.MeshStandardMaterial({ color: 0x1b2434, roughness: 0.7, metalness: 0.6 });
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x9fe9ff,
      emissiveIntensity: 2.2,
      roughness: 0.3,
    });

    const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampPositions.length);
    const heads = new THREE.InstancedMesh(headGeo, headMat, lampPositions.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    const p = new THREE.Vector3();
    lampPositions.forEach(([x, z], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() > 0.5 ? 0 : Math.PI);
      p.set(x, 0, z);
      m.compose(p, q, s);
      poles.setMatrixAt(i, m);
      heads.setMatrixAt(i, m);
    });
    poles.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    this.scene.add(poles, heads);

    // freestanding neon signs on the sidewalks, facing the avenue
    const words = [
      ['NIGHT DRIVE', '#37f8ff'],
      ['AI BUILT THIS', '#ff2fd0'],
      ['DRIFT CLUB', '#b6ff3c'],
      ['NEO TOKYO', '#ffb43c'],
      ['PROMPT & PLAY', '#37f8ff'],
      ['OPEN WORLD', '#ff2fd0'],
      ['NO HANDS', '#b6ff3c'],
      ['GO FAST', '#ffb43c'],
    ];
    const panelGeo = new THREE.PlaneGeometry(34, 12);
    words.forEach(([text, color], i) => {
      const tex = makeBillboardTexture(text, color);
      const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide });
      const panel = new THREE.Mesh(panelGeo, mat);

      const ix = -5 + ((i * 3) % 11);
      const iz = -5 + ((i * 5) % 11);
      const cx = ix * GRID + GRID / 2;
      const cz = iz * GRID + GRID / 2;
      const edge = (GRID - ROAD_W) / 2; // 37
      // south sidewalk of the block, sign looks north across the avenue
      const group = new THREE.Group();
      group.position.set(cx, 0, cz - edge + 1.5);
      panel.position.y = 12;
      group.add(panel);

      // two support posts
      const postMat = new THREE.MeshStandardMaterial({ color: 0x252d3b, metalness: 0.7, roughness: 0.5 });
      for (const px of [-11, 11]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 18, 0.6), postMat);
        post.position.set(px, 9, 0);
        group.add(post);
      }
      // a soft glow so the sign lights its own little pocket of street
      if (i % 2 === 0) {
        const glow = new THREE.PointLight(new THREE.Color(color), 30, 55, 2);
        glow.position.set(0, 11, 8);
        group.add(glow);
      }

      this.scene.add(group);
    });

    // glowing city edge line so you know where the world ends
    const edgeGeo = new THREE.RingGeometry(CITY_LIMIT + 8, CITY_LIMIT + 10, 128);
    edgeGeo.rotateX(-Math.PI / 2);
    const edge = new THREE.Mesh(
      edgeGeo,
      new THREE.MeshBasicMaterial({ color: 0xff2fd0, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    );
    edge.position.y = 0.05;
    this.scene.add(edge);

    this.lampHeads = heads;
  }

  update(dt) {
    this.t += dt;
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function addColor(geo, color) {
  const count = geo.attributes.position.count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = color.r;
    arr[i * 3 + 1] = color.g;
    arr[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
}

/**
 * BoxGeometry UVs are 0..1 per face. Stretch them by face dimensions so the
 * window texture keeps a constant real-world scale no matter the tower size.
 */
function scaleBoxUVs(geo, w, h, d, tile) {
  const uv = geo.attributes.uv;
  // face order: +x, -x, +y, -y, +z, -z  (4 verts each)
  const sizes = [
    [d / tile, h / tile],
    [d / tile, h / tile],
    [w / tile, d / tile],
    [w / tile, d / tile],
    [w / tile, h / tile],
    [w / tile, h / tile],
  ];
  for (let f = 0; f < 6; f++) {
    const [su, sv] = sizes[f];
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    }
  }
  uv.needsUpdate = true;
}
