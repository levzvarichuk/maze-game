let ctx = null;
let enabled = true;

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

export function toggleMute() {
  enabled = !enabled;
  return enabled;
}

export function isEnabled() {
  return enabled;
}
