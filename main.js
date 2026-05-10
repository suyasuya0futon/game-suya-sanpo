    import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js";

    const canvas = document.querySelector("#game");
    const scoreEl = document.querySelector("#score");
    const comboEl = document.querySelector("#combo");
    const shieldText = document.querySelector("#shieldText");
    const shieldBar = document.querySelector("#shieldBar");
    const timeEl = document.querySelector("#time");
    const menu = document.querySelector("#menu");
    const startBtn = document.querySelector("#start");
    const practiceBtn = document.querySelector("#practice");
    const soundBtn = document.querySelector("#sound");
    const flash = document.querySelector("#flash");
    const stick = document.querySelector("#stick");
    const knob = document.querySelector("#knob");
    const touchBoost = document.querySelector("#touchBoost");
    const spaceShade = document.querySelector("#spaceShade");

    function createSkyTexture() {
      const sky = document.createElement("canvas");
      sky.width = 32;
      sky.height = 512;
      const ctx = sky.getContext("2d");
      const gradient = ctx.createLinearGradient(0, 0, 0, sky.height);
      gradient.addColorStop(0, "#01040f");
      gradient.addColorStop(0.18, "#071033");
      gradient.addColorStop(0.38, "#1a2a60");
      gradient.addColorStop(0.62, "#574875");
      gradient.addColorStop(0.82, "#9d6159");
      gradient.addColorStop(1, "#d49b72");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, sky.width, sky.height);
      const texture = new THREE.CanvasTexture(sky);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }

    function createCloudTexture() {
      const cloud = document.createElement("canvas");
      cloud.width = 512;
      cloud.height = 192;
      const ctx = cloud.getContext("2d");
      ctx.clearRect(0, 0, cloud.width, cloud.height);

      for (let i = 0; i < 18; i += 1) {
        const x = 34 + Math.random() * 420;
        const y = 54 + Math.random() * 72;
        const rx = 42 + Math.random() * 82;
        const ry = 18 + Math.random() * 24;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, rx);
        glow.addColorStop(0, "rgba(255, 224, 202, 0.42)");
        glow.addColorStop(0.5, "rgba(220, 180, 205, 0.22)");
        glow.addColorStop(1, "rgba(220, 180, 205, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      const texture = new THREE.CanvasTexture(cloud);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }

    const scene = new THREE.Scene();
    scene.background = createSkyTexture();
    scene.fog = new THREE.FogExp2(0x253056, 0.007);

    const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 520);
    camera.position.set(0, 35, 28);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;

    const clock = new THREE.Clock();
    const lowFogColor = new THREE.Color(0x253056);
    const highFogColor = new THREE.Color(0x05091d);
    const keys = new Set();
    const pickups = [];
    const hazards = [];
    const rails = [];
    const clouds = [];
    const particles = [];
    const groundObjects = [];
    const obstacles = [];
    const lanes = [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5];
    const state = {
      running: false,
      practice: false,
      score: 0,
      combo: 1,
      shield: 100,
      time: 90,
      speed: 17,
      distance: 0,
      spawnTimer: 0,
      hazardTimer: 0,
      invulnerable: 0,
      boost: 0,
      boostFuel: 0,
      boostEmptyLatched: false,
      trailSpawnCarry: 0,
      rainbowTimer: 0,
      rainbowQueue: 0,
      muted: false,
      rings: 0,
      ended: false,
      crashed: false
    };

    const input = new THREE.Vector2();
    const touchInput = new THREE.Vector2();
    const playerBox = new THREE.Box3();
    const tempBox = new THREE.Box3();

    function altitudeFactor() {
      return THREE.MathUtils.smoothstep(ship.position.y, 24, 82);
    }

    const listener = new THREE.AudioListener();
    camera.add(listener);
    const audioCtx = listener.context;
    const masterGain = audioCtx.createGain();
    const engineGain = audioCtx.createGain();
    const engineFilter = audioCtx.createBiquadFilter();
    const engineOsc = audioCtx.createOscillator();
    const enginePulse = audioCtx.createOscillator();
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

    masterGain.gain.value = 0.86;
    engineGain.gain.value = 0;
    bgmGain.gain.value = 0;
    stringGain.gain.value = 0;
    drumGain.gain.value = 0.55;
    engineFilter.type = "lowpass";
    engineFilter.frequency.value = 520;
    engineOsc.type = "sawtooth";
    engineOsc.frequency.value = 82;
    enginePulse.type = "triangle";
    enginePulse.frequency.value = 164;
    stringFilter.type = "lowpass";
    stringFilter.frequency.value = 1180;
    stringFilter.Q.value = 0.35;
    engineOsc.connect(engineFilter);
    enginePulse.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(masterGain);
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
    engineOsc.start();
    enginePulse.start();

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
      soundBtn.textContent = "♫";
      soundBtn.setAttribute("aria-label", state.muted ? "Sound off" : "Sound on");
      soundBtn.classList.toggle("is-muted", state.muted);
      masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
      masterGain.gain.setTargetAtTime(state.muted ? 0 : 0.86, audioCtx.currentTime, 0.04);
    }

    function updateEngineAudio() {
      if (audioCtx.state !== "running") return;
      const now = audioCtx.currentTime;
      engineGain.gain.setTargetAtTime(0, now, 0.03);
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

    function emptyBoostClick() {
      if (state.muted || audioCtx.state !== "running") return;
      const start = audioCtx.currentTime;
      const duration = 0.026;
      const bufferSize = Math.max(1, Math.floor(audioCtx.sampleRate * duration));
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i += 1) {
        const falloff = 1 - i / bufferSize;
        data[i] = (Math.random() * 2 - 1) * falloff * falloff;
      }
      const source = audioCtx.createBufferSource();
      const highpass = audioCtx.createBiquadFilter();
      const bandpass = audioCtx.createBiquadFilter();
      const envelope = audioCtx.createGain();
      const tick = audioCtx.createOscillator();
      const tickGain = audioCtx.createGain();
      highpass.type = "highpass";
      highpass.frequency.value = 5200;
      bandpass.type = "bandpass";
      bandpass.frequency.value = 7600;
      bandpass.Q.value = 8;
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.linearRampToValueAtTime(0.026, start + 0.001);
      envelope.gain.exponentialRampToValueAtTime(0.001, start + duration);
      source.buffer = buffer;
      source.connect(highpass);
      highpass.connect(bandpass);
      bandpass.connect(envelope);
      envelope.connect(masterGain);
      tick.type = "square";
      tick.frequency.setValueAtTime(3100, start);
      tickGain.gain.setValueAtTime(0.010, start);
      tickGain.gain.exponentialRampToValueAtTime(0.001, start + 0.006);
      tick.connect(tickGain);
      tickGain.connect(masterGain);
      source.start(start);
      source.stop(start + duration + 0.01);
      tick.start(start);
      tick.stop(start + 0.008);
    }

    function playEmptyBoostOnce() {
      if (state.boostEmptyLatched) return;
      state.boostEmptyLatched = true;
      emptyBoostClick();
    }

    const ambient = new THREE.HemisphereLight(0xd7c6c5, 0x171f46, 1.45);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xd88972, 1.2);
    sun.position.set(-10, 9, -18);
    sun.castShadow = true;
    sun.shadow.camera.left = -24;
    sun.shadow.camera.right = 24;
    sun.shadow.camera.top = 24;
    sun.shadow.camera.bottom = -24;
    scene.add(sun);

    const cyanLight = new THREE.PointLight(0xffd285, 16, 34);
    cyanLight.position.set(0, 5, 8);
    scene.add(cyanLight);

    const magentaLight = new THREE.PointLight(0xff5f7e, 10, 28);
    magentaLight.position.set(8, 4, -8);
    scene.add(magentaLight);

    const moonDisk = new THREE.Mesh(
      new THREE.SphereGeometry(4.8, 48, 24),
      new THREE.MeshBasicMaterial({ color: 0xdde8ff, transparent: true, opacity: 0.38, fog: false })
    );
    moonDisk.position.set(-54, 116, -190);
    scene.add(moonDisk);

    const starGeo = new THREE.BufferGeometry();
    const starPositions = [];
    for (let i = 0; i < 620; i += 1) {
      starPositions.push(
        (Math.random() - 0.5) * 240,
        24 + Math.random() * 130,
        -35 - Math.random() * 220
      );
    }
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xf6fbff,
      size: 0.24,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      fog: false
    });
    const stars = new THREE.Points(
      starGeo,
      starMat
    );
    scene.add(stars);

    for (let i = 0; i < 8; i += 1) {
      const cloud = new THREE.Mesh(
        new THREE.PlaneGeometry(30 + Math.random() * 22, 9 + Math.random() * 7),
        new THREE.MeshBasicMaterial({
          map: createCloudTexture(),
          transparent: true,
          opacity: 0.34 + Math.random() * 0.22,
          depthWrite: false
        })
      );
      cloud.position.set(-64 + i * 18 + Math.random() * 8, 13 + Math.random() * 16, -62 - Math.random() * 54);
      cloud.userData.speed = 0.18 + Math.random() * 0.22;
      scene.add(cloud);
      clouds.push(cloud);
    }

    const grid = new THREE.Group();
    grid.position.z = -62;

    const ground = new THREE.Group();
    ground.position.set(0, -36, -115);
    scene.add(ground);

    const land = new THREE.Mesh(
      new THREE.CircleGeometry(80, 96),
      new THREE.MeshBasicMaterial({ color: 0x1c3b33, transparent: true, opacity: 0.7, depthWrite: false })
    );
    land.rotation.x = -Math.PI / 2;
    land.scale.set(1.6, 0.95, 1);
    land.position.set(-20, 0.05, -4);
    ground.add(land);

