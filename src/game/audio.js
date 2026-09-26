let ctx = null;
let enabled = true;
let musicNode = null;
let noteTimer = null;

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { enabled = false; return null; }
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function beep({ freq = 440, dur = 0.08, type = 'sine', gain = 0.06, sweep = 0 }) {
  if (!enabled) return;
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + sweep), now + dur);
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(gain, now + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

export const sounds = {
  step:    () => beep({ freq: 180, dur: 0.04, type: 'square', gain: 0.03 }),
  correct: () => { beep({ freq: 523, dur: 0.12, type: 'triangle', gain: 0.08 });
                   setTimeout(() => beep({ freq: 784, dur: 0.16, type: 'triangle', gain: 0.08 }), 90); },
  wrong:   () => beep({ freq: 220, dur: 0.18, type: 'sawtooth', gain: 0.06, sweep: -80 }),
  win:     () => {
    beep({ freq: 523, dur: 0.15, type: 'triangle', gain: 0.09 });
    setTimeout(() => beep({ freq: 659, dur: 0.15, type: 'triangle', gain: 0.09 }), 130);
    setTimeout(() => beep({ freq: 784, dur: 0.15, type: 'triangle', gain: 0.09 }), 260);
    setTimeout(() => beep({ freq: 1046, dur: 0.35, type: 'triangle', gain: 0.09 }), 390);
  },
  locked:  () => beep({ freq: 140, dur: 0.22, type: 'sawtooth', gain: 0.05, sweep: -30 }),
};

/* ---------- Фоновая музыка: мрачный dungeon ambient ---------- */

const AMBIENT_NOTES = [293.66, 349.23, 392.00, 440.00, 523.25]; // D-минор пентатоника
const DRONE_FREQS = [73.42, 110.00]; // D2 + A2 (квинта)

function scheduleAmbientNote() {
  if (!musicNode) return;
  const ac = getCtx();
  if (!ac || !enabled) { noteTimer = setTimeout(scheduleAmbientNote, 4000); return; }

  const freq = AMBIENT_NOTES[Math.floor(Math.random() * AMBIENT_NOTES.length)];
  const now = ac.currentTime;
  const dur = 3.5 + Math.random() * 2.5;

  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.02, now + 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(g).connect(musicNode);
  osc.start(now);
  osc.stop(now + dur + 0.1);

  noteTimer = setTimeout(scheduleAmbientNote, 4000 + Math.random() * 8000);
}

export function startAmbient() {
  if (musicNode) return;
  const ac = getCtx();
  if (!ac) return;

  musicNode = ac.createGain();
  musicNode.gain.value = enabled ? 1 : 0;
  musicNode.connect(ac.destination);

  const now = ac.currentTime;
  for (const f of DRONE_FREQS) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.05, now + 2);
    osc.connect(g).connect(musicNode);
    osc.start(now);

    const lfo = ac.createOscillator();
    const lfoGain = ac.createGain();
    lfo.frequency.value = 0.08 + Math.random() * 0.1;
    lfoGain.gain.value = 2;
    lfo.connect(lfoGain).connect(osc.frequency);
    lfo.start(now);
  }

  noteTimer = setTimeout(scheduleAmbientNote, 3000);
}

export function stopAmbient() {
  if (noteTimer) { clearTimeout(noteTimer); noteTimer = null; }
  if (musicNode) {
    const ac = getCtx();
    if (ac) musicNode.gain.setTargetAtTime(0, ac.currentTime, 0.3);
  }
}

export function toggleMute() {
  enabled = !enabled;
  if (musicNode) {
    const ac = getCtx();
    if (ac) musicNode.gain.setTargetAtTime(enabled ? 1 : 0, ac.currentTime, 0.2);
  }
  return enabled;
}

export function isEnabled() {
  return enabled;
}
