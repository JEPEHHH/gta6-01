// Sound, synthesised with WebAudio and nothing else: a noise burst for gunfire, a saw through a
// low-pass for the engine that follows the speed, a two-tone siren, a thump for impacts, a blip of
// cash. The context is only created on the first real input, so a headless screenshot never waits
// on audio and a browser without WebAudio simply stays silent.
export function createAudio() {
  let ctx = null;
  let master = null;
  let noise = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenFlip = 0;
  let muted = false;
  let started = false;

  function start() {
    if (started) return ctx;
    started = true;
    try {
      const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContextClass) return null;
      ctx = new AudioContextClass();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.42;
      master.connect(ctx.destination);

      noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;

      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 52;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();

      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 660;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function burst(duration, gain, cutoff, type = 'highpass') {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = cutoff;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(gain, now);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(master);
    source.start(now);
    source.stop(now + duration + 0.02);
  }

  function tone(frequency, duration, gain, type = 'sine', slideTo = null) {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(gain, now);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(envelope);
    envelope.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  return {
    /** Called on the first key or click; safe to call often. */
    unlock() {
      start();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },
    engine(ratio, active) {
      if (!ctx) return;
      const now = ctx.currentTime;
      const value = Math.max(0, Math.min(1, ratio));
      engineOsc.frequency.setTargetAtTime(46 + value * 132, now, 0.08);
      engineFilter.frequency.setTargetAtTime(280 + value * 900, now, 0.1);
      engineGain.gain.setTargetAtTime(active ? 0.045 + value * 0.06 : 0, now, 0.12);
    },
    siren(on) {
      if (!ctx) return;
      const now = ctx.currentTime;
      sirenGain.gain.setTargetAtTime(on ? 0.022 : 0, now, 0.2);
      if (on) {
        sirenFlip += 1;
        sirenOsc.frequency.setTargetAtTime(sirenFlip % 2 === 0 ? 760 : 540, now, 0.18);
      }
    },
    shot(kind) {
      if (kind === 'shotgun') {
        burst(0.26, 0.5, 700, 'lowpass');
        tone(90, 0.16, 0.2, 'sine', 45);
      } else if (kind === 'smg') {
        burst(0.07, 0.28, 1800);
        tone(240, 0.05, 0.08, 'square', 120);
      } else {
        burst(0.12, 0.36, 1200);
        tone(180, 0.08, 0.12, 'square', 90);
      }
    },
    punch() {
      burst(0.09, 0.3, 500, 'lowpass');
      tone(120, 0.1, 0.14, 'sine', 70);
    },
    impact(strength = 0.6) {
      tone(70 + strength * 30, 0.22, 0.12 + strength * 0.18, 'sine', 40);
      burst(0.16, 0.16 + strength * 0.2, 380, 'lowpass');
    },
    cash() {
      tone(880, 0.09, 0.14, 'triangle');
      setTimeout(() => tone(1320, 0.12, 0.1, 'triangle'), 80);
    },
    click() {
      tone(520, 0.05, 0.06, 'square');
    },
    dry() {
      tone(160, 0.04, 0.06, 'square');
    },
    mission() {
      tone(392, 0.16, 0.11, 'triangle');
      setTimeout(() => tone(587, 0.2, 0.09, 'triangle'), 140);
    },
    missionComplete() {
      tone(523, 0.14, 0.12, 'triangle');
      setTimeout(() => tone(659, 0.14, 0.11, 'triangle'), 130);
      setTimeout(() => tone(784, 0.24, 0.1, 'triangle'), 260);
    },
    /** The garage: escaping air and paint, then a done chime. */
    respray() {
      burst(0.55, 0.2, 2600);
      setTimeout(() => tone(660, 0.12, 0.1, 'triangle'), 280);
      setTimeout(() => tone(990, 0.18, 0.09, 'triangle'), 400);
    },
    engineOn() {
      tone(120, 0.18, 0.1, 'sawtooth', 220);
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.42;
    },
    get muted() {
      return muted;
    },
  };
}