const forestPalette = [0x173326, 0x1f4434, 0x2a563f, 0x12281d, 0x365e3c];
    const forestMats = forestPalette.map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.78, depthWrite: false }));
    const coneGeoA = new THREE.ConeGeometry(1.0, 3.6, 7);
    const coneGeoB = new THREE.ConeGeometry(0.7, 4.6, 6);
    const canopyGeo = new THREE.SphereGeometry(1.1, 9, 7);
    function placeTree(x, z) {
      const variant = Math.random();
      const mat = forestMats[Math.floor(Math.random() * forestMats.length)];
      let tree;
      if (variant < 0.55) {
        tree = new THREE.Mesh(coneGeoA, mat);
      } else if (variant < 0.85) {
        tree = new THREE.Mesh(coneGeoB, mat);
      } else {
        tree = new THREE.Mesh(canopyGeo, mat);
      }
      tree.position.set(x, 1.8, z);
      const treeScale = 1.0 + Math.random() * 1.6;
      tree.scale.setScalar(treeScale);
      tree.rotation.y = Math.random() * Math.PI * 2;
      tree.userData.obstacle = true;
      tree.userData.halfSize = { x: 0.55 * treeScale, y: 2.0 * treeScale, z: 0.55 * treeScale };
      ground.add(tree);
      obstacles.push(tree);
    }
    const forestCarpet = new THREE.Mesh(
      new THREE.CircleGeometry(54, 48),
      new THREE.MeshBasicMaterial({ color: 0x10261b, transparent: true, opacity: 0.55, depthWrite: false })
    );
    forestCarpet.rotation.x = -Math.PI / 2;
    forestCarpet.scale.set(1.6, 0.9, 1);
    forestCarpet.position.set(-58, 0.12, -8);
    ground.add(forestCarpet);
    for (let i = 0; i < 160; i += 1) {
      placeTree(-104 + Math.random() * 92, -56 + Math.random() * 102);
    }

    const cityPalette = [0x26304e, 0x2f3a5c, 0x1d2540, 0x363f63, 0x222b48];
    const cityMats = cityPalette.map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.78, depthWrite: false }));
    const windowMat = new THREE.MeshBasicMaterial({ color: 0xffd98c, transparent: true, opacity: 0.92, depthWrite: false, blending: THREE.AdditiveBlending });
    const windowGeo = new THREE.PlaneGeometry(0.28, 0.34);
    const cityPlaza = new THREE.Mesh(
      new THREE.CircleGeometry(34, 36),
      new THREE.MeshBasicMaterial({ color: 0x141a2c, transparent: true, opacity: 0.7, depthWrite: false })
    );
    cityPlaza.rotation.x = -Math.PI / 2;
    cityPlaza.scale.set(1.4, 1.0, 1);
    cityPlaza.position.set(28, 0.12, -12);
    ground.add(cityPlaza);
    for (let i = 0; i < 56; i += 1) {
      const isSpire = Math.random() < 0.18;
      const w = isSpire ? 1.6 + Math.random() * 1.4 : 2.5 + Math.random() * 4;
      const d = isSpire ? w : 2.5 + Math.random() * 4;
      const h = isSpire ? 10 + Math.random() * 14 : 3 + Math.random() * 10;
      const mat = cityMats[Math.floor(Math.random() * cityMats.length)];
      const geo = isSpire ? new THREE.CylinderGeometry(w * 0.5, w * 0.6, h, 8) : new THREE.BoxGeometry(w, h, d);
      const building = new THREE.Mesh(geo, mat);
      building.position.set(2 + Math.random() * 54, h / 2, -44 + Math.random() * 56);
      building.userData.obstacle = true;
      building.userData.halfSize = { x: w / 2, y: h / 2, z: d / 2 };
      ground.add(building);
      obstacles.push(building);

      if (!isSpire) {
        const cols = Math.max(2, Math.floor(w / 0.9));
        const rows = Math.max(2, Math.floor(h / 1.1));
        const stepX = w / (cols + 1);
        const stepY = h / (rows + 1);
        for (let cx = 0; cx < cols; cx += 1) {
          for (let ry = 0; ry < rows; ry += 1) {
            if (Math.random() < 0.45) continue;
            const win = new THREE.Mesh(windowGeo, windowMat);
            win.position.set(
              building.position.x - w / 2 + stepX * (cx + 1),
              stepY * (ry + 1),
              building.position.z + d / 2 + 0.02
            );
            ground.add(win);
          }
        }
      } else {
        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), windowMat);
        beacon.position.set(building.position.x, h + 0.2, building.position.z);
        ground.add(beacon);
      }
    }

    groundObjects.push(ground);

    for (let i = 0; i < 36; i += 1) {
      const cloud = new THREE.Mesh(
        new THREE.PlaneGeometry(18 + Math.random() * 30, 6 + Math.random() * 12),
        new THREE.MeshBasicMaterial({
          map: createCloudTexture(),
          transparent: true,
          opacity: 0.36 + Math.random() * 0.34,
          depthWrite: false
        })
      );
      cloud.position.set((Math.random() - 0.5) * 74, 8 + Math.random() * 16, -12 - i * 9 - Math.random() * 18);
      cloud.rotation.z = (Math.random() - 0.5) * 0.12;
      cloud.userData.speed = 0.04 + Math.random() * 0.08;
      scene.add(cloud);
      rails.push(cloud);
      clouds.push(cloud);
    }

    const sparkleTexture = (() => {
      const size = 128;
      const cv = document.createElement("canvas");
      cv.width = cv.height = size;
      const ctx = cv.getContext("2d");
      const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0.0, "rgba(255,255,255,0.55)");
      grad.addColorStop(0.18, "rgba(255,255,255,0.32)");
      grad.addColorStop(0.45, "rgba(255,255,255,0.12)");
      grad.addColorStop(1.0, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    })();

    const ship = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x6fb0ff,
      emissive: 0x2a6fe0,
      emissiveIntensity: 2.1,
      metalness: 0.08,
      roughness: 0.18
    });
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x4f9bff,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    function createSleeveGeometry(side, length = 3.3, width = 1.0, lift = 0) {
      const segments = 18;
      const positions = [];
      const uvs = [];
      const indices = [];

      for (let i = 0; i <= segments; i += 1) {
        const t = i / segments;
        const taper = 1 - t * 0.72;
        const arch = Math.sin(t * Math.PI);
        const ripple = Math.sin(t * Math.PI * 2.2) * 0.08;
        const x = side * (0.22 + t * length);
        const y = lift + arch * 0.24 - t * 0.18;
        const z = 0.02 + t * 1.34 + ripple;
        const half = width * taper * (0.18 + arch * 0.82);

        positions.push(x, y + half * 0.2, z - half * 0.46);
        positions.push(x, y - half * 0.24, z + half * 0.42);
        uvs.push(t, 1, t, 0);

        if (i < segments) {
          const a = i * 2;
          indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return geometry;
    }

    function createSleeve(side) {
      const sleeve = new THREE.Group();
      const colors = [0xb6e2ff, 0x6fb8ff, 0x3d8eff];
      for (let i = 0; i < 3; i += 1) {
        const material = new THREE.MeshBasicMaterial({
          color: colors[i],
          transparent: true,
          opacity: 0.26 - i * 0.045,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        });
        const cloth = new THREE.Mesh(
          createSleeveGeometry(side, 2.85 + i * 0.42, 0.95 + i * 0.18, i * 0.035),
          material
        );
        cloth.userData.phase = i * 0.7 + side * 0.35;
        cloth.renderOrder = 3;
        sleeve.add(cloth);
      }
      return sleeve;
    }

    const body = new THREE.Group();
    const prismGeo = new THREE.BufferGeometry();
    prismGeo.setAttribute("position", new THREE.Float32BufferAttribute([
      0, 0.34, -0.95,
      -0.52, -0.18, 0.58,
      0.52, -0.18, 0.58,
      0, -0.42, 0.95
    ], 3));
    prismGeo.setIndex([
      0, 1, 2,
      0, 3, 1,
      0, 2, 3,
      1, 3, 2
    ]);
    prismGeo.computeVertexNormals();
    const prism = new THREE.Mesh(prismGeo, bodyMat);
    prism.scale.set(0.85, 0.72, 1.05);
    body.add(prism);

    const coreLight = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sparkleTexture,
      color: 0x9fd4ff,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending
    }));
    coreLight.scale.set(1.4, 1.4, 1);
    body.add(coreLight);
    ship.add(body);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sparkleTexture,
      color: 0x7fc2ff,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      depthTest: false,
      fog: false,
      blending: THREE.AdditiveBlending
    }));
    glow.scale.set(5.6, 4.0, 1);
    glow.position.set(0, 0.02, 0.08);
    glow.renderOrder = 2;
    ship.add(glow);

    const halo = new THREE.Mesh(new THREE.RingGeometry(1.15, 2.55, 96), new THREE.MeshBasicMaterial({
      color: 0x6fb8ff,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }));
    halo.rotation.x = Math.PI / 2;
    halo.position.z = 0.08;
    ship.add(halo);

    const angelHalo = new THREE.Group();
    const angelRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.48, 0.055, 14, 128),
      new THREE.MeshBasicMaterial({
        color: 0xfff0c8,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        depthTest: false,
        fog: false,
        blending: THREE.AdditiveBlending
      })
    );
    angelRing.rotation.x = Math.PI / 2;
    angelRing.renderOrder = 8;
    const angelGlow = new THREE.Mesh(
      new THREE.RingGeometry(1.2, 1.86, 128),
      new THREE.MeshBasicMaterial({
        color: 0xffe6b0,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false,
        fog: false,
        blending: THREE.AdditiveBlending
      })
    );
    angelGlow.rotation.x = Math.PI / 2;
    angelGlow.renderOrder = 7;
    angelHalo.add(angelGlow, angelRing);
    angelHalo.position.set(0, 1.55, 0.02);
    angelHalo.visible = false;
    ship.add(angelHalo);

    const sleeveL = createSleeve(-1);
    const sleeveR = createSleeve(1);
    sleeveL.rotation.z = 0.18;
    sleeveR.rotation.z = -0.18;
    ship.add(sleeveL, sleeveR);

    const engine = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sparkleTexture,
      color: 0xffffff,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      depthTest: false,
      fog: false,
      blending: THREE.AdditiveBlending
    }));
    engine.scale.set(0.55, 0.55, 1);
    engine.position.set(0, -0.42, 0.95);
    engine.renderOrder = 5;
    ship.add(engine);

    const engineHalo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sparkleTexture,
      color: 0x4f9bff,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      depthTest: false,
      fog: false,
      blending: THREE.AdditiveBlending
    }));
    engineHalo.scale.set(1.4, 1.0, 1);
    engineHalo.position.set(0, -0.42, 0.9);
    engineHalo.renderOrder = 4;
    ship.add(engineHalo);

    const shipLight = new THREE.PointLight(0x4f9bff, 2.6, 12);
    shipLight.position.set(0, 0.2, 0.2);
    ship.add(shipLight);
    ship.position.set(0, 26, 4);
    scene.add(ship);

    const shadowTexture = (() => {
      const size = 128;
      const cv = document.createElement("canvas");
      cv.width = cv.height = size;
      const ctx = cv.getContext("2d");
      const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0.0, "rgba(0,0,0,0.62)");
      grad.addColorStop(0.4, "rgba(0,0,0,0.28)");
      grad.addColorStop(1.0, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      return new THREE.CanvasTexture(cv);
    })();
    const shipShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: shadowTexture,
        color: 0x000000,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false
      })
    );
    shipShadow.rotation.x = -Math.PI / 2;
    shipShadow.scale.set(3, 3, 1);
    scene.add(shipShadow);

    const pickupGeo = new THREE.TorusGeometry(3.05, 0.06, 12, 128);
    const pickupMat = new THREE.MeshBasicMaterial({
      color: 0xffd84d,
      fog: false,
      depthTest: false
    });
    const SPARKLE_COUNT = 40;
    const RAINBOW_SPARKLE_COUNT = 96;
    const sparkleMaterial = new THREE.PointsMaterial({
      map: sparkleTexture,
      color: 0xffe9a8,
      size: 1.8,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      depthTest: false,
      fog: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    const rainbowSparkleMaterial = new THREE.PointsMaterial({
      map: sparkleTexture,
      color: 0xffffff,
      size: 2.15,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      depthTest: false,
      fog: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    function createSparkleRing(count = SPARKLE_COUNT, material = sparkleMaterial) {
      const positions = new Float32Array(count * 3);
      const phase = new Float32Array(count);
      const baseAngle = new Float32Array(count);
      const baseRadius = new Float32Array(count);
      const angularSpeed = new Float32Array(count);
      for (let i = 0; i < count; i += 1) {
        const a = (i / count) * Math.PI * 2 + Math.random() * 0.18;
        const r = 3.0 + (Math.random() - 0.5) * 0.55;
        baseAngle[i] = a;
        baseRadius[i] = r;
        phase[i] = Math.random() * Math.PI * 2;
        angularSpeed[i] = (Math.random() - 0.5) * 0.4;
        positions[i * 3] = Math.cos(a) * r;
        positions[i * 3 + 1] = Math.sin(a) * r;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 0.12;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const points = new THREE.Points(geo, material);
      points.userData.phase = phase;
      points.userData.baseAngle = baseAngle;
      points.userData.baseRadius = baseRadius;
      points.userData.angularSpeed = angularSpeed;
      points.userData.count = count;
      return points;
    }

    function createRainbowPickupRing(hueBase = 0) {
      const group = new THREE.Group();
      const segments = 7;
      const arc = (Math.PI * 2) / segments;
      for (let i = 0; i < segments; i += 1) {
        const color = new THREE.Color().setHSL((hueBase + i / segments) % 1, 1.0, 0.58);
        const material = new THREE.MeshBasicMaterial({
          color,
          fog: false,
          depthTest: false,
          transparent: true,
          opacity: 1
        });
        const glowMaterial = new THREE.MeshBasicMaterial({
          color,
          fog: false,
          depthTest: false,
          transparent: true,
          opacity: 0.34,
          blending: THREE.AdditiveBlending
        });
        const segment = new THREE.Mesh(new THREE.TorusGeometry(3.05, 0.095, 14, 24, arc * 0.94), material);
        const glow = new THREE.Mesh(new THREE.TorusGeometry(3.08, 0.24, 12, 24, arc * 0.94), glowMaterial);
        segment.rotation.z = i * arc;
        glow.rotation.z = i * arc;
        group.add(glow, segment);
      }
      return group;
    }

    function disposeRenderable(object) {
      object.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
          else child.material.dispose();
        }
      });
    }
    const hazardGeo = new THREE.IcosahedronGeometry(0.95, 0);
    const hazardMat = new THREE.MeshStandardMaterial({
      color: 0xff5f7e,
      emissive: 0xff244f,
      emissiveIntensity: 1.4,
      roughness: 0.3,
      metalness: 0.2
    });
    const trailGeo = new THREE.SphereGeometry(0.035, 8, 6);
    const trailColors = [0xfffbe6, 0xffe49a, 0xffc870];
    const boostTrailColors = [0xfff8c0, 0xffd66b, 0xff9a2a];

    const BOOST_FUEL_PER_RING = 0.3;
    const RAINBOW_RING_MULTIPLIER = 3;
    const TRAIL_PER_BOOST_SECOND = 10;
    const BOOST_TRAIL_MULTIPLIER = 30;
    const TRAIL_SPAWN_RATE = 12;
    const BOOST_SPEED_MULTIPLIER = 3;
    const TRAIL_MAX = 200;
    const colorNormal = {
      body: new THREE.Color(0x6fb0ff),
      bodyEmissive: new THREE.Color(0x2a6fe0),
      glow: new THREE.Color(0x7fc2ff),
      core: new THREE.Color(0x9fd4ff),
      halo: new THREE.Color(0x6fb8ff),
      engineHalo: new THREE.Color(0x4f9bff),
      light: new THREE.Color(0x4f9bff),
      sleeve0: new THREE.Color(0xb6e2ff),
      sleeve1: new THREE.Color(0x6fb8ff),
      sleeve2: new THREE.Color(0x3d8eff)
    };
    const colorBoost = {
      body: new THREE.Color(0xffe07a),
      bodyEmissive: new THREE.Color(0xffa830),
      glow: new THREE.Color(0xffd24a),
      core: new THREE.Color(0xfff6c8),
      halo: new THREE.Color(0xffd24a),
      engineHalo: new THREE.Color(0xffb13a),
      light: new THREE.Color(0xffc24a),
      sleeve0: new THREE.Color(0xfff2b8),
      sleeve1: new THREE.Color(0xffd24a),
      sleeve2: new THREE.Color(0xff9a28)
    };
    const colorCrashed = {
      body: new THREE.Color(0xc9d2dc),
      bodyEmissive: new THREE.Color(0x3c5268),
      sleeve: new THREE.Color(0xdce7f1)
    };

    function setShipCrashed(crashed) {
      state.crashed = crashed;
      angelHalo.visible = crashed;
      bodyMat.color.copy(crashed ? colorCrashed.body : colorNormal.body);
      bodyMat.emissive.copy(crashed ? colorCrashed.bodyEmissive : colorNormal.bodyEmissive);
      bodyMat.emissiveIntensity = crashed ? 0.36 : 2.1;
      glow.material.opacity = crashed ? 0.16 : 1.0;
      coreLight.material.opacity = crashed ? 0.28 : 0.95;
      halo.material.opacity = crashed ? 0.08 : 0.2;
      engine.material.opacity = crashed ? 0 : 1.0;
      engineHalo.material.opacity = crashed ? 0 : 0.7;
      shipLight.intensity = crashed ? 0.15 : 2.6;
      for (const sleeve of [sleeveL, sleeveR]) {
        sleeve.children.forEach((cloth, index) => {
          cloth.material.color.copy(crashed ? colorCrashed.sleeve : colorNormal[`sleeve${index}`]);
          cloth.material.opacity = crashed ? 0.14 : 0.26 - index * 0.045;
        });
      }
    }

    function resetObjects() {
      for (const item of [...pickups, ...hazards, ...particles]) {
        scene.remove(item);
      }
      pickups.length = 0;
      hazards.length = 0;
      particles.length = 0;
    }

    function spawnPickup(opts = {}) {
      const pickup = new THREE.Group();
      const isRainbow = !!opts.rainbow;
      const hue = opts.hue ?? 0;
      let ringMat = pickupMat;
      let haloMat = sparkleMaterial;
      if (isRainbow) {
        const tint = new THREE.Color().setHSL(hue, 1.0, 0.58);
        haloMat = rainbowSparkleMaterial.clone();
        haloMat.color.set(0xffffff).lerp(tint, 0.92);
      }
      const halo = isRainbow
        ? createSparkleRing(RAINBOW_SPARKLE_COUNT, haloMat)
        : createSparkleRing();
      const ring = isRainbow ? createRainbowPickupRing(hue) : new THREE.Mesh(pickupGeo, ringMat);
      const lightColor = isRainbow ? 0xffffff : 0xffd35a;
      const ringLight = new THREE.PointLight(lightColor, isRainbow ? 3.5 : 2.6, 18);
      ring.renderOrder = 6;
      halo.renderOrder = 5;
      pickup.add(ring, halo, ringLight);
      if (!state.lastRing) state.lastRing = { x: 0, y: state.running ? ship.position.y : 28 };
      let nextX, nextY;
      if (isRainbow) {
        const idx = opts.idx ?? 0;
        nextX = THREE.MathUtils.clamp(state.lastRing.x + Math.cos(idx * 0.9) * 1.5, -10, 10);
        nextY = THREE.MathUtils.clamp(state.lastRing.y + Math.sin(idx * 0.9) * 1.4, -32, 86);
      } else {
        nextX = THREE.MathUtils.clamp(state.lastRing.x + (Math.random() - 0.5) * 8, -10, 10);
        const r = Math.random();
        if (r < 0.18) {
          nextY = -32 + Math.random() * 14;
        } else if (r < 0.32) {
          nextY = 55 + Math.random() * 30;
        } else {
          nextY = THREE.MathUtils.clamp(state.lastRing.y + (Math.random() - 0.5) * 16, -32, 88);
        }
      }
      state.lastRing.x = nextX;
      state.lastRing.y = nextY;
      pickup.position.set(nextX, nextY, -72 - Math.random() * 18);
      pickup.rotation.set(0, 0, Math.random() * Math.PI);
      pickup.userData.value = 100;
      pickup.userData.innerRadius = 2.72;
      pickup.userData.rainbow = isRainbow;
      scene.add(pickup);
      pickups.push(pickup);
    }

    function spawnHazard() {
      return null;
    }

    function burst(position, color, count = 14) {
      const mat = new THREE.MeshBasicMaterial({ color });
      for (let i = 0; i < count; i += 1) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.09), mat);
        p.position.copy(position);
        p.userData.velocity = new THREE.Vector3(
          (Math.random() - 0.5) * 8,
          Math.random() * 5,
          (Math.random() - 0.5) * 8
        );
        p.userData.life = 0.55 + Math.random() * 0.35;
        scene.add(p);
        particles.push(p);
      }
    }

    function spawnOneTrail(boostAmount = state.boost) {
      const rbTrail = Math.min(0.18, state.rainbowTimer / 8 * 0.18);
      const colorIdx = Math.floor(Math.random() * trailColors.length);
      const trailColor = new THREE.Color(trailColors[colorIdx]).lerp(new THREE.Color(boostTrailColors[colorIdx]), boostAmount);
      if (rbTrail > 0) {
        const hue = (clock.elapsedTime * 0.35 + Math.random() * 0.3) % 1;
        trailColor.lerp(new THREE.Color().setHSL(hue, 0.46, 0.64), rbTrail);
      }
      const spread = 1 + boostAmount * 1.8;
      const mat = new THREE.SpriteMaterial({
        map: sparkleTexture,
        color: trailColor,
        transparent: true,
        opacity: THREE.MathUtils.lerp(0.85, 0.68, boostAmount),
        depthTest: false,
        depthWrite: false,
        fog: false,
        blending: THREE.AdditiveBlending
      });
      const p = new THREE.Sprite(mat);
      p.position.set(
        ship.position.x + (Math.random() - 0.5) * 0.32 * spread,
        ship.position.y - 0.45 + (Math.random() - 0.5) * 0.5 * spread,
        ship.position.z + 0.45 + Math.random() * (0.6 + boostAmount * 0.9)
      );
      const angle = (Math.random() - 0.5) * 0.95 * (1 + boostAmount * 1.35);
      const angleY = (Math.random() - 0.5) * 0.55 * (1 + boostAmount * 1.65);
      const speed = 2.7 + Math.random() * 2.4 + boostAmount * 0.9;
      p.userData.velocity = new THREE.Vector3(
        Math.sin(angle) * speed - input.x * 0.18,
        Math.sin(angleY) * speed * 0.5 - 0.16 + boostAmount * 0.1,
        Math.cos(angle) * speed
      );
      p.userData.life = 1.6 + Math.random() * 1.2 + boostAmount * 0.55;
      p.userData.maxLife = p.userData.life;
      p.userData.trail = true;
      p.userData.startScale = 0.28 + Math.random() * 0.18 + boostAmount * 0.05;
      p.userData.endScale = p.userData.startScale + 1.4 + Math.random() * 1.2 + boostAmount * 1.2;
      p.renderOrder = 4;
      p.scale.setScalar(p.userData.startScale);
      scene.add(p);
      particles.push(p);
    }

    function resetGame(practice = false) {
      resetObjects();
      state.running = true;
      startBgm();
      state.practice = practice;
      state.score = 0;
      state.combo = 1;
      state.shield = 100;
      state.time = 9999;
      state.speed = practice ? 14 : 17;
      state.distance = 0;
      state.spawnTimer = 0.1;
      state.hazardTimer = 9999;
      state.invulnerable = 1.0;
      state.boost = 0;
      state.boostFuel = 0;
      state.boostEmptyLatched = false;
      state.trailSpawnCarry = 0;
      state.rainbowTimer = 0;
      state.rainbowQueue = 0;
      state.lastRing = { x: 0, y: 26 };
      state.rings = 0;
      state.ended = false;
      setShipCrashed(false);
      menu.classList.remove("is-result");
      ship.position.set(0, 26, 4);
      ship.rotation.set(0, 0, 0);
      menu.hidden = true;
      updateHud();
    }

    function endGame(title, detail) {
      state.running = false;
      stopBgm();
      state.ended = true;
      setShipCrashed(true);
      menu.hidden = false;
      menu.classList.add("is-result");
      const h1 = menu.querySelector("h1");
      h1.textContent = title;
      h1.hidden = !title;
      menu.querySelector(".lead").textContent = detail;
      startBtn.textContent = "RETRY";
      if (practiceBtn) practiceBtn.textContent = "";
    }

    function updateHud() {
      scoreEl.textContent = state.rings.toLocaleString("ja-JP");
      comboEl.textContent = "";
      shieldText.textContent = "";
      shieldBar.style.transform = `scaleX(${Math.max(0, state.shield) / 100})`;
      shieldBar.style.background = state.shield < 34
        ? "linear-gradient(90deg, var(--red), var(--amber))"
        : "linear-gradient(90deg, var(--lime), var(--cyan))";
      timeEl.textContent = "∞";
    }

    function updateInput() {
      input.set(0, 0);
      if (keys.has("KeyA") || keys.has("ArrowLeft")) input.x -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) input.x += 1;
      if (keys.has("KeyW") || keys.has("ArrowUp")) input.y += 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) input.y -= 1;
      input.add(touchInput);
      if (input.lengthSq() > 1) input.normalize();
    }

    function isShipThroughRing(ring) {
      const dx = ship.position.x - ring.position.x;
      const dy = ship.position.y - ring.position.y;
      const dz = Math.abs(ship.position.z - ring.position.z);
      const radius = ring.userData.innerRadius + state.boost * 1.8;
      const depth = 1.45 + state.boost * 1.0;
      return dz < depth && Math.hypot(dx, dy) < radius;
    }

    function collect(item, index) {
      state.rings += 1;
      const isRainbow = item.userData.rainbow;
      const rewardMultiplier = isRainbow ? RAINBOW_RING_MULTIPLIER : 1;
      state.boostFuel += BOOST_FUEL_PER_RING * rewardMultiplier;
      state.boostEmptyLatched = false;
      burst(item.position, isRainbow ? 0xffffff : 0xffd66b, isRainbow ? 36 : 24);
      if (isRainbow) {
        rainbowTone();
        state.rainbowTimer = 8;
      } else {
        sparkleTone();
      }
      const ring = item.children[0];
      const halo = item.children[1];
      if (halo && halo.geometry) halo.geometry.dispose();
      if (isRainbow) {
        if (ring) disposeRenderable(ring);
        if (halo && halo.material) halo.material.dispose();
      }
      scene.remove(item);
      pickups.splice(index, 1);
    }

    function hit(item, index) {
      if (state.invulnerable > 0) return;
      state.shield -= 24;
      state.combo = 1;
      state.invulnerable = 1.2;
      burst(item.position, 0xff5f7e, 22);
      tone(120, 0.16, "sawtooth", 0.04);
      flash.classList.add("on");
      window.setTimeout(() => flash.classList.remove("on"), 120);
      scene.remove(item);
      hazards.splice(index, 1);
      if (state.shield <= 0) {
        endGame("Crash", `Score ${state.score.toLocaleString("ja-JP")}。シールドが尽きました。`);
      }
    }

    function crash() {
      if (state.invulnerable > 0 || !state.running) return;
      burst(ship.position, 0xff8866, 40);
      tone(80, 0.35, "sawtooth", 0.06);
      flash.classList.add("on");
      window.setTimeout(() => flash.classList.remove("on"), 240);
      endGame("", `障害物に衝突しました。`);
    }

    function stepObjects(dt) {
      const forward = state.speed * dt;
      state.distance += forward;
      grid.position.z = -62 + (state.distance % 7);

      for (const item of rails) {
        item.position.z += forward;
        if (item.position.z > 18) item.position.z -= 256;
      }
      for (const item of groundObjects) {
        item.position.z += forward * 0.4;
        if (item.position.z > 80) item.position.z -= 320;
      }

      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        if (state.rainbowQueue > 0) {
          const total = 7;
          const idx = total - state.rainbowQueue;
          spawnPickup({ rainbow: true, hue: 0.1 + (idx / total) * 0.75, idx });
          state.rainbowQueue -= 1;
          state.spawnTimer = state.rainbowQueue > 0 ? 0.45 : 2.4 + Math.random() * 2.0;
        } else {
          spawnPickup();
          if (Math.random() < 0.07) {
            state.rainbowQueue = 7;
            state.spawnTimer = 1.8;
          } else if (Math.random() < 0.4) {
            state.spawnTimer = 0.4 + Math.random() * 0.9;
          } else {
            state.spawnTimer = 1.6 + Math.random() * 3.4;
          }
        }
      }

      playerBox.setFromObject(ship);
      for (let i = pickups.length - 1; i >= 0; i -= 1) {
        const item = pickups[i];
        item.position.z += forward;
        item.rotation.z += dt * 0.8;
        item.position.y += Math.sin(clock.elapsedTime * 2.2 + item.position.x) * dt * 0.42;
        const halo = item.children[1];
        if (halo && halo.isPoints) {
          const t = clock.elapsedTime;
          const pos = halo.geometry.attributes.position;
          const arr = pos.array;
          const ud = halo.userData;
          const count = ud.count || SPARKLE_COUNT;
          for (let s = 0; s < count; s += 1) {
            const angle = ud.baseAngle[s] + ud.angularSpeed[s] * t;
            const radius = ud.baseRadius[s] + Math.sin(t * 2.0 + ud.phase[s]) * 0.22;
            arr[s * 3] = Math.cos(angle) * radius;
            arr[s * 3 + 1] = Math.sin(angle) * radius;
          }
          pos.needsUpdate = true;
        }
        if (isShipThroughRing(item)) collect(item, i);
        else if (item.position.z > 14) {
          if (halo && halo.geometry) halo.geometry.dispose();
          if (item.userData.rainbow) {
            const r = item.children[0];
            if (r) disposeRenderable(r);
            if (halo && halo.material) halo.material.dispose();
          }
          scene.remove(item);
          pickups.splice(i, 1);
          state.combo = Math.max(1, state.combo - 1);
        }
      }

      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.userData.life -= dt;
        if (!p.userData.trail) {
          p.userData.velocity.y -= dt * 5.6;
        }
        p.position.addScaledVector(p.userData.velocity, dt);
        if (p.userData.trail) {
          const t = Math.max(0, p.userData.life / p.userData.maxLife);
          const age = 1 - t;
          p.material.opacity = t * t * 0.85;
          p.scale.setScalar(p.userData.startScale + age * (p.userData.endScale - p.userData.startScale));
        } else {
          p.scale.setScalar(Math.max(0.05, p.userData.life));
        }
        if (p.userData.life <= 0) {
          scene.remove(p);
          if (p.userData.trail) p.material.dispose();
          particles.splice(i, 1);
        }
      }

      if (state.invulnerable <= 0) {
        const sx = 0.9 + state.boost * 0.5;
        const sy = 0.22;
        const sz = 0.45;
        for (const o of obstacles) {
          const wx = ground.position.x + o.position.x;
          const wy = ground.position.y + o.position.y;
          const wz = ground.position.z + o.position.z;
          const hs = o.userData.halfSize;
          if (Math.abs(wz - ship.position.z) > hs.z + sz) continue;
          if (Math.abs(wx - ship.position.x) > hs.x + sx) continue;
          if (ship.position.y > wy + hs.y + sy) continue;
          if (ship.position.y < wy - hs.y - sy) continue;
          crash();
          break;
        }
      }
    }

    function animate() {
      requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.04);
      updateInput();
      stars.rotation.y = Math.sin(clock.elapsedTime * 0.05) * 0.015;

      for (const cloud of clouds) {
        cloud.position.x += cloud.userData.speed * dt;
        cloud.position.y += Math.sin(clock.elapsedTime * 0.18 + cloud.position.z) * dt * 0.08;
        if (cloud.position.x > 78) cloud.position.x = -82;
      }

      const high = altitudeFactor();
      scene.fog.color.copy(lowFogColor).lerp(highFogColor, high);
      scene.fog.density = THREE.MathUtils.lerp(0.007, 0.0032, high);
      renderer.toneMappingExposure = THREE.MathUtils.lerp(0.95, 0.74, high);
      ambient.intensity = THREE.MathUtils.lerp(1.45, 0.74, high);
      sun.intensity = THREE.MathUtils.lerp(1.2, 0.28, high);
      moonDisk.material.opacity = THREE.MathUtils.lerp(0.34, 0.92, high);
      starMat.opacity = THREE.MathUtils.lerp(0.68, 1, high);
      if (spaceShade) spaceShade.style.opacity = (high * 0.78).toFixed(3);

      if (state.running) {
        state.invulnerable = Math.max(0, state.invulnerable - dt);
        const wantsBoost = keys.has("Space");
        const boosting = wantsBoost && state.boostFuel > 0;
        if (boosting) {
          state.boostFuel = Math.max(0, state.boostFuel - dt);
          if (state.boostFuel <= 0) playEmptyBoostOnce();
        } else if (wantsBoost) {
          playEmptyBoostOnce();
        } else {
          state.boostEmptyLatched = false;
        }
        state.boost += ((boosting ? 1 : 0) - state.boost) * Math.min(1, dt * 7);

        state.rainbowTimer = Math.max(0, state.rainbowTimer - dt);
        const rb = Math.min(1, state.rainbowTimer / 8);
        const b = state.boost;
        const tmpRainbow = new THREE.Color();
        const hueBase = (clock.elapsedTime * 0.35) % 1;
        function applyRainbow(target, hueOffset) {
          if (rb <= 0) return;
          tmpRainbow.setHSL((hueBase + hueOffset) % 1, 1.0, 0.56);
          target.lerp(tmpRainbow, rb);
        }
        bodyMat.color.lerpColors(colorNormal.body, colorBoost.body, b);
        applyRainbow(bodyMat.color, 0.0);
        bodyMat.emissive.lerpColors(colorNormal.bodyEmissive, colorBoost.bodyEmissive, b);
        applyRainbow(bodyMat.emissive, 0.05);
        glow.material.color.lerpColors(colorNormal.glow, colorBoost.glow, b);
        applyRainbow(glow.material.color, 0.1);
        coreLight.material.color.lerpColors(colorNormal.core, colorBoost.core, b);
        applyRainbow(coreLight.material.color, 0.15);
        halo.material.color.lerpColors(colorNormal.halo, colorBoost.halo, b);
        applyRainbow(halo.material.color, 0.2);
        engineHalo.material.color.lerpColors(colorNormal.engineHalo, colorBoost.engineHalo, b);
        applyRainbow(engineHalo.material.color, 0.25);
        shipLight.color.lerpColors(colorNormal.light, colorBoost.light, b);
        applyRainbow(shipLight.color, 0.1);
        sleeveL.children[0].material.color.lerpColors(colorNormal.sleeve0, colorBoost.sleeve0, b);
        applyRainbow(sleeveL.children[0].material.color, 0.3);
        sleeveL.children[1].material.color.lerpColors(colorNormal.sleeve1, colorBoost.sleeve1, b);
        applyRainbow(sleeveL.children[1].material.color, 0.4);
        sleeveL.children[2].material.color.lerpColors(colorNormal.sleeve2, colorBoost.sleeve2, b);
        applyRainbow(sleeveL.children[2].material.color, 0.5);
        sleeveR.children[0].material.color.lerpColors(colorNormal.sleeve0, colorBoost.sleeve0, b);
        applyRainbow(sleeveR.children[0].material.color, 0.6);
        sleeveR.children[1].material.color.lerpColors(colorNormal.sleeve1, colorBoost.sleeve1, b);
        applyRainbow(sleeveR.children[1].material.color, 0.7);
        sleeveR.children[2].material.color.lerpColors(colorNormal.sleeve2, colorBoost.sleeve2, b);
        applyRainbow(sleeveR.children[2].material.color, 0.8);
        state.speed += ((17 + state.score / 14000) - state.speed) * dt * 0.06;
        const boostSpeedFactor = 1 + state.boost * (BOOST_SPEED_MULTIPLIER - 1);

        const floatBob = Math.sin(clock.elapsedTime * 1.6 + ship.position.x * 0.08) * dt * 0.55;
        ship.position.x = THREE.MathUtils.clamp(ship.position.x + input.x * dt * 10.5 * boostSpeedFactor, -10.5, 10.5);
        ship.position.y = THREE.MathUtils.clamp(ship.position.y + input.y * dt * 11.2 * boostSpeedFactor + floatBob, -34, 88);
        ship.rotation.z += ((-input.x * 0.48) - ship.rotation.z) * dt * 8;
        ship.rotation.x += ((input.y * 0.22) - ship.rotation.x) * dt * 6;
        ship.rotation.y = Math.sin(clock.elapsedTime * 4.8) * 0.035;
        const pulse = 1 + Math.sin(clock.elapsedTime * 9) * 0.08;
        const boostExpand = 1 + b * (1.6 + rb * 0.8);
        glow.scale.set(5.6 * pulse * boostExpand, 4.0 * pulse * boostExpand, 1);
        glow.material.opacity = Math.min(1, 1.0 + b * 0.2);
        halo.scale.setScalar((1 + Math.sin(clock.elapsedTime * 2.2) * 0.08) * (1 + b * 0.6));
        halo.rotation.z += dt * (0.22 + b * 0.32);
        const enginePulse = 1 + b * 0.6;
        engine.scale.set(0.55 * enginePulse, 0.55 * enginePulse, 1);
        engineHalo.scale.set(1.4 * enginePulse * (1 + b * 0.5), 1.0 * enginePulse * (1 + b * 0.5), 1);
        const sleeveExpand = 1 + b * (1.0 + rb * 0.4);
        sleeveL.scale.set(sleeveExpand, 1, sleeveExpand);
        sleeveR.scale.set(sleeveExpand, 1, sleeveExpand);
        body.rotation.x = Math.sin(clock.elapsedTime * 1.6) * 0.035 + input.y * 0.025;
        body.rotation.z = -input.x * 0.035;
        sleeveL.rotation.z = 0.18 + Math.sin(clock.elapsedTime * 2.8) * 0.11 + input.x * 0.025;
        sleeveR.rotation.z = -0.18 - Math.sin(clock.elapsedTime * 2.8 + 0.4) * 0.11 + input.x * 0.025;
        sleeveL.rotation.y = -0.12 + Math.sin(clock.elapsedTime * 1.8) * 0.045;
        sleeveR.rotation.y = 0.12 + Math.sin(clock.elapsedTime * 1.8 + 0.5) * 0.045;
        cyanLight.position.x = ship.position.x;
        cyanLight.position.y = ship.position.y + 3;
        cyanLight.intensity = 14 + state.boost * 12;

        const shadowAlt = ship.position.y - ground.position.y;
        const shadowVisibility = 1 - THREE.MathUtils.smoothstep(shadowAlt, 4, 45);
        shipShadow.material.opacity = 0.65 * shadowVisibility;
        shipShadow.position.set(ship.position.x, ground.position.y + 0.06, ship.position.z);
        const shadowSize = THREE.MathUtils.lerp(0.5, 3.6, shadowVisibility);
        shipShadow.scale.set(shadowSize * (1 + state.boost * 0.4), shadowSize, 1);
        const baseTrailTarget = Math.floor(state.boostFuel * TRAIL_PER_BOOST_SECOND);
        const trailTarget = Math.min(TRAIL_MAX, baseTrailTarget * (boosting ? BOOST_TRAIL_MULTIPLIER : 1));
        let aliveTrail = 0;
        for (const p of particles) if (p.userData.trail) aliveTrail += 1;
        const deficit = trailTarget - aliveTrail;
        if (deficit > 0) {
          const spawnRate = TRAIL_SPAWN_RATE * (boosting ? BOOST_TRAIL_MULTIPLIER : 1);
          state.trailSpawnCarry += dt * spawnRate;
          const toSpawn = Math.min(deficit, Math.floor(state.trailSpawnCarry));
          state.trailSpawnCarry -= toSpawn;
          for (let s = 0; s < toSpawn; s += 1) spawnOneTrail(boosting ? Math.max(0.75, state.boost) : state.boost);
        } else if (deficit < 0) {
          state.trailSpawnCarry = 0;
          let toShorten = -deficit;
          for (let i = 0; i < particles.length && toShorten > 0; i += 1) {
            const p = particles[i];
            if (p.userData.trail && p.userData.life > 0.35) {
              p.userData.life = 0.35;
              p.userData.maxLife = 0.35;
              toShorten -= 1;
            }
          }
        } else {
          state.trailSpawnCarry = Math.min(state.trailSpawnCarry, 0.95);
        }

        camera.position.x += (ship.position.x * 0.42 - camera.position.x) * dt * 2.4;
        camera.position.y += (ship.position.y + 12.5 - camera.position.y) * dt * 2.2;
        camera.position.z += (28 + state.boost * 3.5 - camera.position.z) * dt * 2.1;
        camera.lookAt(ship.position.x * 0.22, ship.position.y + 1.2, -22);

        stepObjects(dt);
        updateHud();
      } else {
        shipShadow.material.opacity = 0;
        ship.rotation.y += dt * 0.5;
        ship.position.y = 26 + Math.sin(clock.elapsedTime * 1.1) * 0.42;
        halo.scale.setScalar(1 + Math.sin(clock.elapsedTime * 1.6) * 0.06);
        halo.rotation.z += dt * 0.16;
        sleeveL.rotation.z = 0.18 + Math.sin(clock.elapsedTime * 1.8) * 0.08;
        sleeveR.rotation.z = -0.18 - Math.sin(clock.elapsedTime * 1.8 + 0.4) * 0.08;
        camera.position.y += (38 - camera.position.y) * dt * 2;
        camera.position.z += (28 - camera.position.z) * dt * 2;
        camera.lookAt(0, 26.5, -12);
      }

      updateEngineAudio();
      updateBgmAudio();
      renderer.render(scene, camera);
    }

    function resize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(window.innerWidth, window.innerHeight);
    }

    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stopBgm();
      } else if (state.running) {
        startBgm();
      }
    });
    window.addEventListener("keydown", (event) => {
      keys.add(event.code);
      if (event.code === "Space") event.preventDefault();
      if (event.code === "KeyR") resetGame(state.practice);
    });
    window.addEventListener("keyup", (event) => {
      keys.delete(event.code);
      if (event.code === "Space") state.boostEmptyLatched = false;
    });

    startBtn.addEventListener("click", () => {
      resetGame(false);
      if (!state.muted) audioCtx.resume();
    });
    if (practiceBtn) {
      practiceBtn.addEventListener("click", () => {
        resetGame(true);
        if (!state.muted) audioCtx.resume();
      });
    }
    soundBtn.addEventListener("click", () => {
      setSoundEnabled(state.muted);
      audioCtx.resume();
      soundBtn.blur();
    });

    let touchId = null;
    stick.addEventListener("pointerdown", (event) => {
      touchId = event.pointerId;
      stick.setPointerCapture(touchId);
    });
    stick.addEventListener("pointermove", (event) => {
      if (event.pointerId !== touchId) return;
      const rect = stick.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;
      const max = rect.width * 0.32;
      const v = new THREE.Vector2(x, y);
      if (v.length() > max) v.setLength(max);
      touchInput.set(v.x / max, -v.y / max);
      knob.style.transform = `translate(${v.x}px, ${v.y}px)`;
    });
    function clearStick(event) {
      if (touchId !== null && event.pointerId !== touchId) return;
      touchId = null;
      touchInput.set(0, 0);
      knob.style.transform = "translate(0, 0)";
    }
    stick.addEventListener("pointerup", clearStick);
    stick.addEventListener("pointercancel", clearStick);
    touchBoost.addEventListener("pointerdown", () => keys.add("Space"));
    touchBoost.addEventListener("pointerup", () => {
      keys.delete("Space");
      state.boostEmptyLatched = false;
    });
    touchBoost.addEventListener("pointercancel", () => {
      keys.delete("Space");
      state.boostEmptyLatched = false;
    });

    if (new URLSearchParams(window.location.search).has("play")) {
      resetGame(false);
    }

    updateHud();
    animate();
