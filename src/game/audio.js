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

/* ---------- Фоновая музыка: фортепианные арпеджио (Cmaj7 → Am7 → Fmaj7 → G) ---------- */

// Аккорды в частотах (Hz). Каждый — набор из 4 нот в возрастающем порядке.
// Прогрессия I - vi - IV - V — «Ghibli/медитация», консонансно и открыто.
const CHORDS = [
  [261.63, 329.63, 392.00, 493.88], // Cmaj7: C4 E4 G4 B4
  [220.00, 261.63, 329.63, 392.00], // Am7:   A3 C4 E4 G4
  [174.61, 261.63, 349.23, 440.00], // Fmaj7: F3 C4 F4 A4
  [196.00, 293.66, 392.00, 493.88], // G7:    G3 D4 G4 B4
];
// Паттерн арпеджио — восходяще-нисходящий по 4 тонам аккорда
const ARP_PATTERN = [0, 1, 2, 3, 2, 3, 1, 0];
const NOTE_INTERVAL = 1.1; // сек между нотами → ~55 BPM
const NOTE_DUR = 2.6;      // длительность каждой ноты (хвост перекрывается)

let arpStep = 0;
let musicDelay = null;
let musicLowpass = null;

// Фортепианная нота: основа + октава + квинта октавы, ADSR pluck-envelope
function pianoNote(ac, freq, when, peak) {
  const dur = NOTE_DUR;
  // Основной тон
  const o1 = ac.createOscillator();
  const g1 = ac.createGain();
  o1.type = 'sine';
  o1.frequency.value = freq;
  g1.gain.setValueAtTime(0, when);
  g1.gain.linearRampToValueAtTime(peak, when + 0.01);
  g1.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  o1.connect(g1);
  g1.connect(musicNode);
  if (musicDelay) g1.connect(musicDelay);
  o1.start(when);
  o1.stop(when + dur + 0.05);

  // Октава — тише, гаснет быстрее (даёт «звонкость» пианино)
  const o2 = ac.createOscillator();
  const g2 = ac.createGain();
  o2.type = 'sine';
  o2.frequency.value = freq * 2;
  g2.gain.setValueAtTime(0, when);
  g2.gain.linearRampToValueAtTime(peak * 0.35, when + 0.01);
  g2.gain.exponentialRampToValueAtTime(0.0001, when + dur * 0.55);
  o2.connect(g2);
  g2.connect(musicNode);
  o2.start(when);
  o2.stop(when + dur * 0.55 + 0.05);

  // Тройная октавы (квинта поверх октавы) — самая быстрая, добавляет металл-блеск
  const o3 = ac.createOscillator();
  const g3 = ac.createGain();
  o3.type = 'triangle';
  o3.frequency.value = freq * 3;
  g3.gain.setValueAtTime(0, when);
  g3.gain.linearRampToValueAtTime(peak * 0.12, when + 0.008);
  g3.gain.exponentialRampToValueAtTime(0.0001, when + dur * 0.35);
  o3.connect(g3);
  g3.connect(musicNode);
  o3.start(when);
  o3.stop(when + dur * 0.35 + 0.05);
}

function scheduleAmbientNote() {
  if (!musicNode) return;
  const ac = getCtx();
  if (!ac || !enabled) { noteTimer = setTimeout(scheduleAmbientNote, NOTE_INTERVAL * 1000); return; }

  const chordIdx = Math.floor(arpStep / ARP_PATTERN.length) % CHORDS.length;
  const noteIdx = ARP_PATTERN[arpStep % ARP_PATTERN.length];
  const chord = CHORDS[chordIdx];
  const freq = chord[noteIdx];

  // Первая нота аккорда — чуть громче (акцент)
  const isFirstOfChord = (arpStep % ARP_PATTERN.length) === 0;
  const peak = isFirstOfChord ? 0.11 : 0.08;

  pianoNote(ac, freq, ac.currentTime, peak);

  // Каждый 4-й такт (32 ноты) — добавим бас-ноту тоники аккорда для «якоря»
  if (isFirstOfChord) {
    const bassFreq = chord[0] / 2; // октавой ниже корня
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.value = bassFreq;
    g.gain.setValueAtTime(0, ac.currentTime);
    g.gain.linearRampToValueAtTime(0.06, ac.currentTime + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + NOTE_INTERVAL * ARP_PATTERN.length);
    o.connect(g).connect(musicNode);
    o.start(ac.currentTime);
    o.stop(ac.currentTime + NOTE_INTERVAL * ARP_PATTERN.length + 0.05);
  }

  arpStep++;
  noteTimer = setTimeout(scheduleAmbientNote, NOTE_INTERVAL * 1000);
}

export async function startAmbient() {
  if (musicNode) return;
  const ac = getCtx();
  if (!ac) return;
  try { await ac.resume(); } catch (_) { /* ignore */ }

  // Master gain (управляется toggleMute) → общий lowpass → destination
  musicNode = ac.createGain();
  musicNode.gain.value = enabled ? 1 : 0;

  musicLowpass = ac.createBiquadFilter();
  musicLowpass.type = 'lowpass';
  musicLowpass.frequency.value = 3500; // достаточно светло для пианино
  musicLowpass.Q.value = 0.5;

  musicNode.connect(musicLowpass).connect(ac.destination);

  // Большой концертный зал: длинный feedback delay
  musicDelay = ac.createDelay(3);
  musicDelay.delayTime.value = 0.42;
  const delayFeedback = ac.createGain();
  delayFeedback.gain.value = 0.5;
  const delayLowpass = ac.createBiquadFilter();
  delayLowpass.type = 'lowpass';
  delayLowpass.frequency.value = 2200;
  const delayReturn = ac.createGain();
  delayReturn.gain.value = 0.35;
  musicDelay.connect(delayLowpass);
  delayLowpass.connect(delayFeedback);
  delayFeedback.connect(musicDelay);
  delayLowpass.connect(delayReturn);
  delayReturn.connect(musicNode);

  arpStep = 0;

  // Первая нота — почти сразу, чтобы юзер услышал что музыка есть
  noteTimer = setTimeout(scheduleAmbientNote, 400);
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
