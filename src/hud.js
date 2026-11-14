// ---------------------------------------------------------------------------
// DOM HUD + canvas minimap. Kept out of the render loop's hot path by only
// touching the DOM when a value actually changes.
// ---------------------------------------------------------------------------
export class Hud {
  constructor(world, cores, bounds) {
    this.world = world;
    this.cores = cores;
    this.bounds = bounds;

    this.el = {
      hud: document.getElementById('hud'),
      speed: document.getElementById('speed-value'),
      gear: document.getElementById('gear-value'),
      arc: document.getElementById('speed-arc'),
      time: document.getElementById('time-value'),
      count: document.getElementById('core-count'),
      drift: document.getElementById('drift-fill'),
      boost: document.getElementById('boost-fill'),
      score: document.getElementById('drift-score'),
      callout: document.getElementById('callout'),
      pop: document.getElementById('drift-pop'),
      app: document.getElementById('app'),
      minimap: document.getElementById('minimap'),
    };

    this.map = this.el.minimap.getContext('2d');
    this.cache = {};
    this.calloutTimer = 0;

    // pre-render the static city block mask to an offscreen canvas
    this.staticMap = document.createElement('canvas');
    this.staticMap.width = this.staticMap.height = 320;
    this._renderStaticMap();
  }

  _renderStaticMap() {
    const c = this.staticMap;
    const g = c.getContext('2d');
    const S = c.width;
    const span = this.bounds * 2;
    const toPx = (v) => ((v + this.bounds) / span) * S;

    g.clearRect(0, 0, S, S);
    // roads
    g.strokeStyle = 'rgba(90,150,190,0.22)';
    g.lineWidth = (22 / span) * S;
    for (let i = -7; i <= 7; i++) {
      const p = toPx(i * 96);
      g.beginPath();
      g.moveTo(p, 0);
      g.lineTo(p, S);
      g.stroke();
      g.beginPath();
      g.moveTo(0, p);
      g.lineTo(S, p);
      g.stroke();
    }
    // buildings
    g.fillStyle = 'rgba(70,105,145,0.34)';
    for (const b of this.world.colliders) {
      g.fillRect(toPx(b.minX), toPx(b.minZ), toPx(b.maxX) - toPx(b.minX), toPx(b.maxZ) - toPx(b.minZ));
    }
  }

  show() {
    this.el.hud.classList.remove('hidden');
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      document.getElementById('touch').classList.remove('hidden');
    }
  }

  set(key, value, apply) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    apply(value);
  }

  update(state) {
    const { speedKmh, gear, time, cores, driftCharge, boost, score, car, nearestCore, boosting } = state;

    this.set('speed', Math.round(speedKmh), (v) => {
      this.el.speed.textContent = v;
    });
    this.set('gear', gear, (v) => {
      this.el.gear.textContent = v;
    });

    // gauge arc: 0..300 km/h mapped to a 245-length arc
    const frac = Math.min(speedKmh / 300, 1);
    this.set('arc', Math.round(frac * 100), (v) => {
      const len = (v / 100) * 245;
      this.el.arc.setAttribute('stroke-dasharray', `${len} 327`);
      this.el.arc.style.stroke = boosting ? '#b6ff3c' : frac > 0.82 ? '#ff2fd0' : '#37f8ff';
    });

    this.set('time', time.toFixed(1), () => {
      const m = Math.floor(time / 60);
      const s = time % 60;
      this.el.time.textContent = `${m}:${s.toFixed(2).padStart(5, '0')}`;
    });

    this.set('cores', cores, (v) => {
      this.el.count.textContent = v;
    });

    this.set('drift', Math.round(driftCharge * 100), (v) => {
      this.el.drift.style.width = `${v}%`;
    });
    this.set('boost', Math.round(boost * 100), (v) => {
      this.el.boost.style.width = `${v}%`;
    });
    this.set('score', Math.round(score), (v) => {
      this.el.score.textContent = v.toLocaleString();
    });

    this._drawMinimap(car, nearestCore);
  }

  callout(text, ms = 2200) {
    this.el.callout.textContent = text;
    this.el.callout.classList.add('show');
    clearTimeout(this._ct);
    this._ct = setTimeout(() => this.el.callout.classList.remove('show'), ms);
  }

  driftPop(points) {
    const el = this.el.pop;
    el.textContent = `+${points}`;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  flash() {
    const app = this.el.app;
    app.classList.remove('flash');
    void app.offsetWidth;
    app.classList.add('flash');
  }

  _drawMinimap(car, nearestCore) {
    const g = this.map;
    const S = this.el.minimap.width;
    g.clearRect(0, 0, S, S);

    // circular clip
    g.save();
    g.beginPath();
    g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = 'rgba(6,10,20,0.85)';
    g.fillRect(0, 0, S, S);

    const span = this.bounds * 2;
    const toPx = (v) => ((v + this.bounds) / span) * S;
    // scale of static map (320) to minimap (176)
    const k = S / this.staticMap.width;
    g.globalAlpha = 0.95;
    g.drawImage(this.staticMap, 0, 0, this.staticMap.width * k, this.staticMap.height * k);
    g.globalAlpha = 1;

    // cores
    for (const it of this.cores.items) {
      if (!it.alive) continue;
      g.fillStyle = 'rgba(55,248,255,0.85)';
      g.beginPath();
      g.arc(toPx(it.pos.x), toPx(it.pos.z), 1.7, 0, Math.PI * 2);
      g.fill();
    }

    // nearest core ping
    if (nearestCore && nearestCore.distance < 420) {
      const x = toPx(nearestCore.item.pos.x);
      const y = toPx(nearestCore.item.pos.z);
      g.strokeStyle = 'rgba(182,255,60,0.9)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(x, y, 5 + Math.sin(performance.now() / 220) * 2.5, 0, Math.PI * 2);
      g.stroke();
    }

    // player arrow
    const px = toPx(car.pos.x);
    const py = toPx(car.pos.y);
    g.save();
    g.translate(px, py);
    g.rotate(-car.yaw);
    g.fillStyle = '#ff2fd0';
    g.shadowColor = '#ff2fd0';
    g.shadowBlur = 8;
    g.beginPath();
    g.moveTo(0, -6.5);
    g.lineTo(4.6, 5);
    g.lineTo(0, 2.6);
    g.lineTo(-4.6, 5);
    g.closePath();
    g.fill();
    g.restore();

    g.restore();
  }
}
