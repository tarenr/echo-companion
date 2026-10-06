// Robô // páginas de testes (laboratório) dos personagens: /robo.html (Echo) e /robo-luna.html (Luna)
// O personagem vem do motor compartilhado (robo-motor.js) e as roupas de robo-roupas.js, mais as exclusivas de
// cada um (robo-roupas-echo.js ou robo-roupas-luna.js). A página diz quem é em <body data-personagem>. Aqui ficam
// a página, os botões e os testes que o Echo não usa (dança pelo microfone e giroscópio).

(function () {
  'use strict';

  const Roupas = window.RoboRoupas;
  const { RoboBot, THEMES, EMOTES, GestureReader, BeatDetector, Sfx, E, createDriver, createFloating, createSensors } = window.RoboMotor;
  const NOW = () => performance.now();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ========================================================
  // 1. PÁGINA: PALCO, LAÇO DE DESENHO E PREFERÊNCIAS
  // ========================================================
  const canvas = document.getElementById('robo-canvas');
  const stage = document.getElementById('robo-stage');
  const controls = document.getElementById('robo-controls');
  const statusEl = document.getElementById('robo-status');
  // Echo (padrão) ou Luna: cores, estados e peças exclusivas
  const PERSONAGEM = document.body.dataset.personagem === 'luna' ? 'luna' : 'echo';
  const IS_ECHO = PERSONAGEM === 'echo';
  const robo = new RoboBot(canvas, { theme: THEMES[PERSONAGEM] });
  robo.onSound = name => Sfx.play(name);
  // Acesso pelo console do navegador, para testes
  window.robo = robo;

  // Preferências só deste navegador: roupa, modo automático e som. A Luna começa com a fantasia dela e não
  // tem modo automático (roupa só por escolha)
  const PREFS_KEY = IS_ECHO ? 'robo_preferencias' : 'robo_luna_preferencias';
  function loadPrefs() {
    const base = IS_ECHO ? { auto: true, roupa: {}, som: false } : { auto: false, roupa: Roupas.outfitOf('bonecaDePano'), som: false };
    try {
      return Object.assign(base, JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'));
    } catch (_) {
      return base;
    }
  }
  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch (_) {
      // Sem armazenamento (aba anônima): vale só até fechar a página
    }
  }
  const prefs = loadPrefs();
  Sfx.on = !!prefs.som;

  // Robô do tamanho do palco (ou da janela flutuante, quando aberta)
  let floating = null;   // janela flutuante do motor (createFloating), criada mais abaixo
  function layout() {
    if (floating && floating.active) return;
    const r = stage.getBoundingClientRect();
    robo.setSize(clamp(Math.min(r.width, r.height) * 0.95, 140, 460));
  }
  if (window.ResizeObserver) new ResizeObserver(layout).observe(stage);
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 150));
  layout();

  // Laço de desenho do motor: quadros da página, da janela flutuante do PC ou relógio em segundo plano
  const driver = createDriver(() => {
    robo.update();
    robo.draw();
  });
  driver.start('quadros');

  // ========================================================
  // 2. GUARDA-ROUPA E MODO AUTOMÁTICO
  // ========================================================
  let testDate = null;
  let lastDay = '';
  const dayKey = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const fmtDate = d => d.toLocaleDateString('pt-BR');
  function currentSeason() {
    return Roupas.seasonFor(testDate || new Date());
  }
  function applyWardrobe() {
    if (IS_ECHO && prefs.auto) robo.wardrobe.set(currentSeason().outfit, NOW());
    else robo.wardrobe.set(prefs.roupa || {}, NOW());
    lastDay = dayKey(new Date());
    refreshUI();
  }
  // Modo automático: troca sozinho quando vira o dia
  setInterval(() => {
    if (IS_ECHO && prefs.auto && !testDate && dayKey(new Date()) !== lastDay) applyWardrobe();
  }, 60000);

  function wardrobeAction(id) {
    const now = NOW();
    if (id === 'auto') {
      prefs.auto = !prefs.auto;
      if (!prefs.auto) prefs.roupa = robo.wardrobe.outfit();
      savePrefs();
      applyWardrobe();
      return;
    }
    prefs.auto = false;
    if (id === 'tirar') robo.wardrobe.clear(now);
    else if (id.startsWith('fantasia:')) Roupas.toggleSet(robo.wardrobe, id.slice(9), now);
    else robo.wardrobe.toggle(id, now);
    prefs.roupa = robo.wardrobe.outfit();
    savePrefs();
  }

  // ========================================================
  // 3. MICROFONE, SENSORES E JANELA FLUTUANTE (testes que o Echo não usa: microfone e giroscópio)
  // ========================================================
  // Dançar com a música do ambiente: graves do microfone, analisados aqui mesmo (nada é gravado ou enviado)
  const mic = { on: false, stream: null, ctx: null, timer: 0 };
  async function startMicDance() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Microfone indisponível aqui (abra pelo endereço HTTPS).');
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch (err) {
      throw new Error(err && err.name === 'NotAllowedError' ? 'Microfone negado. Libere nas permissões do site.' : 'Não foi possível abrir o microfone.');
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.2;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const binHz = ctx.sampleRate / analyser.fftSize;
    const lo = Math.max(1, Math.floor(40 / binHz)), hi = Math.max(lo, Math.ceil(160 / binHz));
    const detector = new BeatDetector();
    Object.assign(mic, { on: true, stream, ctx });
    mic.timer = setInterval(() => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = lo; i <= hi; i++) sum += data[i];
      const result = detector.push(performance.now(), sum / (hi - lo + 1));
      robo.setDancing(result.music, 'musica');
      if (result.beat && result.music) robo.danceBeat();
    }, 33);
  }
  function stopMicDance() {
    clearInterval(mic.timer);
    if (mic.stream) mic.stream.getTracks().forEach(track => track.stop());
    if (mic.ctx) mic.ctx.close().catch(() => {});
    Object.assign(mic, { on: false, stream: null, ctx: null, timer: 0 });
    robo.setDancing(false, 'musica');
  }

  // Sensor de movimento do motor: inclinar faz olhar e inclinar; chacoalhar deixa tonto
  const sensors = createSensors({
    onTilt: (v) => {
      robo.look.x = v.lookX;
      robo.look.y = v.lookY;
      robo.tg.lean = v.lean;
    },
    onShake: () => robo.dizzy(),
    onStop: () => { robo.tg.lean = 0; },
    onNoData: () => {
      setNote('sensores', 'Nenhuma leitura do sensor: este aparelho não tem sensor ou o endereço não é HTTPS.');
      refreshUI();
    }
  });

  // Janela flutuante do motor: no PC o robô vai para uma janela pequena (tocável); no Android, vídeo
  // flutuante. Quando ela fecha, o canvas volta ao palco.
  floating = createFloating({
    canvas, robo, driver,
    home: c => {
      stage.append(c);
      layout();
    },
    onChange: () => refreshUI()
  });

  // ========================================================
  // 4. BOTÕES
  // ========================================================
  let followFinger = false;
  let speakTimer = 0;
  const chosen = { estado: 'idle', acessorio: 'none', olhar: 'center' };

  const LOOKS = {
    left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1], center: [0, 0],
    // Como no Echo: em pé o cartão fica embaixo; deitado, à direita
    card: () => (window.innerHeight >= window.innerWidth ? [0, 0.85] : [0.85, 0.05])
  };

  const ACCESSORIES = [['lupa', 'Lupa'], ['typing', 'Teclado'], ['printer', 'Impressora'], ['celebration', 'Comemoração'], ['coffee', 'Café'], ['none', 'Nenhum']];
  const LOOK_LABELS = [['left', '← Esquerda'], ['right', 'Direita →'], ['up', '↑ Cima'], ['down', '↓ Baixo'], ['center', '● Centro'], ['card', 'Para o cartão'], ['follow', 'Seguir o dedo']];
  const CHEST_SYMBOLS = ['♥', ':)', '!', '?', '♪'];
  let chestIndex = 0;

  function wake() {
    // Acordar faz a entrada (no motor)
    robo.setState('idle');
    chosen.estado = 'idle';
    refreshUI();
  }

  const GROUPS = [
    {
      id: 'estados', title: 'Estados',
      items: Object.entries(robo.states).map(([id, c]) => [id, c.label]),
      isActive: id => chosen.estado === id,
      run: id => {
        // Acordar do modo dormindo faz a entrada (no motor)
        robo.setState(id);
        chosen.estado = id;
      }
    },
    {
      id: 'expressoes', title: 'Expressões',
      items: Object.entries(EMOTES).map(([id, e]) => [id, e.label]),
      run: id => robo.emote(id, 2500)
    },
    {
      id: 'guarda-roupa', title: 'Guarda-roupa',
      // Fantasias do personagem, peças comuns e as dele; a Luna não tem o automático (nem a data de teste)
      items: [
        ...Roupas.setsFor(PERSONAGEM).map(([id, set]) => ['fantasia:' + id, set.label]),
        ...Roupas.itemsFor(PERSONAGEM).map(([id, it]) => [id, it.label]),
        ...(IS_ECHO ? [['auto', 'Automático (estação)']] : []),
        ['tirar', 'Tirar tudo']
      ],
      isActive: id => (id === 'auto' ? prefs.auto
        : id.startsWith('fantasia:') ? Roupas.setWorn(robo.wardrobe, id.slice(9))
        : robo.wardrobe.has(id)),
      run: wardrobeAction,
      extra: IS_ECHO ? buildDateField : null
    },
    {
      // Só o Echo usa acessórios de trabalho
      only: 'echo',
      id: 'acessorios', title: 'Acessórios de trabalho',
      items: ACCESSORIES,
      isActive: id => chosen.acessorio === id,
      run: id => {
        robo.setAccessory(id);
        chosen.acessorio = id;
      }
    },
    {
      id: 'animacoes', title: 'Animações',
      items: [['entrada', 'Entrada'], ['dancar', 'Dançar (10 s)'], ['musica', 'Dançar com a música'], ['som', 'Som']],
      isActive: id => (id === 'musica' ? mic.on : id === 'som' ? Sfx.on : false),
      run: async id => {
        if (id === 'entrada') robo.entrance();
        else if (id === 'dancar') robo.danceFor(10000);
        else if (id === 'som') {
          Sfx.on = !Sfx.on;
          prefs.som = Sfx.on;
          savePrefs();
          if (Sfx.on) {
            Sfx.unlock();
            Sfx.play('chime');
          }
        } else if (id === 'musica') {
          if (mic.on) stopMicDance();
          else {
            setNote('animacoes', 'Ouvindo a música do ambiente. Nada é gravado nem enviado.');
            await startMicDance();
          }
        }
      }
    },
    {
      id: 'acoes', title: 'Ações',
      items: [['speak', 'Falar'], ['blink', 'Piscar'], ['squash', 'Toque'], ['roll', 'Girar'], ['jump', 'Pular']],
      run: id => {
        if (id === 'speak') {
          robo.speaking = true;
          clearTimeout(speakTimer);
          speakTimer = setTimeout(() => { robo.speaking = false; }, 3000);
        } else if (id === 'blink') robo.blink();
        else if (id === 'squash') robo.tap();
        else if (id === 'roll') robo.roll(850, 1);
        else if (id === 'jump') robo.anim('oy', [[-0.2, 140, E.out], [0, 280, E.back]]);
      }
    },
    {
      id: 'olhar', title: 'Olhar',
      items: LOOK_LABELS,
      isActive: id => chosen.olhar === id,
      run: id => {
        chosen.olhar = id;
        followFinger = id === 'follow';
        if (followFinger) return;
        const v = typeof LOOKS[id] === 'function' ? LOOKS[id]() : LOOKS[id];
        robo.look.x = v[0];
        robo.look.y = v[1];
      }
    },
    {
      id: 'sensores', title: 'Sensores',
      items: [['sensor', 'Sensor de movimento'], ['chacoalhar', 'Chacoalhar (simulado)']],
      isActive: id => id === 'sensor' && sensors.on,
      run: async id => {
        if (id === 'chacoalhar') robo.dizzy();
        else if (sensors.on) sensors.stop();
        else {
          setNote('sensores', 'Incline o celular para o robô olhar; chacoalhe para ele ficar tonto.');
          await sensors.start();
        }
      }
    },
    {
      id: 'janela', title: 'Janela flutuante',
      items: [['janela', () => (floating.active ? 'Fechar janela flutuante' : 'Abrir janela flutuante')]],
      isActive: () => !!floating.active,
      run: async () => {
        if (floating.active) floating.close();
        else await floating.open();
      }
    }
  ];

  const notes = {};
  function setNote(groupId, text) {
    const el = notes[groupId];
    if (!el) return;
    el.textContent = text || '';
    el.hidden = !text;
  }

  let dateResult = null;
  function buildDateField() {
    const wrap = document.createElement('label');
    wrap.className = 'robo-date';
    const caption = document.createElement('span');
    caption.textContent = 'Data de teste';
    const input = document.createElement('input');
    input.type = 'date';
    input.addEventListener('change', () => {
      testDate = input.value ? new Date(`${input.value}T12:00:00`) : null;
      // A data de teste mostra o que o modo automático vestiria
      if (testDate) prefs.auto = true;
      savePrefs();
      applyWardrobe();
    });
    dateResult = document.createElement('span');
    dateResult.className = 'robo-date-result';
    wrap.append(caption, input, dateResult);
    return wrap;
  }

  const labelOf = (list, id) => {
    const item = list.find(([key]) => key === id);
    return item ? item[1] : id;
  };

  function updateStatus() {
    const parts = [robo.states[chosen.estado].label];
    if (IS_ECHO && prefs.auto) parts.push(`Automático: ${currentSeason().label}`);
    else {
      const ids = robo.wardrobe.ids();
      if (ids.length) parts.push(ids.map(id => Roupas.ITEMS[id].label).join(', '));
    }
    if (chosen.acessorio !== 'none') parts.push(labelOf(ACCESSORIES, chosen.acessorio));
    if (floating.active) parts.push('Janela flutuante');
    statusEl.textContent = parts.join(' · ');
    if (dateResult) {
      const season = currentSeason();
      const ids = Object.values(season.outfit);
      dateResult.textContent = `${fmtDate(testDate || new Date())}: ${season.label}${ids.length ? ` → ${ids.map(id => Roupas.ITEMS[id].label).join(', ')}` : ''}`;
    }
  }

  const buttons = [];
  function refreshUI() {
    for (const { group, id, label, btn } of buttons) {
      btn.classList.toggle('active', !!(group.isActive && group.isActive(id)));
      if (typeof label === 'function') btn.textContent = label();
    }
    updateStatus();
  }

  function buildControls() {
    const sections = GROUPS.filter(group => !group.only || group.only === PERSONAGEM).map(group => {
      const section = document.createElement('section');
      section.className = 'robo-group';
      section.dataset.group = group.id;
      const title = document.createElement('h2');
      title.textContent = group.title;
      const grid = document.createElement('div');
      grid.className = 'robo-buttons';
      for (const [id, label] of group.items) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'robo-btn';
        btn.textContent = typeof label === 'function' ? label() : label;
        btn.dataset.id = id;
        btn.addEventListener('click', async () => {
          Sfx.unlock();
          try {
            await group.run(id);
          } catch (err) {
            setNote(group.id, err.message);
          }
          if (!group.isActive || !group.isActive(id)) {
            btn.classList.add('flash');
            setTimeout(() => btn.classList.remove('flash'), 400);
          }
          refreshUI();
        });
        buttons.push({ group, id, label, btn });
        grid.appendChild(btn);
      }
      const note = document.createElement('p');
      note.className = 'robo-note';
      note.hidden = true;
      notes[group.id] = note;
      section.append(title, grid);
      if (group.extra) section.append(group.extra());
      section.append(note);
      return section;
    });
    controls.replaceChildren(...sections);
  }
  buildControls();
  applyWardrobe();

  // Segurar o robô: abre o guarda-roupa (como o botão direito no Coucou)
  function openWardrobe() {
    const section = controls.querySelector('[data-group="guarda-roupa"]');
    if (!section) return;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    section.classList.add('flash');
    setTimeout(() => section.classList.remove('flash'), 1200);
    robo.blink();
  }

  // ========================================================
  // 5. TOQUES NO ROBÔ
  // ========================================================
  const gestures = new GestureReader();
  let pressTimer = 0;
  const toCanvas = e => {
    const r = canvas.getBoundingClientRect();
    return { px: (e.clientX - r.left) / r.width * 280, py: (e.clientY - r.top) / r.height * 280 };
  };
  function handleGestures(events) {
    for (const ev of events) {
      if (ev === 'toque') robo.tap();
      else if (ev === 'duplo') robo.hop();
      else if (ev === 'bravo') robo.angry();
      else if (ev === 'toque-visor') robo.surprise();
      else if (ev === 'toque-peito') robo.showSymbol(CHEST_SYMBOLS[chestIndex++ % CHEST_SYMBOLS.length], 2000);
      else if (ev === 'toque-chapeu') robo.hatHop();
      else if (ev === 'carinho') robo.cuddle();
      else if (ev === 'segurar') openWardrobe();
    }
  }
  canvas.addEventListener('pointerdown', (e) => {
    Sfx.unlock();
    // Tocar no robô dormindo acorda (com a entrada)
    if (robo.state === 'sleeping') {
      wake();
      return;
    }
    const p = toCanvas(e);
    gestures.start(performance.now(), p.px, p.py, robo.regionAt(p.px, p.py));
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

  // Com "Seguir o dedo", ele olha para onde o dedo ou o mouse está
  window.addEventListener('pointermove', (e) => {
    if (!followFinger) return;
    const rect = canvas.getBoundingClientRect();
    robo.look.x = Math.tanh((e.clientX - (rect.left + rect.width / 2)) / 120);
    robo.look.y = Math.tanh((e.clientY - (rect.top + rect.height / 2)) / 100);
  });
  window.addEventListener('pointerdown', () => Sfx.unlock(), { passive: true });

  // ========================================================
  // 6. ENTRADA AO ABRIR E AO VOLTAR, E TELA ACESA
  // ========================================================
  // Entrada: ao abrir a página e ao voltar depois de mais de 30 min fora
  let hiddenAt = document.visibilityState === 'hidden' ? Date.now() : 0;
  let pendingEntrance = document.visibilityState !== 'visible';
  if (!pendingEntrance) robo.entrance();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      return;
    }
    if (pendingEntrance || (hiddenAt && Date.now() - hiddenAt > 30 * 60 * 1000)) {
      pendingEntrance = false;
      robo.entrance();
    }
    hiddenAt = 0;
  });

  // Tela acesa: o navegador solta o pedido quando a página sai da frente; pede de novo ao voltar e a cada toque
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
  document.addEventListener('visibilitychange', requestWakeLock);
  window.addEventListener('pointerdown', requestWakeLock, { passive: true });
  requestWakeLock();
})();
