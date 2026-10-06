// Echo // Estratégia Nerd Companion Client
// Personagem: robô (robo-motor.js), com escuta por microfone e telemetria

(function () {
  'use strict';

  // ========================================================
  // 2. SINTETIZADOR DE ÁUDIO WEB AUDIO
  // ========================================================
  // Sons gravados opcionais (servidos com PIN por /api/sounds); sem eles, valem os tons sintetizados
  const SAMPLE_NAMES = ['finish', 'error', 'approval', 'think', 'work', 'sleep', 'slap', 'love', 'pop', 'proud', 'greet'];
  // Som gravado sem arquivo cai no tom sintetizado equivalente
  const TONE_FALLBACK = { error: 'slap', approval: 'pop', think: 'love', work: 'proud' };

  const Snd = {
    ctx: null, on: true, vol: 0.5,
    samples: {},
    sampleGain: 0.24, // 0,24 × volume geral 0,5 = 0,12, o volume padrão do Coucou
    async loadSamples(pin) {
      this.init();
      if (!this.ctx || this._samplesRequested) return;
      this._samplesRequested = true;
      const headers = pin ? { 'x-echo-pin': pin } : {};
      await Promise.all(SAMPLE_NAMES.map(async (name) => {
        try {
          const res = await fetch(`/api/sounds/${name}.wav`, { headers, credentials: 'same-origin' });
          if (!res.ok) return;
          this.samples[name] = await this.ctx.decodeAudioData(await res.arrayBuffer());
        } catch (_) {
          // Mantém o tom sintetizado para este som
        }
      }));
    },
    playSample(name) {
      const buffer = this.samples[name];
      if (!buffer || !this.ctx) return false;
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const gain = this.ctx.createGain();
      gain.gain.value = this.sampleGain;
      source.connect(gain);
      gain.connect(this.master);
      source.start();
      return true;
    },
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
      if (this.playSample(name)) return;
      name = TONE_FALLBACK[name] || name;
      if (name === 'slap') {
        this.tone({ f: 280, to: 120, d: 0.14, type: 'triangle', g: 0.15 });
      } else if (name === 'pop') {
        this.tone({ f: 450, to: 820, d: 0.09, type: 'sine', g: 0.12 });
      } else if (name === 'love') {
        this.tone({ f: 523, to: 659, d: 0.25, type: 'sine', g: 0.1 });
      } else if (name === 'proud') {
        this.tone({ f: 659, to: 880, d: 0.22, type: 'sine', g: 0.12 });
      } else if (name === 'finish') {
        this.tone({ f: 523, to: 1046, d: 0.35, type: 'triangle', g: 0.15 });
      } else if (name === 'speech') {
        this.tone({ f: 340 + Math.random() * 260, to: 420 + Math.random() * 200, d: 0.08, type: 'sine', g: 0.07 });
      } else if (name === 'listen') {
        this.tone({ f: 440, to: 660, d: 0.15, type: 'sine', g: 0.1 });
      }
    }
  };

  // ========================================================
  // 3. PERSONAGEM: ROBÔ DO MOTOR COMPARTILHADO (robo-motor.js e robo-roupas.js)
  // ========================================================
  // O robô substituiu a "bolha" em 06/10/2026 (backup em docs/legado/). Ele avisa os sons pelo gancho
  // onSound: os da entrada (whoosh, boing, chime) são sons próprios do robô; os demais tocam no Snd do Echo.
  const { RoboBot, GestureReader, Sfx: RobotSfx, createDriver, createFloating, createSensors } = window.RoboMotor;
  const Roupas = window.RoboRoupas;
  const ROBOT_OWN_SOUNDS = ['whoosh', 'boing', 'chime'];
  RobotSfx.on = true;

  // ========================================================
  // 5. INICIALIZAÇÃO DA INTERFACE & ELEMENTOS DO DOM
  // ========================================================
  const screen = document.getElementById('screen');
  const echoWrapper = document.getElementById('echo-wrapper');
  const echoCanvas = document.getElementById('echo-canvas');
  // O nome "mochi" ficou do personagem antigo; hoje é o robô
  const mochi = new RoboBot(echoCanvas);
  mochi.onSound = name => (ROBOT_OWN_SOUNDS.includes(name) ? RobotSfx.play(name) : Snd.play(name));

  const brandProject = document.getElementById('brand-project');
  const agentLabel = document.getElementById('agent-label');
  const badgeTop = document.getElementById('badge-top');
  const statusDot = document.getElementById('status-dot');

  const infoPanel = document.getElementById('info-panel');
  const panelBadge = document.getElementById('panel-badge');
  const panelMainText = document.getElementById('panel-main-text');
  const panelFill = document.getElementById('panel-fill');
  const panelSubLine1 = document.getElementById('panel-sub-line1');
  const panelSubLine2 = document.getElementById('panel-sub-line2');
  const panelVoice = document.getElementById('panel-voice');
  const voiceText = document.getElementById('voice-text');
  const panelExtraItems = document.getElementById('panel-extra-items');

  const connectionStatus = document.getElementById('connection-status');
  const telemetryBar = document.getElementById('telemetry-bar');
  const audioToast = document.getElementById('audio-toast');
  const briefingBtn = document.getElementById('briefing-btn');
  const briefingLabel = document.getElementById('briefing-label');
  const micBtn = document.getElementById('mic-btn');
  const micLabel = document.getElementById('mic-label');
  const voiceTranscription = document.getElementById('voice-transcription');
  const transcriptionText = document.getElementById('transcription-text');

  const pinModal = document.getElementById('pin-modal');
  const pinInput = document.getElementById('pin-input');
  const pinBtn = document.getElementById('pin-btn');
  const pinError = document.getElementById('pin-error');
  const rotateBtn = document.getElementById('rotate-btn');
  const wazeLink = document.getElementById('waze-link');
  const calendarActions = document.getElementById('calendar-actions');
  const calendarBtn = document.getElementById('calendar-btn');
  const calendarConnect = document.getElementById('calendar-connect');
  const calendarList = document.getElementById('calendar-list');
  const calendarDisconnect = document.getElementById('calendar-disconnect');
  const calendarConfirm = document.getElementById('calendar-confirm');
  const calendarCancel = document.getElementById('calendar-cancel');
  let calendarCsrf = '';
  let calendarConfirmation = null;
  let calendarStatus = null;
  let calendarBusy = false;

  function showNavigationAction(action) {
    if (!wazeLink || action?.type !== 'open_waze') return null;
    try {
      const url = new URL(action.url);
      const sharedDestination = /^\/ul\/[a-z0-9]{6,20}$/.test(url.pathname);
      const queryDestination = url.pathname === '/ul' && !!url.searchParams.get('q');
      const allowedParams = ['q', 'navigate', 'utm_source'];
      if (url.origin !== 'https://waze.com' || url.username || url.password || url.hash ||
          (!sharedDestination && !queryDestination) ||
          (url.searchParams.has('navigate') && url.searchParams.get('navigate') !== 'yes') ||
          [...url.searchParams.keys()].some(key => !allowedParams.includes(key))) return null;
      wazeLink.href = url.href;
      wazeLink.hidden = false;
      return url.href;
    } catch (_) { return null; }
  }

  function openNavigationOnAndroid(url) {
    if (url && /Android/i.test(navigator.userAgent) && document.visibilityState === 'visible') {
      try { window.location.assign(url); } catch (_) {}
    }
  }

  function getAuthHeaders() {
    const pin = localStorage.getItem('echo_pin') || '';
    const headers = {
      'Content-Type': 'application/json'
    };
    if (pin) {
      headers['x-echo-pin'] = pin;
    }
    if (calendarCsrf) headers['x-agenda-csrf'] = calendarCsrf;
    return headers;
  }

  async function initializeCalendar() {
    const res = await fetch('/api/calendar/status', { headers: getAuthHeaders(), credentials: 'same-origin' });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.reply || 'Desbloqueie o Echo antes de abrir sua agenda.');
    calendarCsrf = data.csrf;
    calendarStatus = data;
    return data;
  }

  function showCalendarActions(data) {
    if (!calendarActions) return;
    if (data.source !== 'google-calendar') return;
    calendarActions.hidden = false;
    calendarConfirmation = data.confirmation?.id || null;
    calendarConfirm.hidden = !calendarConfirmation;
    calendarCancel.hidden = !calendarConfirmation;
    calendarConfirm.textContent = data.confirmation?.action === 'delete' ? 'Confirmar exclusão' : 'Confirmar';
    calendarConnect.hidden = !!calendarConfirmation;
    calendarConnect.textContent = calendarStatus?.connected ? 'Reconectar Google Agenda' : 'Conectar Google Agenda';
    calendarConnect.disabled = !calendarStatus?.configured;
    calendarList.hidden = !!calendarConfirmation || !calendarStatus?.connected;
    calendarDisconnect.hidden = !!calendarConfirmation || !calendarStatus?.connected;
  }

  async function calendarRequest(path, body) {
    if (calendarBusy) return;
    calendarBusy = true;
    let failureData = null;
    for (const button of calendarActions.querySelectorAll('button')) button.disabled = true;
    try {
      if (!calendarCsrf) await initializeCalendar();
      const res = await fetch('/api/calendar/' + path, { method: 'POST', headers: getAuthHeaders(), credentials: 'same-origin', body: JSON.stringify(body || {}) });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        failureData = data;
        throw new Error(data.reply || 'Não foi possível concluir o pedido.');
      }
      if (path === 'oauth/start') {
        const url = new URL(data.url);
        if (url.origin !== 'https://accounts.google.com') throw new Error('Endereço de autorização inválido.');
        window.location.assign(url.href);
        return;
      }
      if (path === 'disconnect') await initializeCalendar();
      displayInfoCard(data.card || { badge: 'GOOGLE AGENDA', title: data.reply, detail1: '', detail2: '' }, data.reply);
      showCalendarActions({ ...data, source: 'google-calendar' });
      await speak(data.reply);
    } catch (error) {
      await initializeCalendar().catch(() => {});
      displayInfoCard({ badge: 'GOOGLE AGENDA', title: error.message, detail1: '', detail2: 'Abra Agenda para verificar a conexão.' });
      showCalendarActions({ source: 'google-calendar', confirmation: failureData?.confirmation });
      await speak(error.message);
    } finally {
      calendarBusy = false;
      for (const button of calendarActions.querySelectorAll('button')) button.disabled = false;
      if (calendarConnect) calendarConnect.disabled = !calendarStatus?.configured;
    }
  }

  calendarBtn?.addEventListener('click', async event => {
    event.stopPropagation();
    try {
      const status = await initializeCalendar();
      const reply = status.connected ? 'Sua agenda está conectada.' : status.configured ? 'Conecte sua conta Google para usar a agenda.' : 'A configuração do Google Agenda no servidor ainda está pendente.';
      displayInfoCard({ badge: 'GOOGLE AGENDA', title: reply, detail1: 'Consultar, criar, editar e excluir compromissos', detail2: status.configured ? 'Alterações exigem sua confirmação.' : 'Siga o guia docs/google-agenda.md no projeto.' }, reply);
      showCalendarActions({ source: 'google-calendar' });
    } catch (error) { displayInfoCard({ badge: 'GOOGLE AGENDA', title: error.message }); }
  });
  calendarConnect?.addEventListener('click', () => calendarRequest('oauth/start'));
  calendarList?.addEventListener('click', () => calendarRequest('list'));
  calendarConfirm?.addEventListener('click', () => calendarRequest('confirm', { id: calendarConfirmation }));
  calendarCancel?.addEventListener('click', () => calendarRequest('cancel', { id: calendarConfirmation }));
  calendarDisconnect?.addEventListener('click', () => {
    if (window.confirm('Desconectar o Google Agenda do Echo? Seus eventos serão preservados.')) calendarRequest('disconnect', { confirm: 'disconnect' });
  });

  // Estado da Aplicação
  let audioUnlocked = false;
  let currentAudio = null;
  let lastVoicePlayed = '';
  let wakeLock = null;
  let sseSource = null;
  let currentState = null;
  let isListening = false;
  let recognition = null;
  let speechTimer = null;

  // Eye Tracking tangencial pelo cursor ou toque
  function trackMove(e) {
    // Se o painel de info estiver aberto, o robô olha para a direita por padrão
    if (currentState && currentState.mode === 'info') return;

    const rect = echoCanvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - (rect.left + rect.width / 2);
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - (rect.top + rect.height / 2);
    mochi.look.x = Math.tanh(x / 120);
    mochi.look.y = Math.tanh(y / 100);
  }
  window.addEventListener('pointermove', trackMove);
  window.addEventListener('touchmove', trackMove, { passive: true });

  // Toques no robô: toque, duplo, vários (bravo), visor, peito, chapéu, carinho e segurar (folha Personagem)
  const gestures = new GestureReader();
  let pressTimer = 0;
  const CHEST_SYMBOLS = ['♥', ':)', '!', '?', '♪'];
  let chestIndex = 0;
  const toCanvas = e => {
    const r = echoCanvas.getBoundingClientRect();
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
      else if (ev === 'carinho') mochi.cuddle();
      else if (ev === 'segurar') openCharacterSheet();
    }
  }
  echoCanvas.addEventListener('pointerdown', (e) => {
    // Dormindo, o toque só acorda (wakeUp, com a entrada do robô)
    if (mochi.state === 'sleeping') return;
    const p = toCanvas(e);
    gestures.start(performance.now(), p.px, p.py, mochi.regionAt(p.px, p.py));
    // Segue o dedo mesmo se ele sair do robô; se o navegador recusar, o gesto continua valendo
    try {
      echoCanvas.setPointerCapture(e.pointerId);
    } catch (_) {}
    clearInterval(pressTimer);
    pressTimer = setInterval(() => handleGestures(gestures.poll(performance.now())), 50);
  });
  echoCanvas.addEventListener('pointermove', (e) => {
    if (!gestures.down) return;
    const p = toCanvas(e);
    handleGestures(gestures.move(performance.now(), p.px, p.py));
  });
  echoCanvas.addEventListener('pointerup', () => {
    clearInterval(pressTimer);
    handleGestures(gestures.end(performance.now()));
  });
  echoCanvas.addEventListener('pointercancel', () => {
    clearInterval(pressTimer);
    gestures.down = null;
  });

  // Laço de desenho do motor (um só): quadros da página, da janela flutuante do PC ou relógio em segundo plano
  const driver = createDriver(() => {
    mochi.update();
    mochi.draw();
  });
  driver.start('quadros');

  // ========================================================
  // 5B. PERSONAGEM: GUARDA-ROUPA, ENTRADA E JANELA FLUTUANTE
  // ========================================================
  const characterSheet = document.getElementById('character-sheet');
  const characterItems = document.getElementById('character-items');
  const characterStatus = document.getElementById('character-status');
  const characterNote = document.getElementById('character-note');
  const characterAuto = document.getElementById('character-auto');
  const characterClear = document.getElementById('character-clear');
  const characterFloat = document.getElementById('character-float');
  const characterClose = document.getElementById('character-close');

  // Escolhas do personagem guardadas só neste navegador (roupa e modo automático)
  const CHARACTER_KEY = 'echo_personagem';
  const characterPrefs = (() => {
    const base = { auto: true, roupa: {}, sensor: false };
    try {
      return Object.assign(base, JSON.parse(localStorage.getItem(CHARACTER_KEY) || '{}'));
    } catch (_) {
      return base;
    }
  })();
  function saveCharacterPrefs() {
    try {
      localStorage.setItem(CHARACTER_KEY, JSON.stringify(characterPrefs));
    } catch (_) {
      // Sem armazenamento (aba anônima): vale até fechar o Echo
    }
  }

  // Janela flutuante: no PC o robô vai para uma janela pequena sempre na frente (tocável); no Android,
  // vídeo flutuante. Quando ela fecha, o robô volta ao palco.
  const floating = createFloating({
    canvas: echoCanvas,
    robo: mochi,
    driver,
    home: (canvas) => {
      echoWrapper.append(canvas);
      scheduleLayout();
    },
    onChange: () => renderCharacterSheet()
  });
  characterFloat.hidden = !('documentPictureInPicture' in window || document.pictureInPictureEnabled);

  // [sensor-echo-inicio]
  // Regras do sensor no Echo: dormindo, inclinar não faz nada e chacoalhar acorda; com cartão aberto, o robô
  // continua olhando para o cartão (só o corpo inclina)
  function sensorAction(kind, { sleeping, cardOpen }) {
    if (kind === 'tilt') return sleeping ? 'nada' : cardOpen ? 'inclinar' : 'olhar-e-inclinar';
    return sleeping ? 'acordar' : 'tonto';
  }
  // [sensor-echo-fim]

  // Sensor de movimento (folha Personagem): desligado por padrão; o Echo lembra se ficou ligado
  const characterSensor = document.getElementById('character-sensor');
  characterSensor.hidden = typeof DeviceOrientationEvent === 'undefined';
  const sensorContext = () => ({ sleeping: mochi.state === 'sleeping', cardOpen: echoWrapper.classList.contains('mode-info') });
  const sensors = createSensors({
    onTilt: (v) => {
      const action = sensorAction('tilt', sensorContext());
      if (action === 'nada') return;
      mochi.tg.lean = v.lean;
      if (action === 'olhar-e-inclinar') {
        mochi.look.x = v.lookX;
        mochi.look.y = v.lookY;
      }
    },
    onShake: () => {
      if (sensorAction('shake', sensorContext()) === 'acordar') wakeUp();
      else mochi.dizzy();
      resetInactivity();
    },
    onStop: () => { mochi.tg.lean = 0; },
    onNoData: () => {
      characterPrefs.sensor = false;
      saveCharacterPrefs();
      characterNote.textContent = 'Nenhuma leitura do sensor: este aparelho não tem sensor ou o endereço não é HTTPS.';
      characterNote.hidden = false;
      renderCharacterSheet();
    }
  });
  async function toggleSensor() {
    characterNote.hidden = true;
    if (sensors.on) {
      sensors.stop();
      characterPrefs.sensor = false;
    } else {
      try {
        await sensors.start();
        characterPrefs.sensor = true;
      } catch (err) {
        characterPrefs.sensor = false;
        characterNote.textContent = err.message;
        characterNote.hidden = false;
      }
    }
    saveCharacterPrefs();
    renderCharacterSheet();
  }
  characterSensor.addEventListener('click', toggleSensor);
  // Ligado da última vez: liga ao abrir; se o navegador pedir um toque antes, liga no primeiro toque
  function resumeSensor() {
    if (!characterPrefs.sensor || sensors.on) return;
    sensors.start().then(renderCharacterSheet).catch(() => {
      window.addEventListener('pointerdown', () => {
        if (characterPrefs.sensor && !sensors.on) sensors.start().then(renderCharacterSheet).catch(() => {});
      }, { once: true, passive: true });
    });
  }

  const itemButtons = Object.entries(Roupas.ITEMS).map(([id, item]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'character-item';
    btn.textContent = item.label;
    btn.dataset.id = id;
    btn.addEventListener('click', () => {
      // Escolher à mão desliga o automático
      characterPrefs.auto = false;
      mochi.wardrobe.toggle(id, performance.now());
      characterPrefs.roupa = mochi.wardrobe.outfit();
      saveCharacterPrefs();
      renderCharacterSheet();
    });
    return btn;
  });
  characterItems.replaceChildren(...itemButtons);

  function renderCharacterSheet() {
    for (const btn of itemButtons) btn.classList.toggle('active', mochi.wardrobe.has(btn.dataset.id));
    characterAuto.classList.toggle('active', characterPrefs.auto);
    characterAuto.setAttribute('aria-pressed', String(characterPrefs.auto));
    const worn = mochi.wardrobe.ids().map(id => Roupas.ITEMS[id].label).join(', ');
    characterStatus.textContent = characterPrefs.auto
      ? `Automático: ${Roupas.seasonFor(new Date()).label}${worn ? ` → ${worn}` : ''}`
      : (worn || 'Sem roupa');
    characterFloat.textContent = floating.active ? 'Fechar janela flutuante' : 'Janela flutuante';
    characterSensor.classList.toggle('active', sensors.on);
    characterSensor.setAttribute('aria-pressed', String(sensors.on));
  }

  let wardrobeDay = '';
  const dayKey = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  function applyWardrobe() {
    const now = performance.now();
    if (characterPrefs.auto) mochi.wardrobe.set(Roupas.seasonFor(new Date()).outfit, now);
    else mochi.wardrobe.set(characterPrefs.roupa || {}, now);
    wardrobeDay = dayKey(new Date());
    renderCharacterSheet();
  }
  // Automático: troca sozinho quando vira o dia
  setInterval(() => {
    if (characterPrefs.auto && dayKey(new Date()) !== wardrobeDay) applyWardrobe();
  }, 60000);
  applyWardrobe();
  resumeSensor();

  function openCharacterSheet() {
    renderCharacterSheet();
    characterNote.hidden = true;
    characterSheet.classList.remove('hidden');
  }
  function closeCharacterSheet() {
    characterSheet.classList.add('hidden');
  }
  characterClose.addEventListener('click', closeCharacterSheet);
  characterSheet.addEventListener('click', (e) => {
    if (e.target === characterSheet) closeCharacterSheet();
  });
  characterAuto.addEventListener('click', () => {
    characterPrefs.auto = !characterPrefs.auto;
    if (!characterPrefs.auto) characterPrefs.roupa = mochi.wardrobe.outfit();
    saveCharacterPrefs();
    applyWardrobe();
  });
  characterClear.addEventListener('click', () => {
    characterPrefs.auto = false;
    mochi.wardrobe.clear(performance.now());
    characterPrefs.roupa = mochi.wardrobe.outfit();
    saveCharacterPrefs();
    renderCharacterSheet();
  });
  characterFloat.addEventListener('click', async () => {
    try {
      if (floating.active) floating.close();
      else {
        await floating.open();
        closeCharacterSheet();
      }
    } catch (err) {
      characterNote.textContent = err.message;
      characterNote.hidden = false;
    }
    renderCharacterSheet();
  });

  // Entrada: ao abrir o Echo e ao voltar depois de mais de 30 min fora (ao acordar, o próprio motor faz)
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

  // [danca-inicio]
  // Comando de voz local: "dança", "dançar", "dance", "vamos dançar" (com ou sem "Echo" antes)
  function isDanceCommand(text) {
    const t = String(text || '').trim().toLowerCase().replace(/[.!?]+$/, '');
    return /^(echo[\s,]+)?(vamos |bora )?(dan[cç]a|dan[cç]ar|dance)( comigo| um pouco| a[ií])?$/.test(t);
  }
  // [danca-fim]

  // ========================================================
  // 6. DESIGN RESPONSIVO HÍBRIDO (RETRATO & PAISAGEM)
  // ========================================================
  function isPortrait() {
    return window.innerHeight > window.innerWidth;
  }

  function setLookForInfoMode() {
    if (isPortrait()) {
      // No modo retrato, o painel fica embaixo: olha para baixo
      mochi.look.x = 0;
      mochi.look.y = 0.85;
    } else {
      // No modo paisagem, o painel fica à direita: olha para a direita
      mochi.look.x = 0.85;
      mochi.look.y = 0.05;
    }
  }

  function handleOrientationUpdate() {
    if (echoWrapper.classList.contains('mode-info')) {
      setLookForInfoMode();
    }
  }

  window.addEventListener('resize', handleOrientationUpdate);
  window.addEventListener('orientationchange', () => {
    setTimeout(handleOrientationUpdate, 150);
  });

  // ========================================================
  // 6B. LAYOUT PROPORCIONAL: MASCOTE NA ÁREA LIVRE E BALÃO QUE NÃO O COBRE
  // ========================================================
  const stageEl = document.querySelector('.stage');
  let layoutFrame = 0;

  function bubbleIsVisible() {
    return !voiceTranscription.classList.contains('hidden') && transcriptionText.textContent.trim() !== '';
  }

  // Topo do balão quando fica em cima do mascote (guardado para o cálculo enquanto ele está ao lado)
  let bubbleTopAbove = 0;

  // Mascote do tamanho da área livre do palco; com o balão visível, a área começa abaixo dele.
  // Tela deitada e baixa: o balão vai para o lado do mascote, que mantém o tamanho cheio.
  function layoutMascot() {
    layoutFrame = 0;
    if (!stageEl || !mochi) return;
    // Na janela flutuante do PC o robô tem o tamanho daquela janela
    if (floating.active && floating.active.kind === 'janela') return;
    const rect = stageEl.getBoundingClientRect();
    const portrait = window.innerHeight >= window.innerWidth;
    const fit = height => Math.max(120, Math.min(rect.width * (portrait ? 0.8 : 0.42), Math.max(0, height) * 0.9, portrait ? 380 : 340));
    const full = fit(rect.height);
    let reserve = 0;
    let beside = false;
    // Com o cartão aberto o mascote já encolhe e sai do caminho (classe mode-info): sem reserva nem balão ao lado
    if (bubbleIsVisible() && !infoPanel.classList.contains('visible')) {
      if (!voiceTranscription.classList.contains('beside')) bubbleTopAbove = voiceTranscription.offsetTop;
      reserve = Math.ceil(bubbleTopAbove + voiceTranscription.offsetHeight + 8);
      const roomBeside = rect.width / 2 - full / 2 - 26;
      beside = !portrait && roomBeside >= 180 && fit(rect.height - reserve) < full * 0.85;
      if (beside) reserve = 0;
    }
    voiceTranscription.classList.toggle('beside', beside);
    stageEl.style.paddingTop = reserve ? `${reserve}px` : '';
    const size = reserve ? fit(rect.height - reserve) : full;
    stageEl.style.setProperty('--echo-half', `${Math.round(size / 2)}px`);
    mochi.setSize(size);
    placeForCard(portrait, size);
  }

  // Cartão aberto: o mascote vai, reduzido, para a área livre — acima do cartão (em pé) ou à esquerda
  // dele (deitado), abaixo do balão quando houver. Deitado, o balão fica centrado nessa área.
  function placeForCard(portrait, size) {
    const open = infoPanel.classList.contains('visible') && echoWrapper.classList.contains('mode-info');
    voiceTranscription.style.left = '';
    voiceTranscription.style.maxWidth = '';
    if (!open) {
      echoWrapper.style.transform = '';
      infoPanel.style.maxHeight = '';
      return;
    }
    // Posições sem as animações (offset*), para o cálculo não depender do meio da transição
    const right = portrait ? stageEl.clientWidth : Math.max(0, infoPanel.offsetLeft - 8);
    if (!portrait) {
      voiceTranscription.style.left = `${Math.round(right / 2)}px`;
      voiceTranscription.style.maxWidth = `${Math.max(160, Math.round(right - 24))}px`;
    }
    const top = bubbleIsVisible() ? voiceTranscription.offsetTop + voiceTranscription.offsetHeight + 8 : 0;
    // Em pé o cartão fica preso embaixo: com o balão em cima, ele encolhe (e rola) para sobrar
    // espaço para o mascote entre os dois
    let panelLimit = '';
    if (portrait && top) {
      const panelBottom = infoPanel.offsetTop + infoPanel.offsetHeight;
      panelLimit = `min(64%, ${Math.max(120, panelBottom - (top + Math.round(Math.min(size * 0.5, 140)) + 16))}px)`;
    }
    setPanelLimit(panelLimit);
    const bottom = portrait ? infoPanel.offsetTop - 8 : stageEl.clientHeight;
    const visual = Math.max(70, Math.min(size * (portrait ? 0.74 : 0.66), right * 0.9, (bottom - top) * 0.9));
    const dx = right / 2 - (echoWrapper.offsetLeft + echoWrapper.offsetWidth / 2);
    const dy = (top + bottom) / 2 - (echoWrapper.offsetTop + echoWrapper.offsetHeight / 2);
    echoWrapper.style.transform = `translate(${Math.round(dx)}px, ${Math.round(dy)}px) scale(${(visual / size).toFixed(3)})`;
  }

  // Altura máxima do cartão sem animação: a posição final já vale para o cálculo do lugar do mascote
  function setPanelLimit(value) {
    if (infoPanel.style.maxHeight === value) return;
    infoPanel.style.transition = 'none';
    infoPanel.style.maxHeight = value;
    void infoPanel.offsetHeight;
    infoPanel.style.transition = '';
  }

  // setTimeout (não requestAnimationFrame): o ajuste roda mesmo com o app em segundo plano,
  // e ele volta à frente já no tamanho certo
  function scheduleLayout() {
    if (!layoutFrame) layoutFrame = setTimeout(layoutMascot, 0);
  }

  if (window.ResizeObserver && stageEl) new ResizeObserver(scheduleLayout).observe(stageEl);
  window.addEventListener('resize', scheduleLayout);
  window.addEventListener('orientationchange', () => setTimeout(scheduleLayout, 150));
  // Balão aparecendo ou sumindo (classe "hidden") muda a área livre
  new MutationObserver(scheduleLayout).observe(voiceTranscription, { attributes: true, attributeFilter: ['class'] });
  // Cartão abrindo, fechando ou mudando de altura muda o lugar do mascote e do balão
  new MutationObserver(scheduleLayout).observe(infoPanel, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(scheduleLayout).observe(echoWrapper, { attributes: true, attributeFilter: ['class'] });
  if (window.ResizeObserver) new ResizeObserver(scheduleLayout).observe(infoPanel);

  // Balão de altura fixa (3 linhas): o texto sobe acompanhando a fala
  const bubble = { mode: 'static', text: '', shownAt: 0, audio: null, audioText: '', charIndex: null, charText: '', frame: 0 };
  const speechKey = t => String(t || '').replace(/^"|"$/g, '').trim();

  // mode: 'transcript' (sua fala: mostra as últimas palavras), 'speech' (resposta falada) ou 'static'
  function showBubble(text, mode = 'static') {
    bubble.mode = mode;
    bubble.text = speechKey(text);
    bubble.shownAt = performance.now();
    transcriptionText.textContent = text;
    transcriptionText.scrollTop = mode === 'transcript' ? transcriptionText.scrollHeight : 0;
    voiceTranscription.classList.remove('hidden');
    scheduleLayout();
    startBubbleScroll();
  }

  // Quanto da fala já passou (0 a 1): áudio do Edge, palavra da voz do navegador ou ritmo de leitura
  function speechProgress() {
    if (bubble.audio && bubble.audioText === bubble.text) {
      const audio = bubble.audio;
      if (audio.ended) return 1;
      const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : Math.max(2, bubble.text.length / 14);
      return Math.min(1, audio.currentTime / duration);
    }
    if (bubble.charIndex !== null && bubble.charText === bubble.text) {
      return Math.min(1, bubble.charIndex / Math.max(1, bubble.text.length));
    }
    return Math.min(1, (performance.now() - bubble.shownAt) / 1000 / Math.max(3, bubble.text.length / 16));
  }

  function bubbleScrollStep() {
    bubble.frame = 0;
    if (voiceTranscription.classList.contains('hidden')) return;
    const el = transcriptionText;
    const max = el.scrollHeight - el.clientHeight;
    if (max <= 1) return; // cabe em 3 linhas: não rola
    if (bubble.mode === 'transcript') {
      el.scrollTop = max;
      return;
    }
    const progress = speechProgress();
    // Mantém a parte que está sendo falada no meio do balão
    const target = Math.min(max, Math.max(0, progress * el.scrollHeight - el.clientHeight * 0.5));
    el.scrollTop += (target - el.scrollTop) * 0.2;
    if (progress < 1 || Math.abs(target - el.scrollTop) > 0.5) bubble.frame = requestAnimationFrame(bubbleScrollStep);
  }

  function startBubbleScroll() {
    if (!bubble.frame) bubble.frame = requestAnimationFrame(bubbleScrollStep);
  }

  // Chamados pela fala: o balão passa a seguir o áudio (ou a palavra falada) quando é o mesmo texto
  function bubbleFollowAudio(audio, text) {
    bubble.audio = audio;
    bubble.audioText = speechKey(text);
    bubble.charIndex = null;
    startBubbleScroll();
  }

  function bubbleFollowChar(charIndex, text) {
    bubble.charIndex = charIndex;
    bubble.charText = speechKey(text);
    startBubbleScroll();
  }

  scheduleLayout();

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen().catch(() => {});
      } else if (document.exitFullscreen) {
        await document.exitFullscreen().catch(() => {});
      }
    } catch (e) {}
  }

  if (rotateBtn) {
    rotateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFullscreen();
    });
  }

  async function unlockAudioAndWakeLock() {
    // A cada toque: recupera a tela acesa se o navegador tiver soltado o pedido
    if (audioUnlocked) requestWakeLock();
    if (audioToast) {
      audioToast.classList.add('hidden');
      audioToast.style.display = 'none';
    }
    if (!audioUnlocked) {
      audioUnlocked = true;
      Snd.init();
      RobotSfx.unlock();
      if (Snd.ctx && Snd.ctx.state === 'suspended') {
        try { await Snd.ctx.resume(); } catch (_) {}
      }
      // Carrega os sons gravados e cumprimenta ao liberar o áudio
      Snd.loadSamples(localStorage.getItem('echo_pin') || '').then(() => Snd.play('greet'));

      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') await audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        gain.gain.value = 0.001;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(0);
        osc.stop(0.05);
      } catch (e) {
        console.warn('AudioContext unlock:', e);
      }

      requestWakeLock();

      // Inicia escuta mãos livres contínua após o primeiro toque
      if (handsFreeMode) {
        setTimeout(startListening, 600);
      }
    }
  }
  if (screen) {
    screen.addEventListener('click', unlockAudioAndWakeLock);
    screen.addEventListener('touchstart', unlockAudioAndWakeLock, { passive: true });
  }
  window.addEventListener('click', unlockAudioAndWakeLock);
  window.addEventListener('touchstart', unlockAudioAndWakeLock, { passive: true });
  if (audioToast) {
    audioToast.addEventListener('click', (e) => {
      e.stopPropagation();
      unlockAudioAndWakeLock();
    });
    audioToast.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      unlockAudioAndWakeLock();
    }, { passive: false });
  }

  // Tela acesa: o navegador solta o pedido quando o app sai da frente (outro app, notificações, tela
  // bloqueada); por isso pede de novo ao voltar e a cada toque, se tiver sido perdido
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

  // ========================================================
  // 7. SÍNTESE DE VOZ COM SINCRONIA DE BOCA E MÃOS
  // ========================================================
  function startSpeakingAnim(withCoucouBleeps = false) {
    mochi.speaking = true;
    clearInterval(speechTimer);
    if (withCoucouBleeps) {
      speechTimer = setInterval(() => {
        Snd.play('speech');
      }, 180);
    }
  }

  function stopSpeakingAnim() {
    mochi.speaking = false;
    clearInterval(speechTimer);
    speechTimer = null;
  }

  async function speak(text) {
    if (!text) return;
    
    // Pausa reconhecimento temporariamente para o Echo não ouvir a própria voz
    pauseRecognition();

    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
      stopSpeakingAnim();
    }
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }

    let playedServerAudio = false;

    // 1. Tenta áudio de alta qualidade do servidor (Edge TTS oficial pt-BR-AntonioNeural)
    try {
      const response = await fetch('/api/speak', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify({ text })
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('audio')) {
          const blob = await response.blob();
          const audioUrl = URL.createObjectURL(blob);
          currentAudio = new Audio(audioUrl);
          // Balão com o mesmo texto sobe acompanhando este áudio
          bubbleFollowAudio(currentAudio, text);

          currentAudio.onplay = () => {
            // Inicia o movimento da boca no exato instante em que o áudio começa a tocar
            startSpeakingAnim(false);
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
          playedServerAudio = true;
          return;
        }
      }
    } catch (err) {
      console.warn('Servidor TTS indisponível ou sem cota:', err.message);
    }

    // 2. Fallback de voz nativo do dispositivo (SpeechSynthesis em pt-BR)
    // Funciona 100% no celular (Android/iOS) sem depender de cota de API
    if (!playedServerAudio && 'speechSynthesis' in window) {
      try {
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'pt-BR';
        utter.rate = 1.08;
        utter.pitch = 1.04;

        const voices = window.speechSynthesis.getVoices();
        const ptVoice = voices.find(v => v.lang === 'pt-BR' || v.lang.startsWith('pt')) || null;
        if (ptVoice) utter.voice = ptVoice;

        utter.onstart = () => {
          startSpeakingAnim(false);
        };
        // Voz do navegador: o balão segue a palavra que está sendo falada
        utter.onboundary = (event) => bubbleFollowChar(event.charIndex, text);
        utter.onend = () => {
          stopSpeakingAnim();
          resumeListeningIfHandsFree();
        };
        utter.onerror = () => {
          stopSpeakingAnim();
          resumeListeningIfHandsFree();
        };

        window.speechSynthesis.speak(utter);
        return;
      } catch (synthErr) {
        console.warn('SpeechSynthesis error:', synthErr);
      }
    }

    // 3. Fallback acústico com bips do mascote CouCou
    startSpeakingAnim(true);
    setTimeout(() => {
      stopSpeakingAnim();
      resumeListeningIfHandsFree();
    }, Math.min(3000, Math.max(1200, text.length * 60)));
  }

  function resumeListeningIfHandsFree() {
    // Limpa a bolha de diálogo para não deixar texto antigo retido na tela
    setTimeout(() => {
      if (!isListening && !mochi.speaking) {
        voiceTranscription.classList.add('hidden');
      }
    }, 1200);

    if (handsFreeMode && audioUnlocked) {
      // Cooldown de 1.5s para garantir que todo o eco do alto-falante se dissipe no ambiente
      setTimeout(startListening, 1500);
    }
  }

  // ========================================================
  // 8. ESCUTA ATIVA CONTÍNUA POR VOZ (MÃOS LIVRES)
  // ========================================================
  let handsFreeMode = true; // Modo Mãos Livres ativo por padrão
  let processingSpeech = false;
  let speechDebounceTimer = null;

  function setupSpeechRecognition() {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) {
      micBtn.style.display = 'none';
      return;
    }

    recognition = new Speech();
    recognition.lang = 'pt-BR';
    recognition.continuous = false; // Modo sentença única: zera buffer e impede o bug de duplicação do Android
    recognition.interimResults = true;

    recognition.onstart = () => {
      isListening = true;
      micBtn.classList.add('listening');
      micLabel.textContent = handsFreeMode ? 'ATIVO' : 'OUVIR';
      // O botão roxo e a pose de escuta já indicam o microfone ligado;
      // o balão só aparece com a fala reconhecida (onresult)
      voiceTranscription.classList.add('hidden');
      transcriptionText.textContent = '';
      mochi.setState('listening');
    };

    recognition.onresult = (event) => {
      if (processingSpeech || mochi.speaking) return;

      // Pega apenas a sentença atual sem concatenar com históricos anteriores
      const current = event.results[event.results.length - 1];
      if (!current || !current[0]) return;
      const text = current[0].transcript.trim();

      if (text) showBubble(text, 'transcript');

      // Se a frase finalizou ou teve pausa de silêncio, processa imediatamente
      if (current.isFinal && text.length >= 2) {
        clearTimeout(speechDebounceTimer);
        speechDebounceTimer = setTimeout(() => {
          if (!processingSpeech && !mochi.speaking) {
            try { recognition.stop(); } catch(e) {}
            processAndRespond(text);
          }
        }, 500);
      } else if (text.length >= 2) {
        clearTimeout(speechDebounceTimer);
        speechDebounceTimer = setTimeout(() => {
          if (!processingSpeech && !mochi.speaking) {
            try { recognition.stop(); } catch(e) {}
            processAndRespond(text);
          }
        }, 900);
      }
    };

    recognition.onerror = (e) => {
      console.warn('SpeechRecognition status:', e.error);
      if (e.error === 'not-allowed') {
        handsFreeMode = false;
        stopListening();
      }
    };

    recognition.onend = () => {
      isListening = false;
      micBtn.classList.remove('listening');
      micLabel.textContent = handsFreeMode ? 'ATIVO' : 'OUVIR';
      // Reinicia escuta limpa no modo mãos livres se não estiver falando
      if (handsFreeMode && !mochi.speaking && !processingSpeech && audioUnlocked) {
        setTimeout(startListening, 400);
      } else if (!handsFreeMode) {
        stopListening();
      }
    };
  }

  let infoCardTimeout = null;
  const panelTrack = document.getElementById('panel-track');
  const ROW_STATUSES = ['ok', 'warn', 'error'];

  // Linhas do cartão: formato novo (rows: rótulo, valor e status) e o antigo (items), sempre como texto
  function renderCardRows(card) {
    if (!panelExtraItems) return 0;
    const nodes = [];
    (Array.isArray(card?.rows) ? card.rows : []).forEach(row => {
      const element = document.createElement('div');
      element.className = `panel-row status-${ROW_STATUSES.includes(row?.status) ? row.status : 'none'}`;
      const dot = document.createElement('span');
      dot.className = 'row-dot';
      element.append(dot, makeSpan('row-label', String(row?.label ?? '')), makeSpan('row-value', String(row?.value ?? '')));
      nodes.push(element);
    });
    (Array.isArray(card?.items) ? card.items : []).forEach(item => {
      const element = document.createElement('div');
      element.className = 'panel-extra-item';
      element.textContent = String(item);
      nodes.push(element);
    });
    panelExtraItems.replaceChildren(...nodes);
    panelExtraItems.style.display = nodes.length ? 'flex' : 'none';
    infoPanel.classList.toggle('has-rows', nodes.length > 0);
    return nodes.length;
  }

  // A barra só aparece quando o cartão traz um percentual de verdade
  function setPanelProgress(percent, color) {
    if (!panelTrack) return;
    const hasValue = typeof percent === 'number' && Number.isFinite(percent);
    panelTrack.style.display = hasValue ? '' : 'none';
    if (hasValue) {
      panelFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
      panelFill.style.backgroundColor = color || '';
    }
  }

  // Fechamento agendado do cartão atual (reaproveitado para adiar enquanto você rola)
  let infoCardCloser = null;

  // Enquanto você rola ou toca no cartão, ele não fecha
  ['scroll', 'touchmove', 'pointerdown', 'wheel'].forEach(type => {
    infoPanel.addEventListener(type, () => {
      if (infoCardTimeout && infoCardCloser && infoPanel.classList.contains('visible')) {
        clearTimeout(infoCardTimeout);
        infoCardTimeout = window.setTimeout(infoCardCloser, 12000);
      }
    }, { passive: true });
  });

  function displayInfoCard(card, replyText) {
    if (!card) return;
    if (wazeLink) { wazeLink.hidden = true; wazeLink.removeAttribute('href'); }
    if (calendarActions) calendarActions.hidden = true;
    calendarConfirmation = null;
    echoWrapper.className = 'echo-wrapper mode-info';
    infoPanel.classList.add('visible');
    // Atualizações em tempo real (eventos dos agentes) não fecham o cartão antes do tempo
    infoPanel.dataset.card = 'open';

    // Esconde o balão flutuante superior para manter o mascote livre e sem texto na frente
    voiceTranscription.classList.add('hidden');

    panelBadge.textContent = card.badge || 'INFORMAÇÃO';
    panelMainText.textContent = card.title ?? '';
    panelMainText.style.color = '';
    panelSubLine1.textContent = card.detail1 ?? '';
    panelSubLine2.textContent = card.detail2 ?? '';
    setPanelProgress(card.progress);

    // Linhas detalhadas (serviços, backups, contas, tarefas do Forge etc.)
    const rowCount = renderCardRows(card);
    infoPanel.scrollTop = 0;

    // Não duplica a fala no rodapé com aspas azuis quando houver card de dados
    panelVoice.style.display = 'none';
    voiceText.textContent = '';

    // Robô olha expressivamente em direção aos dados (direita no landscape, baixo no portrait)
    setLookForInfoMode();

    // Tempo na tela: o maior entre o tamanho da fala e a quantidade de linhas para ler
    clearTimeout(infoCardTimeout);
    const duration = Math.max(20000, ((replyText || '').length * 100) + 12000, 8000 + rowCount * 2500);
    infoCardTimeout = setTimeout(infoCardCloser = () => {
      // Consultas fecham; propostas aguardam a confirmação do usuário.
      if (typeof calendarActions !== 'undefined' && calendarActions &&
          (typeof calendarConfirmation === 'undefined' || !calendarConfirmation)) {
        calendarActions.hidden = true;
      }
      // O tempo do cartão acabou: a marca sai sempre, para a próxima atualização poder fechar o painel
      if (infoPanel.dataset) delete infoPanel.dataset.card;
      if (echoWrapper.classList.contains('mode-info') && currentState?.mode !== 'info' && (!wazeLink || wazeLink.hidden) && (typeof calendarActions === 'undefined' || !calendarActions || calendarActions.hidden)) {
        echoWrapper.className = 'echo-wrapper mode-full';
        infoPanel.classList.remove('visible');
        if (panelExtraItems) {
          panelExtraItems.replaceChildren();
          panelExtraItems.style.display = 'none';
        }
        mochi.look.x = 0;
        mochi.look.y = 0;
      }
    }, duration);
  }

  async function processAndRespond(text) {
    if (processingSpeech || mochi.speaking) return;
    processingSpeech = true;
    pauseRecognition();

    // Dança: o robô dança 10 s, sem consultar o servidor (a escuta volta ao fim da fala)
    if (isDanceCommand(text)) {
      try {
        showBubble(`"${text}"`, 'transcript');
        mochi.setState('idle');
        mochi.danceFor(10000);
        await speak('Bora dançar!');
        resetInactivity();
      } finally {
        processingSpeech = false;
      }
      return;
    }

    mochi.setState('thinking');
    showBubble(`"${text}"`, 'transcript');

    try {
      if (!calendarCsrf) await initializeCalendar().catch(() => {});
      const res = await fetch('/api/converse', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify({ message: text, calendarConfirmation })
      });
      const data = await res.json();
      if (!res.ok || data?.ok === false) {
        if (data?.source === 'google-calendar') {
          await initializeCalendar().catch(() => {});
          displayInfoCard({ badge: 'GOOGLE AGENDA', title: data.reply || 'Não foi possível concluir o pedido.' });
          showCalendarActions({ source: 'google-calendar' });
        }
        await speak(data?.reply || 'Não consegui preparar seu pedido. Tente novamente.');
        return;
      }
      const reply = data?.reply || "Olá, Mestre! Estratégia Nerd online.";

      if (data?.accessory && data.accessory !== 'none') {
        mochi.setAccessory(data.accessory, 5000);
      }

      // Se a resposta contém dados/cartão, desliza para a esquerda e exibe o painel
      if (data?.card) {
        displayInfoCard(data.card, reply);
      } else {
        // Sem card: se for mensagem curta (<= 45 caracteres), mostra no balão flutuante
        if (reply && reply.length <= 45) {
          showBubble(reply, 'speech');
        } else {
          voiceTranscription.classList.add('hidden');
        }
      }

      const navigationUrl = showNavigationAction(data?.action);
      showCalendarActions(data);
      sharedLocation.show(data);
      // Responde falando com voz oficial neural, mexendo a boca e mãos
      await speak(reply);
      // O botão continua disponível se Android bloquear a abertura sem gesto.
      openNavigationOnAndroid(navigationUrl);

      // Se entrou em modo soneca/sono por comando de voz
      if (data?.state === 'sleeping') {
        mochi.setAccessory('none');
        mochi.setState('sleeping');
        document.body.classList.add('sleep-mode');
      }

      resetInactivity();
    } catch (err) {
      console.warn('Erro ao conversar:', err);
      mochi.setState('idle');
      resumeListeningIfHandsFree();
    } finally {
      processingSpeech = false;
    }
  }

  function pauseRecognition() {
    if (recognition && isListening) {
      try { recognition.stop(); } catch(e){}
    }
  }

  function startListening() {
    if (!recognition || isListening || mochi.speaking || processingSpeech) return;
    try {
      recognition.start();
    } catch (e) {}
  }

  function stopListening() {
    isListening = false;
    micBtn.classList.remove('listening');
    micLabel.textContent = handsFreeMode ? 'ATIVO' : 'OUVIR';
    setTimeout(() => {
      if (!isListening && !mochi.speaking) voiceTranscription.classList.add('hidden');
    }, 7000);

    if (currentState) {
      renderState(currentState);
    } else {
      mochi.setState('idle');
    }
  }

  micBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    unlockAudioAndWakeLock();
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
      micBtn.title = 'Ativar microfone para falar com Echo';
      pauseRecognition();
      stopListening();
    }
  });

  // Briefing Consolidado (Verificações, Saudação e Status do Dia)
  let isBriefingRunning = false;

  async function triggerBriefing() {
    if (isBriefingRunning || processingSpeech || mochi.speaking) return;
    isBriefingRunning = true;
    unlockAudioAndWakeLock();
    pauseRecognition();

    if (briefingBtn) {
      briefingBtn.classList.add('loading');
      briefingLabel.textContent = '...';
    }

    mochi.setState('thinking');
    showBubble('"Executando Briefing do Sistema..."', 'static');

    try {
      const res = await fetch('/api/briefing', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'same-origin'
      });
      const data = await res.json();
      const reply = data?.reply || "Briefing concluído com sucesso, Mestre!";

      if (data?.accessory && data.accessory !== 'none') {
        mochi.setAccessory(data.accessory, 6000);
      }

      if (data?.card) {
        displayInfoCard(data.card, reply);
      } else {
        if (reply && reply.length <= 45) {
          showBubble(reply, 'speech');
        } else {
          voiceTranscription.classList.add('hidden');
        }
      }

      // Fala neural brasileira de alta fidelidade
      await speak(reply);
      resetInactivity();
    } catch (err) {
      console.warn('Erro ao executar briefing:', err);
      mochi.setState('idle');
      resumeListeningIfHandsFree();
    } finally {
      isBriefingRunning = false;
      if (briefingBtn) {
        briefingBtn.classList.remove('loading');
        briefingLabel.textContent = 'CHECK';
      }
    }
  }

  if (briefingBtn) {
    briefingBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerBriefing();
    });
  }

  // ========================================================
  // 9C. FAIXA DE ATIVIDADE: O QUE OS AGENTES ESTÃO FAZENDO (Plano 2B)
  // ========================================================
  const activityTicker = document.getElementById('activity-ticker');
  const activitySteps = []; // mais recente primeiro
  const ACTIVITY_MAX_STEPS = 4;
  const DEFAULT_PROJECT = 'ESTRATÉGIA NERD'; // projeto padrão do servidor quando o agente não informa a pasta
  let lastActivityKey = '';

  function activityIcon(state) {
    const detail = String(state.detail || '');
    if (state.state === 'success') return '✓';
    if (state.state === 'error') return '⚠';
    if (state.state === 'waiting') return state.badge === 'PERGUNTA DO CLAUDE' ? '❓' : '✋';
    if (state.actionType === 'executing') return '✏️';
    if (/^[\w ]+: /.test(detail)) return '⌘';
    return '🔍';
  }

  function activityText(state) {
    // Ferramentas externas (MCP) chegam como mcp__servidor__ferramenta: mostra só a ferramenta
    const detail = String(state.detail || '').replace(/\bmcp__.+?__/g, '');
    if (state.state === 'success') return 'Turno concluído';
    if (state.state === 'waiting') return `Aguardando você: ${detail || 'aprovação'}`;
    return detail || 'Trabalhando';
  }

  // Chamado a cada estado recebido; só registra um passo novo quando algo mudou
  function updateActivityTicker(state) {
    if (!activityTicker || !state) return;
    const active = ['working', 'waiting', 'success', 'error'].includes(state.state) && state.agent && state.agent !== 'ECHO';
    if (!active) {
      activitySteps.length = 0;
      lastActivityKey = '';
      activityTicker.classList.add('hidden');
      activityTicker.replaceChildren();
      return;
    }
    const key = `${state.agent}|${state.state}|${state.actionType}|${state.detail}`;
    if (key === lastActivityKey) return;
    lastActivityKey = key;
    const project = state.project && state.project !== DEFAULT_PROJECT ? String(state.project).toLowerCase() : '';
    activitySteps.unshift({
      agent: state.isMultiAgent ? String(state.agent) : '',
      icon: activityIcon(state),
      text: activityText(state),
      project
    });
    activitySteps.length = Math.min(activitySteps.length, ACTIVITY_MAX_STEPS);
    activityTicker.replaceChildren(...activitySteps.map((step, index) => {
      const line = document.createElement('div');
      line.className = index === 0 ? 'activity-step current' : 'activity-step';
      if (step.agent) line.append(makeSpan('step-agent', step.agent));
      line.append(makeSpan('step-text', `${step.icon} ${step.text}`));
      if (step.project) line.append(makeSpan('step-project', `• ${step.project}`));
      return line;
    }));
    activityTicker.classList.remove('hidden');
  }

  // ========================================================
  // 9B. MODO CELULAR: APROVAR, NEGAR E RESPONDER AO CLAUDE CODE (Plano 2A)
  // ========================================================
  const phoneModeBtn = document.getElementById('phone-mode-btn');
  const approvalSheet = document.getElementById('approval-sheet');
  const approvalBadge = document.getElementById('approval-badge');
  const approvalTimer = document.getElementById('approval-timer');
  const approvalTitle = document.getElementById('approval-title');
  const approvalSummary = document.getElementById('approval-summary');
  const approvalProject = document.getElementById('approval-project');
  const approvalQuestions = document.getElementById('approval-questions');
  const approvalPin = document.getElementById('approval-pin');
  const approvalError = document.getElementById('approval-error');
  const approvalPrimary = document.getElementById('approval-allow');
  const approvalSecondary = document.getElementById('approval-deny');
  const approvalTerminal = document.getElementById('approval-terminal');

  let phoneModeEnabled = false;
  let approvalConfigured = false;
  let sheetMode = null; // 'permission' | 'question' | 'mode'
  let currentRequest = null;
  let questionIndex = 0;
  let collectedAnswers = {};
  let selectedOptions = new Set();
  let approvalCountdown = null;
  let approvalBusy = false;
  const pendingRequests = [];
  // Segundo PIN lembrado só na memória enquanto o modo celular estiver ligado (nunca gravado no aparelho)
  let rememberedApprovalPin = '';

  function setPhoneMode(enabled) {
    phoneModeEnabled = Boolean(enabled);
    if (!phoneModeEnabled) rememberedApprovalPin = '';
    if (!phoneModeBtn) return;
    phoneModeBtn.classList.toggle('active', phoneModeEnabled);
    phoneModeBtn.setAttribute('aria-pressed', String(phoneModeEnabled));
    // Ligado = botão verde (o texto não muda, para caber no rodapé em pé)
    phoneModeBtn.title = phoneModeEnabled ? 'Modo celular ligado: toque para desligar' : 'Ligar a aprovação pelo celular';
  }

  function showApprovalError(message) {
    approvalError.textContent = message || '';
    approvalError.hidden = !message;
  }

  function setApprovalBusy(busy) {
    approvalBusy = busy;
    [approvalPrimary, approvalSecondary, approvalTerminal].forEach(btn => { btn.disabled = busy; });
  }

  async function postApprovalJson(url, body, extraHeaders = {}) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...getAuthHeaders(), ...extraHeaders },
      credentials: 'same-origin',
      body: JSON.stringify(body)
    });
    let data = {};
    try { data = await res.json(); } catch (_) { data = {}; }
    if (!res.ok) {
      const error = new Error(data.error || `Falha (${res.status})`);
      error.status = res.status;
      throw error;
    }
    return data;
  }

  function openApprovalSheet() {
    approvalSheet.classList.remove('hidden');
    showApprovalError('');
    approvalPin.value = '';
  }

  function closeApprovalSheet() {
    approvalSheet.classList.add('hidden');
    clearInterval(approvalCountdown);
    approvalCountdown = null;
    approvalPin.value = '';
    currentRequest = null;
    sheetMode = null;
    showNextRequest();
  }

  function startCountdown(expiresAt) {
    clearInterval(approvalCountdown);
    const tick = () => {
      const left = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      approvalTimer.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      if (left <= 0) {
        clearInterval(approvalCountdown);
        showApprovalError('Prazo encerrado: o pedido voltou para o terminal.');
        setTimeout(() => { if (currentRequest && currentRequest.expiresAt <= Date.now()) closeApprovalSheet(); }, 2500);
      }
    };
    tick();
    approvalCountdown = setInterval(tick, 1000);
  }

  function renderQuestionStep() {
    const q = currentRequest.questions[questionIndex];
    const total = currentRequest.questions.length;
    selectedOptions = new Set();
    approvalBadge.textContent = total > 1 ? `PERGUNTA ${questionIndex + 1}/${total}` : 'PERGUNTA DO CLAUDE';
    approvalTitle.textContent = q.question;
    approvalSummary.textContent = q.multiSelect ? 'Escolha uma ou mais opções.' : 'Escolha uma opção.';
    const buttons = q.options.map(option => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'approval-option';
      btn.append(makeSpan('option-label', option.label));
      if (option.description) btn.append(makeSpan('option-desc', option.description));
      btn.addEventListener('click', () => {
        if (q.multiSelect) {
          if (selectedOptions.has(option.label)) selectedOptions.delete(option.label);
          else selectedOptions.add(option.label);
          btn.classList.toggle('selected', selectedOptions.has(option.label));
        } else {
          selectedOptions = new Set([option.label]);
          approvalQuestions.querySelectorAll('.approval-option').forEach(el => el.classList.toggle('selected', el === btn));
        }
      });
      return btn;
    });
    approvalQuestions.replaceChildren(...buttons);
    approvalQuestions.hidden = false;
    approvalPrimary.textContent = questionIndex + 1 < total ? 'PRÓXIMA' : 'ENVIAR';
  }

  function showRequest(request) {
    currentRequest = request;
    sheetMode = request.kind === 'question' ? 'question' : 'permission';
    openApprovalSheet();
    approvalProject.textContent = request.project ? `Projeto: ${request.project}` : '';
    approvalTerminal.hidden = false;
    // Com o PIN lembrado, o campo some e a decisão vai direto
    approvalPin.hidden = Boolean(rememberedApprovalPin);
    if (sheetMode === 'question') {
      questionIndex = 0;
      collectedAnswers = {};
      approvalSecondary.hidden = true;
      renderQuestionStep();
    } else {
      approvalBadge.textContent = 'APROVAÇÃO NECESSÁRIA';
      approvalTitle.textContent = 'Claude Code precisa de aprovação';
      approvalSummary.textContent = request.summary || '';
      approvalQuestions.replaceChildren();
      approvalQuestions.hidden = true;
      approvalPrimary.textContent = 'PERMITIR';
      approvalSecondary.textContent = 'NEGAR';
      approvalSecondary.hidden = false;
    }
    startCountdown(request.expiresAt);
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    Snd.play('approval');
  }

  function showNextRequest() {
    while (pendingRequests.length && pendingRequests[0].expiresAt <= Date.now()) pendingRequests.shift();
    const next = pendingRequests.shift();
    if (next) showRequest(next);
  }

  function enqueueRequest(request) {
    if (!request || !request.id || request.expiresAt <= Date.now()) return;
    if (currentRequest?.id === request.id || pendingRequests.some(r => r.id === request.id)) return;
    pendingRequests.push(request);
    if (!sheetMode) showNextRequest();
  }

  function removeRequest(id) {
    const index = pendingRequests.findIndex(r => r.id === id);
    if (index !== -1) pendingRequests.splice(index, 1);
    if (currentRequest?.id === id) closeApprovalSheet();
  }

  async function sendDecision(action, answers) {
    if (!currentRequest || approvalBusy) return;
    const typedPin = approvalPin.value.trim();
    const pin = typedPin || rememberedApprovalPin;
    if (action !== 'terminal' && !pin) {
      approvalPin.hidden = false;
      showApprovalError('Digite o segundo PIN.');
      approvalPin.focus();
      return;
    }
    setApprovalBusy(true);
    try {
      await postApprovalJson(
        `/api/approvals/${encodeURIComponent(currentRequest.id)}/decision`,
        { action, ...(answers ? { answers } : {}) },
        action === 'terminal' ? {} : { 'x-echo-approval-pin': pin }
      );
      // PIN digitado depois de reabrir o app: volta a ser lembrado enquanto o modo estiver ligado
      if (typedPin && phoneModeEnabled) rememberedApprovalPin = typedPin;
      Snd.play(action === 'deny' ? 'error' : 'pop');
      closeApprovalSheet();
    } catch (err) {
      // PIN recusado (trocado no PC, por exemplo): esquece e pede de novo
      if (err.status === 401 || err.status === 429) {
        rememberedApprovalPin = '';
        approvalPin.hidden = false;
      }
      showApprovalError(err.message);
    } finally {
      setApprovalBusy(false);
    }
  }

  // Converte a chave pública VAPID (base64url) para o formato do PushManager
  function urlBase64ToUint8Array(base64) {
    const padded = (base64 + '='.repeat((4 - base64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(padded);
    return Uint8Array.from([...raw].map(ch => ch.charCodeAt(0)));
  }

  // Notificações: pede permissão (no toque que ligou o modo) e inscreve este celular
  async function enablePushNotifications() {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'sem suporte';
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (permission !== 'granted') return 'permissão negada';
      const registration = await navigator.serviceWorker.ready;
      const keyRes = await fetch('/api/push/key', { headers: getAuthHeaders(), credentials: 'same-origin' });
      const { publicKey } = await keyRes.json();
      if (!publicKey) return 'servidor sem notificações';
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      }
      await postApprovalJson('/api/push/subscribe', { subscription: subscription.toJSON() });
      return 'ok';
    } catch (err) {
      console.warn('Notificações:', err.message);
      return err.message;
    }
  }

  function openModeSheet() {
    sheetMode = 'mode';
    currentRequest = null;
    openApprovalSheet();
    clearInterval(approvalCountdown);
    approvalTimer.textContent = '';
    approvalBadge.textContent = 'MODO CELULAR';
    approvalTitle.textContent = 'Aprovar pelo celular';
    approvalSummary.textContent = 'Com o modo ligado, cada pedido do Claude Code espera até 110 s pela sua resposta aqui antes de aparecer no terminal.';
    approvalProject.textContent = 'O segundo PIN fica lembrado neste celular enquanto o modo estiver ligado. Desligue o modo quando estiver no PC.';
    approvalQuestions.replaceChildren();
    approvalQuestions.hidden = true;
    approvalPrimary.textContent = 'ATIVAR';
    approvalSecondary.textContent = 'CANCELAR';
    approvalSecondary.hidden = false;
    approvalTerminal.hidden = true;
    approvalPin.hidden = false;
    approvalPin.focus();
  }

  async function activatePhoneMode() {
    const pin = approvalPin.value.trim();
    if (!pin) {
      showApprovalError('Digite o segundo PIN.');
      return;
    }
    setApprovalBusy(true);
    try {
      await postApprovalJson('/api/approvals/mode', { enabled: true }, { 'x-echo-approval-pin': pin });
      setPhoneMode(true);
      rememberedApprovalPin = pin;
      // Ainda dentro do toque: o Android só mostra o pedido de permissão de notificação com um gesto
      const push = await enablePushNotifications();
      closeApprovalSheet();
      displayInfoCard({
        badge: 'MODO CELULAR',
        title: 'Aprovação pelo celular ligada',
        rows: [{ label: 'Notificações', value: push === 'ok' ? 'ativas neste celular' : `não ativadas (${push})`, status: push === 'ok' ? 'ok' : 'warn' }]
      });
    } catch (err) {
      showApprovalError(err.message);
    } finally {
      setApprovalBusy(false);
    }
  }

  async function refreshApprovals() {
    try {
      const res = await fetch('/api/approvals', { headers: getAuthHeaders(), credentials: 'same-origin' });
      if (!res.ok) return;
      const data = await res.json();
      approvalConfigured = Boolean(data.configured);
      setPhoneMode(data.mode?.enabled);
      (data.pending || []).forEach(enqueueRequest);
    } catch (_) {
      // Sem conexão: a próxima reconexão tenta de novo
    }
  }

  approvalPrimary?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (sheetMode === 'mode') return activatePhoneMode();
    if (sheetMode === 'permission') return sendDecision('allow');
    if (sheetMode === 'question') {
      const q = currentRequest.questions[questionIndex];
      if (!selectedOptions.size) return showApprovalError('Escolha uma opção.');
      collectedAnswers[q.question] = q.multiSelect ? [...selectedOptions] : [...selectedOptions][0];
      showApprovalError('');
      if (questionIndex + 1 < currentRequest.questions.length) {
        questionIndex += 1;
        return renderQuestionStep();
      }
      return sendDecision('answer', collectedAnswers);
    }
    return undefined;
  });

  approvalSecondary?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (sheetMode === 'mode') return closeApprovalSheet();
    if (sheetMode === 'permission') return sendDecision('deny');
    return undefined;
  });

  approvalTerminal?.addEventListener('click', (e) => {
    e.stopPropagation();
    sendDecision('terminal');
  });

  approvalPin?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') approvalPrimary.click();
  });

  // Toques dentro do cartão não acionam o resto da tela
  approvalSheet?.addEventListener('click', (e) => e.stopPropagation());

  phoneModeBtn?.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (phoneModeEnabled) {
      try {
        await postApprovalJson('/api/approvals/mode', { enabled: false });
        setPhoneMode(false);
      } catch (err) {
        displayInfoCard({ badge: 'MODO CELULAR', title: 'Não foi possível desligar', detail1: err.message });
      }
      return;
    }
    if (!approvalConfigured) {
      displayInfoCard({
        badge: 'MODO CELULAR',
        title: 'Segundo PIN não configurado',
        detail1: 'Defina ECHO_APPROVAL_PIN no .env do PC e reinicie o Echo.'
      });
      return;
    }
    openModeSheet();
  });

  // Aviso único: página montada bem mais larga que a tela do aparelho de toque ("Site para computador")
  (function checkDesktopMode() {
    const hint = document.getElementById('desktop-hint');
    if (!hint) return;
    // window.screen: aqui "screen" é o elemento da tela do app
    const device = window.screen;
    const touch = navigator.maxTouchPoints > 0;
    const narrowScreen = Math.min(device.width, device.height) < 600;
    if (!touch || !narrowScreen || window.innerWidth < device.width * 1.5) return;
    let seen = false;
    try { seen = localStorage.getItem('echo_desktop_hint') === '1'; } catch (_) { seen = false; }
    if (seen) return;
    hint.classList.remove('hidden');
    document.getElementById('desktop-hint-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      hint.classList.add('hidden');
      try { localStorage.setItem('echo_desktop_hint', '1'); } catch (_) { /* só nesta sessão */ }
    });
  })();

  // ========================================================
  // 9. RENDERIZAÇÃO DE ESTADOS DO PC VIA SSE
  // ========================================================
  // Nomes de agentes chegam do servidor: sempre como texto, nunca como HTML
  function makeSpan(className, text) {
    const span = document.createElement('span');
    span.className = className;
    span.textContent = text;
    return span;
  }

  function makeAgentChip(name) {
    const label = String(name ?? '');
    const lower = label.toLowerCase();
    let chipClass = 'chip-antigravity';
    let icon = '⚡';
    if (lower.includes('claude')) {
      chipClass = 'chip-claude';
      icon = '🔥';
    } else if (lower.includes('codex')) {
      chipClass = 'chip-codex';
      icon = '💻';
    }
    return makeSpan(`agent-chip ${chipClass}`, `${icon} ${label}`);
  }

  function renderAgentChips(state) {
    const container = document.getElementById('agents-chips-container');
    if (!container) return;

    if (state.isMultiAgent && state.activeAgents && state.activeAgents.length > 0) {
      const nodes = [makeSpan('agents-header-tag', '// CONCORRENTES:'), document.createTextNode(' ')];
      state.activeAgents.forEach((name, index) => {
        if (index > 0) nodes.push(document.createTextNode(' '), makeSpan('plus-sep', '+'), document.createTextNode(' '));
        nodes.push(makeAgentChip(name));
      });
      container.replaceChildren(...nodes);
    } else if (state.agent && state.agent !== 'ECHO' && state.state !== 'idle') {
      container.replaceChildren(makeSpan('agents-header-tag', '// AGENTE:'), document.createTextNode(' '), makeAgentChip(state.agent));
    } else {
      container.replaceChildren(makeSpan('agents-header-tag', '// SESSÃO:'), document.createTextNode(' '), makeSpan('agent-chip chip-idle', '💤 AGUARDANDO AGENTES'));
    }
  }

  function renderState(state) {
    currentState = state;

    if (state.project) brandProject.textContent = state.project;
    if (state.badge) badgeTop.textContent = state.badge;

    renderAgentChips(state);

    if (state.isMultiAgent) {
      echoWrapper.classList.add('theme-multi-agent');
    } else {
      echoWrapper.classList.remove('theme-multi-agent');
    }

    // Comportamento: Chegar para o lado quando mostrar algo (mode: 'info')
    // Uma ação local continua visível mesmo quando SSE envia telemetria/idle.
    // Cartão de dados aberto (CHECK, consultas) também continua até o próprio tempo acabar
    const isInfoMode = state.mode === 'info' || (wazeLink && !wazeLink.hidden) || (calendarActions && !calendarActions.hidden) || infoPanel.dataset?.card === 'open';
    if (isInfoMode) {
      echoWrapper.className = `echo-wrapper mode-info ${state.isMultiAgent ? 'theme-multi-agent' : ''}`;
      infoPanel.classList.add('visible');
      // O robô olha expressivamente em direção aos dados (direita no landscape, baixo no portrait)
      setLookForInfoMode();
    } else {
      echoWrapper.className = `echo-wrapper mode-full ${state.isMultiAgent ? 'theme-multi-agent' : ''}`;
      infoPanel.classList.remove('visible');
      mochi.look.x = 0;
      mochi.look.y = 0;
    }

    // Se estiver no meio do reconhecimento de fala, preserva escuta — exceto alertas (aprovação e erro), que têm prioridade
    const isAlert = state.state === 'waiting' || state.badge === 'APROVAÇÃO NECESSÁRIA' || state.state === 'error';
    if (isListening && !isAlert) return;

    // Mapeamento de Estados para o 2D Bot
    if (state.state === 'waiting' || state.badge === 'APROVAÇÃO NECESSÁRIA') {
      mochi.setState('approval');
      panelBadge.textContent = state.badge || 'APROVAÇÃO NECESSÁRIA';
      panelMainText.textContent = state.title || 'APROVAR?';
      panelMainText.style.color = 'var(--amber-neon)';
      setPanelProgress(null);
      renderCardRows(null);
      panelSubLine1.textContent = state.detail || 'Aguardando autorização no PC';
      panelSubLine2.textContent = 'Verifique o plano proposto no console';
    } else if (state.state === 'error') {
      mochi.setState('error');
      panelBadge.textContent = state.badge || 'ERRO';
      panelMainText.textContent = state.title || 'FALHA NA TAREFA';
      panelMainText.style.color = 'var(--rose-neon)';
      setPanelProgress(null);
      renderCardRows(null);
      panelSubLine1.textContent = state.detail || 'Ocorreu um erro durante a execução';
      panelSubLine2.textContent = 'Consulte o log de erro no PC';
    } else if (state.state === 'success') {
      mochi.setState('finished');
    } else if (state.state === 'working') {
      mochi.setState(state.isMultiAgent ? 'multi' : 'working');
    } else {
      mochi.setState('idle');
    }

    // Alerta durante a escuta: só o visual; a fala espera o fim do reconhecimento
    if (isListening) return;

    // Voz
    if (state.voiceMessage && state.voiceMessage !== lastVoicePlayed) {
      lastVoicePlayed = state.voiceMessage;
      voiceText.textContent = state.voiceMessage;
      panelVoice.style.display = 'block';
      // Se a mensagem veio da conversa ativa, o próprio chat já disparou a fala
      if (state.voiceOrigin !== 'converse') {
        speak(state.voiceMessage);
      }
    }
  }

  // ========================================================
  // 10. CONEXÃO SSE & AUTENTICAÇÃO
  // ========================================================
  function connectSSE() {
    if (sseSource) sseSource.close();

    connectionStatus.textContent = 'CONECTANDO...';
    connectionStatus.style.color = 'var(--cyan-neon)';

    const pin = localStorage.getItem('echo_pin');
    const streamUrl = pin ? `/api/stream?pin=${encodeURIComponent(pin)}` : '/api/stream';
    sseSource = new EventSource(streamUrl);

    sseSource.onopen = () => {
      connectionStatus.textContent = 'ONLINE // CONECTADO';
      connectionStatus.style.color = 'var(--matrix-neon)';
      statusDot.style.backgroundColor = 'var(--cyan-neon)';
      pinModal.classList.add('hidden');
      // Modo celular: estado do interruptor e pedidos que chegaram enquanto estava desconectado
      refreshApprovals();
    };

    sseSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        renderState(data);
        updateActivityTicker(data);
        resetInactivity();
      } catch (e) {
        console.error('Erro ao processar estado SSE:', e);
      }
    };

    sseSource.addEventListener('mascot_state', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.accessory) {
          mochi.setAccessory(data.accessory, 5000);
        }
        if (data.text) showBubble(data.text, 'speech');
        resetInactivity();
      } catch (_) {}
    });

    sseSource.addEventListener('telemetry_alert', () => {
      resetInactivity();
    });

    sseSource.addEventListener('approval_request', (event) => {
      try { enqueueRequest(JSON.parse(event.data)); } catch (_) { /* evento inválido */ }
      wakeUp();
      resetInactivity();
    });

    sseSource.addEventListener('approval_resolved', (event) => {
      try { removeRequest(JSON.parse(event.data).id); } catch (_) { /* evento inválido */ }
    });

    sseSource.addEventListener('approval_mode', (event) => {
      try { setPhoneMode(JSON.parse(event.data).enabled); } catch (_) { /* evento inválido */ }
    });

    sseSource.onerror = (err) => {
      connectionStatus.textContent = 'DESCONECTADO // RECONECTANDO...';
      connectionStatus.style.color = 'var(--amber-neon)';
      statusDot.style.backgroundColor = 'var(--amber-neon)';
      sseSource.close();
      checkAuthAndPromptPin();
      setTimeout(connectSSE, 4000);
    };
  }

  async function checkAuthAndPromptPin() {
    try {
      const res = await fetch('/api/auth/status', {
        headers: getAuthHeaders(),
        credentials: 'same-origin'
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
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const data = await res.json();

      if (data.ok) {
        pinModal.classList.add('hidden');
        pinError.style.display = 'none';
        localStorage.setItem('echo_pin', pin);
        connectSSE();
      } else {
        pinError.style.display = 'block';
      }
    } catch (err) {
      pinError.textContent = 'Erro ao validar PIN. Tente novamente.';
      pinError.style.display = 'block';
    }
  }

  pinBtn.addEventListener('click', submitPin);
  pinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitPin();
  });

  // PWA Service Worker com auto-update
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        reg.update();
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                window.location.reload();
              }
            });
          }
        });
      }).catch(() => {});
    });
  }

  // Inicialização
  const urlParams = new URLSearchParams(window.location.search);
  const pinFromUrl = urlParams.get('pin');
  if (pinFromUrl) {
    pinInput.value = pinFromUrl;
    submitPin();
  } else {
    checkAuthAndPromptPin();
  }

  // ========================================================
  // 11. TEMPORIZADOR DE INATIVIDADE (CAFÉ AOS 3 MIN & SONO AOS 6 MIN)
  // ========================================================
  let inactivityTimer = null;
  let sleepTimer = null;

  function wakeUp() {
    if (mochi && mochi.state === 'sleeping') {
      mochi.setState('idle');
      document.body.classList.remove('sleep-mode');
      Snd.play('pop');
      if (handsFreeMode) {
        resumeListeningIfHandsFree();
      }
    }
  }

  function resetInactivity() {
    clearTimeout(inactivityTimer);
    clearTimeout(sleepTimer);

    if (mochi && mochi.state === 'sleeping') {
      wakeUp();
    }

    if (mochi && mochi.accessory === 'coffee') {
      mochi.setAccessory('none');
    }

    // Nível 1: 3 minutos (180s) -> Caneca de café
    inactivityTimer = setTimeout(() => {
      if (mochi && !mochi.speaking && !isListening && !processingSpeech && mochi.state !== 'sleeping') {
        mochi.setAccessory('coffee');
      }
    }, 180000);

    // Nível 2: 6 minutos (360s) -> Adormece em modo sono
    sleepTimer = setTimeout(() => {
      if (mochi && !mochi.speaking && !isListening && !processingSpeech) {
        mochi.setAccessory('none');
        mochi.setState('sleeping');
        document.body.classList.add('sleep-mode');
      }
    }, 360000);
  }

  window.addEventListener('pointerdown', () => {
    wakeUp();
    resetInactivity();
  }, { passive: true });

  window.addEventListener('keydown', () => {
    wakeUp();
    resetInactivity();
  }, { passive: true });

  // Sem zoom por gesto: cancela pinça (dois ou mais dedos) e o gesto de zoom do Safari
  document.addEventListener('touchmove', (event) => {
    if (event.touches && event.touches.length > 1) event.preventDefault();
  }, { passive: false });
  document.addEventListener('gesturestart', (event) => event.preventDefault());

  resetInactivity();

  const sharedLocation = window.createEchoLocation({ scope: 'echo', getHeaders: getAuthHeaders, speak });
  setupSpeechRecognition();
  connectSSE();
  initializeCalendar().catch(() => {});
})();
