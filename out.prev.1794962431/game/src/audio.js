// Every sound in the game is made here with WebAudio oscillators and noise: an engine that
// follows the car's speed, gunshots, footsteps, sirens, crashes and mission jingles.
// Nothing is loaded from disk, and every call is safe to make before the browser allows sound.

export function createAudio() {
  const state = { ctx: null, master: null, engine: null, siren: null, noise: null, enabled: false };

  function ensure() {
    if (state.ctx) return state.ctx;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      state.ctx = new Ctx();
      state.master = state.ctx.createGain();
      state.master.gain.value = 0.42;
      state.master.connect(state.ctx.destination);
    } catch (error) {
      state.ctx = null;
    }
    return state.ctx;
  }

  function unlocked() {
    const ctx = ensure();
    if (!ctx) return false;
    if (ctx.state === 'suspended') ctx.resume();
    state.enabled = true;
    return true;
  }

  function noiseBurst(seconds, volume, cutoff) {
    const ctx = ensure();
    if (!ctx || !state.enabled) return;
    const frames = Math.floor(ctx.sampleRate * seconds);
    if (!state.noise) {
      state.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = state.noise.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = state.noise;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    source.connect(filter).connect(gain).connect(state.master);
    source.start(now);
    source.stop(now + seconds + 0.02);
    void frames;
  }

  function tone(freq, seconds, volume, type) {
    const ctx = ensure();
    if (!ctx || !state.enabled) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    osc.type = type ?? 'square';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    osc.connect(gain).connect(state.master);
    osc.start(now);
    osc.stop(now + seconds + 0.02);
  }

  function startEngine() {
    const ctx = ensure();
    if (!ctx || !state.enabled || state.engine) return;
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    sub.type = 'square';
    osc.frequency.value = 70;
    sub.frequency.value = 35;
    filter.type = 'lowpass';
    filter.frequency.value = 620;
    gain.gain.value = 0.0001;
    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain).connect(state.master);
    osc.start();
    sub.start();
    state.engine = { osc, sub, filter, gain };
  }

  function stopEngine() {
    const engine = state.engine;
    if (!engine || !state.ctx) return;
    state.engine = null;
    const now = state.ctx.currentTime;
    engine.gain.gain.setTargetAtTime(0.0001, now, 0.05);
    setTimeout(() => {
      try {
        engine.osc.stop();
        engine.sub.stop();
      } catch (error) {
        void error;
      }
    }, 180);
  }

  function engine(speedRatio) {
    if (!state.engine || !state.ctx) return;
    const now = state.ctx.currentTime;
    const ratio = Math.min(1, Math.abs(speedRatio));
    state.engine.osc.frequency.setTargetAtTime(64 + ratio * 150, now, 0.08);
    state.engine.sub.frequency.setTargetAtTime(32 + ratio * 60, now, 0.08);
    state.engine.filter.frequency.setTargetAtTime(520 + ratio * 1500, now, 0.1);
    state.engine.gain.gain.setTargetAtTime(0.05 + ratio * 0.09, now, 0.1);
  }

  function siren(level) {
    const ctx = ensure();
    if (!ctx || !state.enabled) return;
    if (!state.siren) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 780;
      gain.gain.value = 0.0001;
      osc.connect(gain).connect(state.master);
      osc.start();
      state.siren = { osc, gain, level: 0 };
    }
    const now = ctx.currentTime;
    const wanted = Math.min(1, level / 3);
    state.siren.gain.gain.setTargetAtTime(wanted > 0 ? 0.026 : 0.0001, now, 0.2);
    if (wanted > 0) {
      state.siren.osc.frequency.setTargetAtTime(
        Math.sin(now * 6.2) > 0 ? 900 : 640,
        now,
        0.04,
      );
    }
  }

  return {
    unlock() {
      return unlocked();
    },
    get running() {
      return state.enabled;
    },
    engineOn() {
      startEngine();
    },
    engineOff() {
      stopEngine();
    },
    engine,
    siren,
    shot() {
      noiseBurst(0.16, 0.5, 2600);
      tone(190, 0.08, 0.09, 'square');
    },
    copShot() {
      noiseBurst(0.13, 0.28, 1800);
    },
    step() {
      noiseBurst(0.05, 0.1, 900);
    },
    crash() {
      noiseBurst(0.3, 0.55, 700);
      tone(70, 0.22, 0.16, 'sawtooth');
    },
    hit() {
      noiseBurst(0.12, 0.3, 500);
    },
    blip() {
      tone(880, 0.07, 0.1, 'triangle');
    },
    cash() {
      tone(660, 0.1, 0.12, 'triangle');
      setTimeout(() => tone(990, 0.14, 0.12, 'triangle'), 90);
      setTimeout(() => tone(1320, 0.18, 0.1, 'triangle'), 190);
    },
    busted() {
      tone(300, 0.4, 0.16, 'sawtooth');
      setTimeout(() => tone(180, 0.6, 0.14, 'sawtooth'), 200);
    },
    horn() {
      tone(400, 0.22, 0.12, 'square');
    },
  };
}
