// Tiny WebAudio blips for the cartoon UI. No assets, all oscillators.
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, duration: number, type: OscillatorType, gainValue: number) {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, ac.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(gainValue, ac.currentTime + start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + duration + 0.05);
}

export function beepOk() {
  tone(660, 0, 0.12, 'sine', 0.08);
  tone(990, 0.1, 0.16, 'sine', 0.08);
}

export function beepCard() {
  tone(440, 0, 0.09, 'square', 0.05);
  tone(880, 0.09, 0.14, 'square', 0.05);
}

export function beepShutter() {
  tone(1200, 0, 0.05, 'square', 0.06);
  tone(500, 0.06, 0.08, 'square', 0.05);
}

export function beepAlarm() {
  tone(520, 0, 0.18, 'sawtooth', 0.05);
  tone(520, 0.24, 0.18, 'sawtooth', 0.05);
}
