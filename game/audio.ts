// ---------------------------------------------------------------------------
// All sound is synthesised at runtime — no files, no network, no CORS issues.
// Kept deliberately dry and tiny; a troll game should sound like a prank, not
// a soundtrack.
// ---------------------------------------------------------------------------

type Ctx = AudioContext & { __unlocked?: boolean };

let ctx: Ctx | null = null;
let master: GainNode | null = null;
let muted = false;

function ac(): Ctx | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx = new AC() as Ctx;
    master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function unlockAudio() {
  ac();
}

export function setMuted(m: boolean) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.22;
}

export function isMuted() {
  return muted;
}

type ToneOpts = {
  freq: number;
  to?: number;
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
};

function tone({
  freq,
  to,
  dur = 0.12,
  type = "square",
  gain = 0.5,
  delay = 0,
}: ToneOpts) {
  const c = ac();
  if (!c || !master || muted) return;
  const t0 = c.currentTime + delay;

  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  }

  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.2, gain = 0.4, lp = 1400, delay = 0 } = {}) {
  const c = ac();
  if (!c || !master || muted) return;
  const t0 = c.currentTime + delay;
  const frames = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = lp;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(t0);
}

export function playSfx(name: string) {
  switch (name) {
    case "jump":
      tone({ freq: 420, to: 720, dur: 0.09, gain: 0.28 });
      break;
    case "land":
      noise({ dur: 0.07, gain: 0.16, lp: 900 });
      break;
    case "die":
      tone({ freq: 300, to: 60, dur: 0.28, type: "sawtooth", gain: 0.4 });
      noise({ dur: 0.22, gain: 0.3, lp: 700 });
      break;
    case "win":
      [523, 659, 784, 1046].forEach((f, i) =>
        tone({ freq: f, dur: 0.13, type: "triangle", gain: 0.4, delay: i * 0.075 }),
      );
      break;
    case "trap":
      tone({ freq: 180, to: 120, dur: 0.14, type: "sawtooth", gain: 0.34 });
      noise({ dur: 0.12, gain: 0.22, lp: 2200 });
      break;
    case "coin":
      tone({ freq: 988, dur: 0.06, type: "triangle", gain: 0.3 });
      tone({ freq: 1319, dur: 0.1, type: "triangle", gain: 0.3, delay: 0.06 });
      break;
    case "flip":
      tone({ freq: 620, to: 240, dur: 0.2, type: "sine", gain: 0.34 });
      break;
    case "crush":
      noise({ dur: 0.34, gain: 0.42, lp: 500 });
      tone({ freq: 90, to: 40, dur: 0.3, type: "sine", gain: 0.34 });
      break;
    default:
      break;
  }
}
