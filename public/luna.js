/**
 * Luna // Assistente Pessoal Dedicada
 * Mascote 2D com tema Lavanda Neon, laço animado e voz Thalita Neural
 */
(() => {
  'use strict';

  // Configuração Visual da Luna
  const LUNA_SPEC = {
    base: ['#181028', '#0f0a1c'],
    accent: '#c084fc',
    outline: 'rgba(183, 148, 244, 0.45)',
    blush: '#f687b3',
    eyeColor: '#1a102f',
    bowPrimary: '#c084fc',
    bowSecondary: '#805ad5',
    bowKnot: '#e9d8fd'
  };

  const NOW = () => performance.now();
  const lerp = (a, b, t) => a + (b - a) * t;

  function hexRgb(hex) {
    const c = hex.replace('#', '');
    const n = parseInt(c.length === 3 ? c.split('').map(x => x + x).join('') : c, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${a})`;

  // ========================================================
  // CLASSE DA MASCOTE LUNA (CANVAS 2D VETORIAL)
  // ========================================================
  class LunaBot {
    constructor(canvas) {
      this.c = canvas;
      this.x = canvas.getContext('2d');
      this.state = 'idle';
      this.speaking = false;
      this.mouthOpen = 0;
      this.look = { x: 0, y: 0 };
      this.blinkTimer = 0;
      this.blinkProgress = 0;
      this.lastTime = NOW();
      
      // Estado de interpolação física
      this.s = {
        sx: 1, sy: 1,
        ox: 0, oy: 0,
        tilt: 0,
        yaw: 0,
        blush: 0.4,
        hands: 0,
        bowWobble: 0
      };

      this.target = {
        sx: 1, sy: 1,
        ox: 0, oy: 0,
        tilt: 0,
        yaw: 0,
        blush: 0.4,
        hands: 0
      };

      this.run = this.run.bind(this);
      requestAnimationFrame(this.run);
    }

    setState(newState) {
      this.state = newState;
      if (newState === 'sleeping') {
        this.target.sy = 0.85;
        this.target.sx = 1.08;
        this.target.oy = 0.12;
        this.target.blush = 0.2;
      } else if (newState === 'thinking') {
        this.target.tilt = -0.12;
        this.target.oy = -0.05;
        this.target.blush = 0.5;
      } else if (newState === 'talking') {
        this.target.blush = 0.6;
        this.target.hands = 1;
      } else {
        // idle
        this.target.sx = 1;
        this.target.sy = 1;
        this.target.ox = 0;
        this.target.oy = 0;
        this.target.tilt = 0;
        this.target.blush = 0.4;
        this.target.hands = 0;
      }
    }

    update(dt) {
      const t = NOW() / 1000;
      
      // Respiração suave natural
      if (this.state !== 'sleeping') {
        const breathe = Math.sin(t * 2.2) * 0.025;
        this.target.sy = 1 + breathe;
        this.target.sx = 1 - breathe * 0.6;
      }

      // Interpolação suave em direção aos alvos
      const ease = 0.08;
      this.s.sx = lerp(this.s.sx, this.target.sx, ease);
      this.s.sy = lerp(this.s.sy, this.target.sy, ease);
      this.s.ox = lerp(this.s.ox, this.target.ox, ease);
      this.s.oy = lerp(this.s.oy, this.target.oy, ease);
      this.s.tilt = lerp(this.s.tilt, this.target.tilt, ease);
      this.s.blush = lerp(this.s.blush, this.target.blush, ease);
      this.s.hands = lerp(this.s.hands, this.target.hands, ease);

      // Balanço sutil do laço com física de mola
      const bowTarget = Math.sin(t * 3.5) * 0.06 + (this.s.tilt * 0.35);
      this.s.bowWobble = lerp(this.s.bowWobble, bowTarget, 0.12);

      // Piscar de olhos natural
      this.blinkTimer += dt;
      if (this.blinkTimer > 3.8 + Math.random() * 2) {
        this.blinkProgress = 1;
        this.blinkTimer = 0;
      }
      if (this.blinkProgress > 0) {
        this.blinkProgress -= dt * 6;
        if (this.blinkProgress < 0) this.blinkProgress = 0;
      }

      // Sincronização labial ao falar
      if (this.speaking) {
        this.mouthOpen = Math.abs(Math.sin(t * 14)) * 0.85;
      } else {
        this.mouthOpen = lerp(this.mouthOpen, 0, 0.2);
      }
    }

    draw() {
      const x = this.x, W = 280, H = 280, s = this.s;
      x.clearRect(0, 0, W, H);

      const R = W * 0.3;
      let rx = R * 1.14, ry = R * 0.88;
      const cx = W / 2 + s.ox * R, cy = H / 2 + s.oy * R + R * 0.06;

      x.save();
      x.translate(cx, cy);
      x.rotate(s.tilt);
      x.scale(s.sx, s.sy);

      // 1. Corpo Superelipse Suave
      const path = new Path2D();
      for (let i = 0; i <= 72; i++) {
        const a = i / 72 * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        const px = rx * Math.sign(ca) * Math.pow(Math.abs(ca), 2 / 2.7);
        const py = ry * Math.sign(sa) * Math.pow(Math.abs(sa), 2 / 2.7);
        i ? path.lineTo(px, py) : path.moveTo(px, py);
      }
      path.closePath();

      // Gradiente Base Lilás Noturno
      const c0 = hexRgb(LUNA_SPEC.base[0]), c1 = hexRgb(LUNA_SPEC.base[1]);
      const g = x.createLinearGradient(0, -ry, 0, ry);
      g.addColorStop(0, rgba(c0, 1));
      g.addColorStop(1, rgba(c1, 1));
      x.fillStyle = g;
      x.fill(path);

      // Contorno Lavanda Neon Suave
      x.strokeStyle = LUNA_SPEC.outline;
      x.lineWidth = 2.0;
      x.stroke(path);

      // 2. Bochechas Rosadas Fofas
      const bl = Math.max(s.blush, 0.35);
      x.save();
      x.clip(path);
      x.fillStyle = `rgba(246, 135, 179, ${0.45 * bl})`;
      for (const sd of [-1, 1]) {
        x.beginPath();
        x.ellipse(sd * rx * 0.52, ry * 0.18, R * 0.17, R * 0.10, 0, 0, Math.PI * 2);
        x.fill();
      }
      x.restore();

      // 3. Olhos Brilhantes e Expressivos
      const eyeY = ry * 0.02;
      const eyeDist = rx * 0.42;
      const eyeR = R * 0.15;

      if (this.state === 'sleeping') {
        // Olhos fechados dormindo (curva serena ^ ^)
        x.strokeStyle = LUNA_SPEC.accent;
        x.lineWidth = 3.5;
        x.lineCap = 'round';
        for (const sd of [-1, 1]) {
          x.beginPath();
          x.arc(sd * eyeDist, eyeY + 4, eyeR * 0.8, Math.PI * 0.15, Math.PI * 0.85);
          x.stroke();
        }
      } else {
        const blinkScale = Math.cos(this.blinkProgress * Math.PI * 0.5);
        for (const sd of [-1, 1]) {
          x.save();
          x.translate(sd * eyeDist, eyeY);
          x.scale(1, Math.max(0.08, blinkScale));

          // Globo ocular escuro
          x.fillStyle = LUNA_SPEC.eyeColor;
          x.beginPath();
          x.arc(0, 0, eyeR, 0, Math.PI * 2);
          x.fill();

          // Contorno neon
          x.strokeStyle = LUNA_SPEC.accent;
          x.lineWidth = 1.8;
          x.stroke();

          // Brilhos nos olhos (Highlight doce estilo anime)
          x.fillStyle = '#ffffff';
          x.beginPath();
          x.arc(sd > 0 ? 3 : -2, -3, eyeR * 0.38, 0, Math.PI * 2);
          x.fill();

          x.fillStyle = 'rgba(255, 255, 255, 0.8)';
          x.beginPath();
          x.arc(sd > 0 ? -3 : 2, 3, eyeR * 0.20, 0, Math.PI * 2);
          x.fill();

          x.restore();
        }
      }

      // 4. Boca Delicada
      x.save();
      x.translate(0, ry * 0.26);
      if (this.mouthOpen > 0.05) {
        // Boca aberta falando
        x.fillStyle = '#f687b3';
        x.beginPath();
        x.ellipse(0, 0, R * 0.12, R * (0.05 + this.mouthOpen * 0.12), 0, 0, Math.PI * 2);
        x.fill();
        x.strokeStyle = LUNA_SPEC.accent;
        x.lineWidth = 1.5;
        x.stroke();
      } else {
        // Sorriso sutil
        x.strokeStyle = LUNA_SPEC.accent;
        x.lineWidth = 2.4;
        x.lineCap = 'round';
        x.beginPath();
        x.arc(0, -2, R * 0.11, Math.PI * 0.2, Math.PI * 0.8);
        x.stroke();
      }
      x.restore();

      // 5. Mãozinhas Expressivas
      if (s.hands > 0.05) {
        const hr = R * 0.16 * s.hands;
        const ht = NOW() / 1000 * 4.5;
        for (const sd of [-1, 1]) {
          x.save();
          x.translate(sd * (rx * 0.88), ry * 0.42 + Math.sin(ht + sd * 1.5) * 4);
          x.fillStyle = LUNA_SPEC.base[0];
          x.strokeStyle = LUNA_SPEC.outline;
          x.lineWidth = 2;
          x.beginPath();
          x.arc(0, 0, hr, 0, Math.PI * 2);
          x.fill();
          x.stroke();
          x.restore();
        }
      }

      // ========================================================
      // 6. O LAÇO NA CABEÇA (ANIMADO E ORGÂNICO)
      // ========================================================
      // Posicionado no topo-direito da cabeça
      const bowX = rx * 0.42;
      const bowY = -ry * 0.94;
      const bowScale = R * 0.32;

      x.save();
      x.translate(bowX, bowY);
      // Inclinação do laço segue a cabeça + balanço dinâmico suave
      x.rotate(0.25 + s.bowWobble);

      // Fitas caídas do laço (Ribbons balançando)
      const tRibbon = NOW() / 1000 * 3.0;
      for (const dir of [-1, 1]) {
        const wave = Math.sin(tRibbon + dir * 1.2) * 4;
        x.save();
        x.translate(dir * 5, 6);
        x.fillStyle = LUNA_SPEC.bowSecondary;
        x.strokeStyle = LUNA_SPEC.bowPrimary;
        x.lineWidth = 1.2;

        x.beginPath();
        x.moveTo(0, 0);
        x.quadraticCurveTo(dir * 8 + wave, bowScale * 0.6, dir * 12 + wave, bowScale * 1.0);
        x.lineTo(dir * 4 + wave, bowScale * 0.92);
        x.quadraticCurveTo(dir * 2, bowScale * 0.5, 0, 0);
        x.closePath();
        x.fill();
        x.stroke();
        x.restore();
      }

      // Asas do Laço (Loops esquerdo e direito)
      for (const dir of [-1, 1]) {
        x.save();
        x.scale(dir, 1);

        const loopGrad = x.createLinearGradient(0, 0, bowScale * 0.9, -bowScale * 0.3);
        loopGrad.addColorStop(0, LUNA_SPEC.bowPrimary);
        loopGrad.addColorStop(1, LUNA_SPEC.bowSecondary);

        x.fillStyle = loopGrad;
        x.strokeStyle = '#ffffff';
        x.lineWidth = 1.5;

        x.beginPath();
        x.moveTo(3, 0);
        x.bezierCurveTo(bowScale * 0.5, -bowScale * 0.65, bowScale * 1.1, -bowScale * 0.25, bowScale * 0.95, 0);
        x.bezierCurveTo(bowScale * 1.1, bowScale * 0.25, bowScale * 0.5, bowScale * 0.65, 3, 0);
        x.closePath();
        x.fill();

        // Contorno brilhante
        x.strokeStyle = 'rgba(233, 216, 253, 0.7)';
        x.stroke();

        // Vinco interno do laço
        x.strokeStyle = 'rgba(107, 70, 193, 0.6)';
        x.lineWidth = 1.5;
        x.beginPath();
        x.moveTo(8, -1);
        x.lineTo(bowScale * 0.45, 0);
        x.stroke();

        x.restore();
      }

      // Nó Central do Laço
      const knotGrad = x.createRadialGradient(0, 0, 1, 0, 0, bowScale * 0.26);
      knotGrad.addColorStop(0, '#ffffff');
      knotGrad.addColorStop(0.4, LUNA_SPEC.bowKnot);
      knotGrad.addColorStop(1, LUNA_SPEC.bowPrimary);

      x.fillStyle = knotGrad;
      x.strokeStyle = LUNA_SPEC.bowSecondary;
      x.lineWidth = 1.8;
      x.beginPath();
      x.ellipse(0, 0, bowScale * 0.24, bowScale * 0.20, 0, 0, Math.PI * 2);
      x.fill();
      x.stroke();

      x.restore(); // Fim do Laço

      x.restore(); // Fim da Cabeça
    }

    run() {
      const now = NOW();
      const dt = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;
      this.update(dt);
      this.draw();
      requestAnimationFrame(this.run);
    }
  }

  // ========================================================
  // INICIALIZAÇÃO DA INTERFACE & RECONHECIMENTO DE VOZ
  // ========================================================
  const canvas = document.getElementById('luna-canvas');
  const luna = new LunaBot(canvas);

  const micBtn = document.getElementById('mic-btn');
  const micLabel = document.getElementById('mic-label');
  const transcriptionText = document.getElementById('transcription-text');
  const voiceTranscription = document.getElementById('voice-transcription');
  const badgeTop = document.getElementById('badge-top');
  const audioToast = document.getElementById('audio-toast');

  const pinModal = document.getElementById('pin-modal');
  const pinInput = document.getElementById('pin-input');
  const pinBtn = document.getElementById('pin-btn');
  const pinError = document.getElementById('pin-error');

  let isListening = false;
  let recognition = null;
  let audioUnlocked = false;
  let isSpeaking = false;
  let currentAudio = null;

  function getLunaPin() {
    return localStorage.getItem('luna_pin') || '172086';
  }

  function getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      'x-luna-pin': getLunaPin()
    };
  }

  function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    audioToast.classList.add('hidden');
    const silent = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
    silent.play().catch(() => {});
  }

  window.addEventListener('pointerdown', unlockAudio, { once: true });

  // Síntese de Voz com Microsoft Edge Neural (Voz Thalita)
  async function speak(text) {
    if (!text) return;
    unlockAudio();

    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }

    luna.setState('talking');
    luna.speaking = true;
    isSpeaking = true;
    badgeTop.textContent = 'FALANDO';

    try {
      const res = await fetch('/api/speak', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          text,
          voice: 'pt-BR-ThalitaNeural'
        })
      });

      if (!res.ok) throw new Error('Falha no áudio');

      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);
      currentAudio = new Audio(audioUrl);

      currentAudio.onended = () => {
        luna.speaking = false;
        isSpeaking = false;
        luna.setState('idle');
        badgeTop.textContent = 'PRONTA';
        URL.revokeObjectURL(audioUrl);
      };

      currentAudio.onerror = () => {
        luna.speaking = false;
        isSpeaking = false;
        luna.setState('idle');
        badgeTop.textContent = 'PRONTA';
      };

      await currentAudio.play();
    } catch (e) {
      console.warn('Erro ao reproduzir voz:', e);
      luna.speaking = false;
      isSpeaking = false;
      luna.setState('idle');
      badgeTop.textContent = 'PRONTA';
    }
  }

  // Conversação Inteligente com a Luna
  async function askLuna(message) {
    luna.setState('thinking');
    badgeTop.textContent = 'PENSANDO';
    transcriptionText.textContent = `"${message}"`;
    voiceTranscription.classList.remove('hidden');

    try {
      const res = await fetch('/api/luna/converse', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ message })
      });

      const data = await res.json();
      const reply = data.reply || "Desculpe, não consegui entender direitinho. Pode repetir?";

      transcriptionText.textContent = reply;
      voiceTranscription.classList.remove('hidden');

      if (data.state === 'sleeping') {
        luna.setState('sleeping');
        badgeTop.textContent = 'SONO';
      }

      await speak(reply);
    } catch (err) {
      console.warn('Erro ao falar com a Luna:', err);
      luna.setState('idle');
      badgeTop.textContent = 'PRONTA';
    }
  }

  // Reconhecimento de Voz (Microfone)
  function setupSpeech() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition não suportado neste navegador.');
      return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      isListening = true;
      micBtn.classList.add('listening');
      micLabel.textContent = 'OUVINDO...';
      badgeTop.textContent = 'OUVINDO';
      transcriptionText.textContent = 'Pode falar, estou ouvindo...';
      voiceTranscription.classList.remove('hidden');
    };

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      if (text && text.trim()) {
        askLuna(text.trim());
      }
    };

    recognition.onerror = () => {
      stopListening();
    };

    recognition.onend = () => {
      stopListening();
    };
  }

  function startListening() {
    if (!recognition || isListening || isSpeaking) return;
    try {
      recognition.start();
    } catch (e) {}
  }

  function stopListening() {
    isListening = false;
    micBtn.classList.remove('listening');
    micLabel.textContent = 'OUVIR';
    if (!isSpeaking) {
      badgeTop.textContent = 'PRONTA';
    }
  }

  micBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    unlockAudio();
    if (isListening) {
      try { recognition.stop(); } catch (e) {}
    } else {
      startListening();
    }
  });

  // Autenticação por PIN (172086)
  async function checkAuth() {
    try {
      const res = await fetch('/api/luna/auth/status', {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!data.authorized) {
        pinModal.classList.remove('hidden');
        pinInput.focus();
      } else {
        pinModal.classList.add('hidden');
      }
    } catch (e) {}
  }

  async function submitPin() {
    const pin = pinInput.value.trim();
    if (!pin) return;

    try {
      const res = await fetch('/api/luna/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const data = await res.json();
      if (data.ok) {
        localStorage.setItem('luna_pin', pin);
        pinModal.classList.add('hidden');
        pinError.style.display = 'none';
        speak("Olá! Que bom te ver por aqui! Como posso te ajudar hoje?");
      } else {
        pinError.style.display = 'block';
      }
    } catch (e) {
      pinError.textContent = 'Erro ao verificar o PIN.';
      pinError.style.display = 'block';
    }
  }

  pinBtn.addEventListener('click', submitPin);
  pinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitPin();
  });

  // Toque na mascote para saudação amigável
  document.getElementById('luna-wrapper').addEventListener('click', () => {
    if (!isSpeaking && !isListening) {
      luna.setState('talking');
      speak("Oi! Eu sou a Luna. Toque no microfone para falar comigo!");
    }
  });

  // Inicialização
  setupSpeech();

  const urlParams = new URLSearchParams(window.location.search);
  const pinFromUrl = urlParams.get('pin');
  if (pinFromUrl) {
    pinInput.value = pinFromUrl;
    submitPin();
  } else {
    checkAuth();
  }
})();
