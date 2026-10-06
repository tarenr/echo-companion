/**
 * Luna // Assistente Pessoal Inteligente
 * Robô lavanda do motor compartilhado (robo-motor.js), folha Personagem e voz Thalita Neural
 */
(() => {
  'use strict';

  // ========================================================
  // 1. SINTETIZADOR DE ÁUDIO WEB AUDIO (SONS RETRÔ DA LUNA)
  // ========================================================
  const Snd = {
    ctx: null, on: true, vol: 0.45,
    init() {
      if (this.ctx) return;
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      const c = this.ctx = new C();
      this.master = c.createGain();
      this.master.gain.value = this.vol;
      this.master.connect(c.destination);
    },
    tone({ f = 440, to = 0, d = 0.2, type = 'sine', g = 0.1, a = 0.006 }) {
      this.init();
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime;
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t + d * 0.9);
      const gn = c.createGain();
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.exponentialRampToValueAtTime(g, t + a);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(gn);
      gn.connect(this.master);
      o.start(t);
      o.stop(t + d + 0.05);
    },
    play(name) {
      if (!this.on) return;
      if (name === 'pop') {
        this.tone({ f: 520, to: 880, d: 0.09, type: 'sine', g: 0.12 });
      } else if (name === 'love') {
        this.tone({ f: 587, to: 784, d: 0.25, type: 'sine', g: 0.1 });
      } else if (name === 'listen') {
        this.tone({ f: 493, to: 740, d: 0.15, type: 'sine', g: 0.1 });
      } else if (name === 'finish') {
        this.tone({ f: 587, to: 1174, d: 0.32, type: 'triangle', g: 0.14 });
      } else if (name === 'slap') {
        this.tone({ f: 320, to: 140, d: 0.12, type: 'triangle', g: 0.14 });
      }
    }
  };


  // ========================================================
  // 2. PERSONAGEM: ROBÔ DO MOTOR COMPARTILHADO (TEMA LAVANDA)
  // ========================================================
  // A Luna virou o robô em 06/10/2026 (backup do desenho antigo em docs/legado/mascote-luna.js). Cores e estados
  // (Pronta, Falando, Pensando, Ouvindo, Feliz, Dormindo) vêm de THEMES.luna (robo-motor.js); a fantasia de boneca
  // de pano, de robo-roupas-luna.js. Os sons de estado e de toque tocam no Snd da Luna; os da entrada (whoosh,
  // boing, chime), nos sons próprios do robô.
  const { RoboBot, THEMES, GestureReader, Sfx: RobotSfx, createDriver } = window.RoboMotor;
  const Roupas = window.RoboRoupas;
  const ROBOT_OWN_SOUNDS = ['whoosh', 'boing', 'chime'];
  RobotSfx.on = true;

  // ========================================================
  // 3. INICIALIZAÇÃO DA INTERFACE & CONTROLE
  // ========================================================
  const canvas = document.getElementById('luna-canvas');
  // O nome "mochi" ficou do personagem antigo; hoje é o robô
  const mochi = new RoboBot(canvas, { theme: THEMES.luna });
  mochi.onSound = name => (ROBOT_OWN_SOUNDS.includes(name) ? RobotSfx.play(name) : Snd.play(name));

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
  let currentAudio = null;

  // Rastreamento Ocular Tangencial idêntico ao Echo
  function trackMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - (rect.left + rect.width / 2);
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - (rect.top + rect.height / 2);
    mochi.look.x = Math.tanh(x / 120);
    mochi.look.y = Math.tanh(y / 100);
  }

  window.addEventListener('pointermove', trackMove);
  window.addEventListener('touchmove', trackMove, { passive: true });

  // Toques no robô (como no Echo): toque, duplo, vários (bravo), visor, peito, chapéu, carinho e segurar (folha
  // Personagem). Dormindo, o toque acorda (com a entrada do robô).
  const gestures = new GestureReader();
  let pressTimer = 0;
  let skipGreeting = false;   // segurar (folha), carinho e acordar não puxam a saudação do toque
  const CHEST_SYMBOLS = ['♥', ':)', '!', '?', '♪'];
  let chestIndex = 0;
  const toCanvas = e => {
    const r = canvas.getBoundingClientRect();
    return { px: (e.clientX - r.left) / r.width * 280, py: (e.clientY - r.top) / r.height * 280 };
  };
  function handleGestures(events) {
    for (const ev of events) {
      if (ev === 'toque') mochi.tap();
      else if (ev === 'duplo') mochi.hop();
      else if (ev === 'bravo') mochi.angry();
      else if (ev === 'toque-visor') mochi.surprise();
      else if (ev === 'toque-peito') mochi.showSymbol(CHEST_SYMBOLS[chestIndex++ % CHEST_SYMBOLS.length], 2000);
      else if (ev === 'toque-chapeu') mochi.hatHop();
      else if (ev === 'carinho') {
        skipGreeting = true;
        mochi.cuddle();
      } else if (ev === 'segurar') {
        skipGreeting = true;
        personagem.open();
      }
    }
  }
  canvas.addEventListener('pointerdown', (e) => {
    if (mochi.state === 'sleeping') {
      skipGreeting = true;
      mochi.setState('idle');
      badgeTop.textContent = 'PRONTA';
      return;
    }
    const p = toCanvas(e);
    gestures.start(performance.now(), p.px, p.py, mochi.regionAt(p.px, p.py));
    // Segue o dedo mesmo se ele sair do robô; se o navegador recusar, o gesto continua valendo
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {}
    clearInterval(pressTimer);
    pressTimer = setInterval(() => handleGestures(gestures.poll(performance.now())), 50);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!gestures.down) return;
    const p = toCanvas(e);
    handleGestures(gestures.move(performance.now(), p.px, p.py));
  });
  canvas.addEventListener('pointerup', () => {
    clearInterval(pressTimer);
    handleGestures(gestures.end(performance.now()));
  });
  canvas.addEventListener('pointercancel', () => {
    clearInterval(pressTimer);
    gestures.down = null;
  });

  // Laço de desenho do motor: quadros da página ou relógio em segundo plano
  const driver = createDriver(() => {
    mochi.update();
    mochi.draw();
  });
  driver.start('quadros');

  // Folha Personagem (abre ao segurar o robô): peças comuns, fantasia de boneca de pano (ativa na primeira vez;
  // tirar volta o laço), tirar tudo e sensor de movimento. Sem janela flutuante e sem automático: a roupa é só por
  // escolha. Escolhas guardadas só neste navegador (luna_personagem).
  const personagem = window.RoboPersonagem.create({
    robo: mochi,
    owner: 'luna',
    storageKey: 'luna_personagem',
    defaults: { auto: false, roupa: Roupas.outfitOf('bonecaDePano'), sensor: false },
    features: { auto: false, floating: false, sensor: true },
    sensor: {
      // Dormindo, inclinar não faz nada e chacoalhar acorda
      onTilt: (v) => {
        if (mochi.state === 'sleeping') return;
        mochi.tg.lean = v.lean;
        mochi.look.x = v.lookX;
        mochi.look.y = v.lookY;
      },
      onShake: () => {
        if (mochi.state === 'sleeping') {
          mochi.setState('idle');
          badgeTop.textContent = 'PRONTA';
        } else mochi.dizzy();
      },
      onStop: () => { mochi.tg.lean = 0; }
    }
  });

  // Entrada: ao abrir a Luna e ao voltar depois de mais de 30 min fora (ao acordar, o próprio motor faz)
  let hiddenAt = document.visibilityState === 'hidden' ? Date.now() : 0;
  let pendingEntrance = document.visibilityState !== 'visible';
  if (!pendingEntrance) mochi.entrance();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      return;
    }
    if (pendingEntrance || (hiddenAt && Date.now() - hiddenAt > 30 * 60 * 1000)) {
      pendingEntrance = false;
      mochi.entrance();
    }
    hiddenAt = 0;
  });

  function getLunaPin() {
    return localStorage.getItem('luna_pin') || '';
  }

  function getAuthHeaders() {
    const pin = getLunaPin();
    const headers = {
      'Content-Type': 'application/json'
    };
    if (pin) {
      headers['x-luna-pin'] = pin;
    }
    return headers;
  }

  // Tela acesa: o navegador solta o pedido quando o app sai da frente (outro app, notificações, tela
  // bloqueada); por isso pede de novo ao voltar e a cada toque, se tiver sido perdido
  let wakeLock = null;
  let wakeLockPending = false;
  async function requestWakeLock() {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible' || wakeLockPending) return;
    if (wakeLock && !wakeLock.released) return;
    wakeLockPending = true;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (err) {
      console.warn('WakeLock:', err.message);
    } finally {
      wakeLockPending = false;
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (audioUnlocked) requestWakeLock();
  });

  function unlockAudio() {
    requestWakeLock();
    if (audioUnlocked) return;
    audioUnlocked = true;
    audioToast.classList.add('hidden');
    Snd.init();
    const silent = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
    silent.play().catch(() => {});
    if (handsFreeMode) {
      setTimeout(startListening, 600);
    }
  }

  window.addEventListener('pointerdown', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });

  // Sem zoom por gesto: cancela pinça (dois ou mais dedos) e o gesto de zoom do Safari
  document.addEventListener('touchmove', (event) => {
    if (event.touches && event.touches.length > 1) event.preventDefault();
  }, { passive: false });
  document.addEventListener('gesturestart', (event) => event.preventDefault());
  if (audioToast) {
    audioToast.addEventListener('click', unlockAudio);
  }

  // ========================================================
  // 4. SÍNTESE DE VOZ COM SINCRONISMO EXATO DE BOCA
  // ========================================================
  function startSpeakingAnim() {
    mochi.speaking = true;
    mochi.setState('talking');
    badgeTop.textContent = 'FALANDO';
  }

  function stopSpeakingAnim() {
    mochi.speaking = false;
    mochi.setState('idle');
    badgeTop.textContent = 'PRONTA';
  }

  async function speak(text) {
    if (!text) return;
    unlockAudio();

    if (recognition && isListening) {
      try { recognition.stop(); } catch(e){}
    }

    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
      stopSpeakingAnim();
    }

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

      // Inicia a boca no exato instante em que o áudio começa a tocar
      currentAudio.onplay = () => {
        startSpeakingAnim();
      };

      currentAudio.onended = () => {
        stopSpeakingAnim();
        currentAudio = null;
        URL.revokeObjectURL(audioUrl);
        resumeListeningIfHandsFree();
      };

      currentAudio.onerror = () => {
        stopSpeakingAnim();
        currentAudio = null;
        resumeListeningIfHandsFree();
      };

      await currentAudio.play();
    } catch (e) {
      console.warn('Erro ao reproduzir voz:', e);
      stopSpeakingAnim();
      resumeListeningIfHandsFree();
    }
  }

  // ========================================================
  // 5. ESCUTA ATIVA CONTÍNUA POR VOZ (MÃOS LIVRES)
  // ========================================================
  let handsFreeMode = true; // Mãos livres ativo por padrão
  let processingSpeech = false;
  let speechDebounceTimer = null;
  let resumeTimer = null;

  function resumeListeningIfHandsFree() {
    if (!handsFreeMode || !audioUnlocked || mochi.speaking || processingSpeech) return;
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => {
      if (handsFreeMode && audioUnlocked && !mochi.speaking && !processingSpeech) {
        startListening();
      }
    }, 1200);
  }

  function pauseRecognition() {
    if (recognition && isListening) {
      try { recognition.stop(); } catch(e) {}
    }
    isListening = false;
  }

  // Conversação Inteligente com a Luna
  async function askLuna(message) {
    if (processingSpeech) return;
    processingSpeech = true;
    pauseRecognition();

    mochi.setState('thinking');
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
      sharedLocation.show(data);
      const reply = data.reply || "Desculpe, não consegui entender direitinho. Pode repetir?";

      transcriptionText.textContent = reply;
      voiceTranscription.classList.remove('hidden');

      if (data.state === 'sleeping') {
        mochi.setState('sleeping');
        badgeTop.textContent = 'SONO';
      }

      await speak(reply);
    } catch (err) {
      console.warn('Erro ao falar com a Luna:', err);
      mochi.setState('idle');
      badgeTop.textContent = 'PRONTA';
      resumeListeningIfHandsFree();
    } finally {
      processingSpeech = false;
    }
  }

  // Reconhecimento de Voz (Microfone)
  function setupSpeech() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      micBtn.style.display = 'none';
      return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false; // Sentença única para zerar buffers e impedir duplicações no Android
    recognition.interimResults = true;

    recognition.onstart = () => {
      isListening = true;
      micBtn.classList.add('listening');
      micLabel.textContent = handsFreeMode ? 'ATIVO' : 'OUVIR';
      badgeTop.textContent = 'OUVINDO';
      mochi.setState('listening');
      transcriptionText.textContent = 'Ouvindo você...';
      voiceTranscription.classList.remove('hidden');
    };

    recognition.onresult = (event) => {
      if (processingSpeech || mochi.speaking) return;

      const current = event.results[event.results.length - 1];
      if (!current || !current[0]) return;
      const text = current[0].transcript.trim();

      if (text) {
        voiceTranscription.classList.remove('hidden');
        transcriptionText.textContent = text;
      }

      if (current.isFinal && text.length >= 2) {
        clearTimeout(speechDebounceTimer);
        speechDebounceTimer = setTimeout(() => {
          if (!processingSpeech && !mochi.speaking) {
            pauseRecognition();
            askLuna(text);
          }
        }, 500);
      } else if (text.length >= 2) {
        clearTimeout(speechDebounceTimer);
        speechDebounceTimer = setTimeout(() => {
          if (!processingSpeech && !mochi.speaking) {
            pauseRecognition();
            askLuna(text);
          }
        }, 900);
      }
    };

    recognition.onerror = (e) => {
      console.warn('[LUNA] Status SpeechRecognition:', e.error);
      if (e.error === 'not-allowed') {
        handsFreeMode = false;
        stopListening();
      }
    };

    recognition.onend = () => {
      isListening = false;
      micBtn.classList.remove('listening');
      micLabel.textContent = handsFreeMode ? 'ATIVO' : 'OUVIR';
      if (!mochi.speaking && !processingSpeech) {
        badgeTop.textContent = 'PRONTA';
        if (mochi.state === 'listening') mochi.setState('idle');
      }
      if (handsFreeMode && !mochi.speaking && !processingSpeech && audioUnlocked) {
        setTimeout(startListening, 400);
      } else if (!handsFreeMode) {
        stopListening();
      }
    };
  }

  function startListening() {
    if (!recognition || isListening || mochi.speaking || processingSpeech) return;
    try {
      recognition.start();
    } catch (e) {}
  }

  function stopListening() {
    pauseRecognition();
    micBtn.classList.remove('listening');
    micLabel.textContent = handsFreeMode ? 'ATIVO' : 'OUVIR';
    if (!mochi.speaking && !processingSpeech) {
      badgeTop.textContent = 'PRONTA';
      mochi.setState('idle');
    }
  }

  micBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    unlockAudio();
    handsFreeMode = !handsFreeMode;
    if (handsFreeMode) {
      micBtn.classList.add('listening');
      micLabel.textContent = 'ATIVO';
      micBtn.title = 'Mãos livres ativo (toque para pausar)';
      startListening();
    } else {
      handsFreeMode = false;
      micBtn.classList.remove('listening');
      micLabel.textContent = 'OUVIR';
      micBtn.title = 'Ativar microfone para falar com a Luna';
      pauseRecognition();
    }
  });

  const sharedLocation = window.createEchoLocation({ scope: 'luna', getHeaders: getAuthHeaders, speak });

  // Autenticação por PIN
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

  // Toque no robô: saudação (o toque em si já anima o robô pelos gestos); segurar, carinho e acordar não saúdam
  document.getElementById('luna-wrapper').addEventListener('click', () => {
    if (skipGreeting) {
      skipGreeting = false;
      return;
    }
    if (!mochi.speaking && !isListening) {
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
