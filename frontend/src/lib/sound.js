let context = null;
let sizzle = null;

function audio() {
  if (!context) {
    const Context = window.AudioContext ?? window.webkitAudioContext;
    context = Context ? new Context() : null;
  }
  return context;
}

export function unlockSound() {
  audio()?.resume?.();
}

function voice(frequency, { at = 0, length = 1, peak = 0.2, type = 'sine' } = {}) {
  const ctx = audio();
  if (!ctx) {
    return;
  }
  const start = ctx.currentTime + at;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + length + 0.05);
}

function noise(seconds) {
  const ctx = audio();
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }
  return buffer;
}

function burst(seconds, { at = 0, frequency = 2000, sweep = frequency, q = 1, peak = 0.2 } = {}) {
  const ctx = audio();
  if (!ctx) {
    return;
  }
  const start = ctx.currentTime + at;
  const source = ctx.createBufferSource();
  source.buffer = noise(seconds);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(frequency, start);
  filter.frequency.exponentialRampToValueAtTime(sweep, start + seconds);
  filter.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(start);
}

export function playPrint() {
  [0, 0.26, 0.55, 0.84].forEach((at) => burst(0.13, { at, frequency: 2600, q: 3, peak: 0.12 }));
}

export function playCoin() {
  voice(1976, { length: 0.09, peak: 0.08, type: 'square' });
  voice(2637, { at: 0.07, length: 0.45, peak: 0.08, type: 'square' });
}

export function playFlare() {
  burst(0.7, { frequency: 420, sweep: 2200, q: 0.6, peak: 0.3 });
}

export function playBell() {
  [1318, 2637, 3951].forEach((frequency, index) =>
    voice(frequency, { length: 1.6 - index * 0.4, peak: 0.18 / (index + 1) }),
  );
}

export function playStamp() {
  voice(110, { length: 0.18, peak: 0.35, type: 'triangle' });
  voice(220, { length: 0.08, peak: 0.12, type: 'square' });
}

export function playChime() {
  [784, 988, 1175, 1568].forEach((frequency, index) =>
    voice(frequency, { at: index * 0.11, length: 0.7, peak: 0.12 }),
  );
}

export function playPop() {
  voice(660, { length: 0.12, peak: 0.12, type: 'triangle' });
}

export function startSizzle() {
  const ctx = audio();
  if (!ctx || sizzle) {
    return;
  }
  const source = ctx.createBufferSource();
  source.buffer = noise(2);
  source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 3200;
  filter.Q.value = 0.8;
  const gain = ctx.createGain();
  gain.gain.value = 0.035;
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start();
  sizzle = source;
}

export function stopSizzle() {
  sizzle?.stop();
  sizzle = null;
}
