import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js";

export function createAudioSystem({ camera, soundBtn, bgmToggle, state }) {
  const listener = new THREE.AudioListener();
  camera.add(listener);
  const audioCtx = listener.context;
  const masterGain = audioCtx.createGain();
  const bgmGain = audioCtx.createGain();
  const stringGain = audioCtx.createGain();
  const stringFilter = audioCtx.createBiquadFilter();
  const drumGain = audioCtx.createGain();
  const drumPattern = [
    ["kick", 0],
    ["hat", 0.78],
    ["snare", 1.55],
    ["hat", 2.33],
    ["kick", 3.1],
    ["hat", 3.88],
    ["snare", 4.65],
    ["hat", 5.43]
  ];
  const stringChords = [
    [138.59, 174.61, 207.65, 261.63, 311.13],
    [116.54, 138.59, 174.61, 207.65, 261.63],
    [130.81, 164.81, 196, 246.94, 293.66],
    [146.83, 174.61, 220, 261.63, 329.63],
    [155.56, 196, 233.08, 293.66, 349.23],
    [174.61, 220, 261.63, 329.63, 392],
    [164.81, 196, 246.94, 293.66, 369.99],
    [138.59, 174.61, 207.65, 261.63, 311.13]
  ];
  const stringVoices = [];
  let nextStringChordTime = 0;
  let stringChordIndex = 0;
  let boostEmptyLatched = false;

  masterGain.gain.value = 0.86;
  bgmGain.gain.value = 0;
  stringGain.gain.value = 0;
  drumGain.gain.value = 0.55;
  stringFilter.type = "lowpass";
  stringFilter.frequency.value = 1180;
  stringFilter.Q.value = 0.35;
  for (let i = 0; i < 5; i += 1) {
    const voiceGain = audioCtx.createGain();
    const main = audioCtx.createOscillator();
    const shimmer = audioCtx.createOscillator();
    main.type = "sawtooth";
    shimmer.type = "triangle";
    main.frequency.value = stringChords[0][i];
    shimmer.frequency.value = stringChords[0][i] * 2;
    main.detune.value = -4 + i * 1.8;
    shimmer.detune.value = 3 - i * 0.8;
    voiceGain.gain.value = 0;
    main.connect(voiceGain);
    shimmer.connect(voiceGain);
    voiceGain.connect(stringFilter);
    main.start();
    shimmer.start();
    stringVoices.push({ main, shimmer, gain: voiceGain });
  }
  stringFilter.connect(stringGain);
  stringGain.connect(bgmGain);
  drumGain.connect(bgmGain);
  bgmGain.connect(masterGain);
  masterGain.connect(audioCtx.destination);

  function tone(freq, duration = 0.08, type = "sine", gain = 0.04, delay = 0, destination = masterGain) {
    if (state.muted || audioCtx.state !== "running") return;
    const start = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const envelope = audioCtx.createGain();
    osc.frequency.value = freq;
    osc.type = type;
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.linearRampToValueAtTime(gain, start + 0.015);
    envelope.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(envelope);
    envelope.connect(destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  function noiseHit(delay, duration, gain, filterType, frequency) {
    if (state.muted || audioCtx.state !== "running") return;
    const start = audioCtx.currentTime + delay;
    const bufferSize = Math.max(1, Math.floor(audioCtx.sampleRate * duration));
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = audioCtx.createBufferSource();
    const filter = audioCtx.createBiquadFilter();
    const envelope = audioCtx.createGain();
    source.buffer = buffer;
    filter.type = filterType;
    filter.frequency.value = frequency;
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.linearRampToValueAtTime(gain, start + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.001, start + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(drumGain);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  function drumHit(kind, delay) {
    if (kind === "kick") {
      tone(72, 0.16, "sine", 0.055, delay, drumGain);
      tone(42, 0.22, "sine", 0.04, delay + 0.025, drumGain);
    } else if (kind === "snare") {
      noiseHit(delay, 0.18, 0.028, "bandpass", 1450);
      tone(190, 0.12, "triangle", 0.012, delay, drumGain);
    } else {
      noiseHit(delay, 0.055, 0.014, "highpass", 6800);
    }
  }

  function setSoundEnabled(enabled) {
    state.muted = !enabled;
    soundBtn.setAttribute("aria-label", state.muted ? "Sound off" : "Sound on");
    soundBtn.classList.toggle("is-muted", state.muted);
    masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
    masterGain.gain.setTargetAtTime(state.muted ? 0 : 0.86, audioCtx.currentTime, 0.04);
    if (bgmToggle) bgmToggle.checked = enabled;
  }

  soundBtn.addEventListener("click", () => {
    setSoundEnabled(state.muted);
    resume();
    soundBtn.blur();
  });

  if (bgmToggle) {
    bgmToggle.addEventListener("change", (event) => {
      setSoundEnabled(event.target.checked);
    });
  }

  function updateBgmAudio() {
    if (audioCtx.state !== "running") return;
    const now = audioCtx.currentTime;
    const active = !state.muted && state.running;
    bgmGain.gain.setTargetAtTime(active ? 0.36 : 0, now, 0.9);
    stringGain.gain.setTargetAtTime(active ? 0.78 : 0, now, 1.2);
    if (!active) return;

    if (now >= nextStringChordTime) {
      const chord = stringChords[stringChordIndex % stringChords.length];
      for (let i = 0; i < stringVoices.length; i += 1) {
        const voice = stringVoices[i];
        const freq = chord[i];
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
        voice.gain.gain.linearRampToValueAtTime(0.0001, now + 0.22);
        voice.main.frequency.setValueAtTime(freq, now + 0.24);
        voice.shimmer.frequency.setValueAtTime(freq * 2, now + 0.24);
        voice.gain.gain.linearRampToValueAtTime(0.009 + i * 0.0008, now + 1.0);
      }
      tone(chord[0] * 0.5, 4.8, "sine", 0.014, 0.34, bgmGain);
      tone(chord[1] * 0.5, 2.8, "sine", 0.007, 3.25, bgmGain);
      for (const [kind, delay] of drumPattern) {
        drumHit(kind, delay);
      }
      stringChordIndex += 1;
      nextStringChordTime = now + 6.2;
    }
  }

  function stopBgm() {
    if (audioCtx.state !== "running") return;
    const now = audioCtx.currentTime;
    const fade = 0.18;
    for (const g of [bgmGain.gain, stringGain.gain]) {
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0, now + fade);
    }
    for (const voice of stringVoices) {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
      voice.gain.gain.linearRampToValueAtTime(0, now + fade);
    }
    nextStringChordTime = Infinity;
  }

  function startBgm() {
    nextStringChordTime = 0;
  }

  function sparkleTone() {
    tone(1175, 0.09, "sine", 0.028);
    window.setTimeout(() => tone(1568, 0.08, "triangle", 0.022), 38);
    window.setTimeout(() => tone(2093, 0.12, "sine", 0.018), 74);
  }

  function rainbowTone() {
    const notes = [1047, 1319, 1568, 1976, 2349, 2637, 3136];
    notes.forEach((f, i) => {
      window.setTimeout(() => tone(f, 0.11, "sine", 0.024), i * 28);
      window.setTimeout(() => tone(f * 1.5, 0.08, "triangle", 0.014), i * 28 + 14);
    });
    window.setTimeout(() => tone(3951, 0.22, "sine", 0.026), 220);
    window.setTimeout(() => tone(4699, 0.18, "triangle", 0.018), 260);
  }

  function emptyBoostBuzz() {
    if (state.muted || audioCtx.state !== "running") return;
    const start = audioCtx.currentTime;
    const dur = 0.55;
    const bufferSize = Math.floor(audioCtx.sampleRate * dur);
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(800, start);
    filter.frequency.exponentialRampToValueAtTime(2600, start + dur);
    filter.Q.value = 0.9;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
    gain.gain.setValueAtTime(0.18, start + dur * 0.35);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    noise.start(start);
    noise.stop(start + dur + 0.02);
  }

  function playEmptyBoostOnce() {
    if (boostEmptyLatched) return;
    boostEmptyLatched = true;
    emptyBoostBuzz();
  }

  function resetEmptyBoostLatch() {
    boostEmptyLatched = false;
  }

  function resume() {
    return audioCtx.resume();
  }

  return {
    tone,
    setSoundEnabled,
    updateBgmAudio,
    stopBgm,
    startBgm,
    sparkleTone,
    rainbowTone,
    playEmptyBoostOnce,
    resetEmptyBoostLatch,
    resume
  };
}
