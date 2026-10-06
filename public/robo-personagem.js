// Robô // folha Personagem (guarda-roupa, fantasia, automático, janela flutuante e sensor), compartilhada por
// Echo (app.js) e Luna (luna.js). A folha monta o próprio HTML; cada página escolhe os botões e passa o que é só
// dela (o que o sensor faz, para onde o robô volta quando a janela flutuante fecha).
// Usa robo-roupas.js (peças comuns e fantasias por dono) e robo-motor.js (janela flutuante e sensor).

(function () {
  'use strict';

  const Roupas = window.RoboRoupas;
  const { createFloating, createSensors } = window.RoboMotor;

  // Botão da folha
  function button(text, id, extraClass) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = extraClass ? `character-item ${extraClass}` : 'character-item';
    btn.textContent = text;
    if (id) btn.id = id;
    return btn;
  }

  // options:
  //   robo        RoboBot da página
  //   owner       'echo' ou 'luna': peças comuns + fantasias e peças desse personagem
  //   storageKey  onde as escolhas ficam neste navegador (ex.: 'echo_personagem')
  //   defaults    escolhas na primeira vez ({ auto, roupa, sensor })
  //   features    { auto, floating, sensor }: botões que a folha mostra
  //   floating    { canvas, driver, home } para a janela flutuante (quando features.floating)
  //   sensor      { onTilt, onShake, onStop } para o sensor de movimento (quando features.sensor)
  function create({ robo, owner, storageKey, defaults, features = {}, floating: floatOpts, sensor: sensorOpts }) {
    const now = () => performance.now();

    // Escolhas guardadas só neste navegador
    const prefs = (() => {
      const base = { auto: false, roupa: {}, sensor: false, ...defaults };
      try {
        return Object.assign(base, JSON.parse(localStorage.getItem(storageKey) || '{}'));
      } catch (_) {
        return base;
      }
    })();
    if (!features.auto) prefs.auto = false;
    function save() {
      try {
        localStorage.setItem(storageKey, JSON.stringify(prefs));
      } catch (_) {
        // Sem armazenamento (aba anônima): vale até fechar a página
      }
    }

    // ---------- HTML da folha ----------
    const sheet = document.createElement('div');
    sheet.className = 'character-sheet hidden';
    sheet.id = 'character-sheet';
    sheet.dataset.personagem = owner;
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-labelledby', 'character-title');
    const card = document.createElement('div');
    card.className = 'character-card';
    const head = document.createElement('div');
    head.className = 'character-head';
    const title = document.createElement('span');
    title.className = 'character-title';
    title.id = 'character-title';
    title.textContent = 'PERSONAGEM';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'character-close';
    closeBtn.id = 'character-close';
    closeBtn.setAttribute('aria-label', 'Fechar');
    closeBtn.textContent = '✕';
    head.append(title, closeBtn);
    const status = document.createElement('div');
    status.className = 'character-status';
    status.id = 'character-status';
    const items = document.createElement('div');
    items.className = 'character-items';
    items.id = 'character-items';
    const actions = document.createElement('div');
    actions.className = 'character-actions';
    const note = document.createElement('p');
    note.className = 'character-note';
    note.id = 'character-note';
    note.hidden = true;
    card.append(head, status, items, actions, note);
    sheet.append(card);
    document.body.append(sheet);

    function showNote(text) {
      note.textContent = text;
      note.hidden = !text;
    }

    // ---------- Fantasias e peças ----------
    const setButtons = Roupas.setsFor(owner).map(([id, set]) => {
      const btn = button(set.label, null, 'character-set');
      btn.dataset.set = id;
      btn.addEventListener('click', () => {
        prefs.auto = false;
        Roupas.toggleSet(robo.wardrobe, id, now());
        prefs.roupa = robo.wardrobe.outfit();
        save();
        render();
      });
      return btn;
    });
    const itemButtons = Roupas.itemsFor(owner).map(([id, item]) => {
      const btn = button(item.label);
      btn.dataset.id = id;
      btn.addEventListener('click', () => {
        // Escolher à mão desliga o automático
        prefs.auto = false;
        robo.wardrobe.toggle(id, now());
        prefs.roupa = robo.wardrobe.outfit();
        save();
        render();
      });
      return btn;
    });
    items.replaceChildren(...setButtons, ...itemButtons);

    // ---------- Ações ----------
    const autoBtn = features.auto ? button('Automático (estação)', 'character-auto') : null;
    const clearBtn = button('Tirar tudo', 'character-clear');
    const floatBtn = features.floating ? button('Janela flutuante', 'character-float') : null;
    const sensorBtn = features.sensor ? button('Sensor de movimento', 'character-sensor') : null;
    actions.append(...[autoBtn, clearBtn, floatBtn, sensorBtn].filter(Boolean));

    // Janela flutuante: no PC o robô vai para uma janela pequena sempre na frente (tocável); no Android, vídeo
    // flutuante. Quando ela fecha, o robô volta à página.
    const floating = features.floating ? createFloating({
      canvas: floatOpts.canvas,
      robo,
      driver: floatOpts.driver,
      home: floatOpts.home,
      onChange: () => render()
    }) : null;
    if (floatBtn) floatBtn.hidden = !('documentPictureInPicture' in window || document.pictureInPictureEnabled);

    // Sensor de movimento: desligado por padrão; a página lembra se ficou ligado
    const sensors = features.sensor ? createSensors({
      onTilt: sensorOpts.onTilt,
      onShake: sensorOpts.onShake,
      onStop: sensorOpts.onStop,
      onNoData: () => {
        prefs.sensor = false;
        save();
        showNote('Nenhuma leitura do sensor: este aparelho não tem sensor ou o endereço não é HTTPS.');
        render();
      }
    }) : null;
    if (sensorBtn) sensorBtn.hidden = typeof DeviceOrientationEvent === 'undefined';

    function render() {
      for (const btn of setButtons) btn.classList.toggle('active', Roupas.setWorn(robo.wardrobe, btn.dataset.set));
      for (const btn of itemButtons) btn.classList.toggle('active', robo.wardrobe.has(btn.dataset.id));
      const worn = robo.wardrobe.ids().map(id => Roupas.ITEMS[id].label).join(', ');
      status.textContent = prefs.auto
        ? `Automático: ${Roupas.seasonFor(new Date()).label}${worn ? ` → ${worn}` : ''}`
        : (worn || 'Sem roupa');
      if (autoBtn) {
        autoBtn.classList.toggle('active', prefs.auto);
        autoBtn.setAttribute('aria-pressed', String(prefs.auto));
      }
      if (floatBtn) floatBtn.textContent = floating.active ? 'Fechar janela flutuante' : 'Janela flutuante';
      if (sensorBtn) {
        sensorBtn.classList.toggle('active', sensors.on);
        sensorBtn.setAttribute('aria-pressed', String(sensors.on));
      }
    }

    // Roupa do dia (automático) ou a escolhida
    let wardrobeDay = '';
    const dayKey = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    function applyWardrobe() {
      if (prefs.auto) robo.wardrobe.set(Roupas.seasonFor(new Date()).outfit, now());
      else robo.wardrobe.set(prefs.roupa || {}, now());
      wardrobeDay = dayKey(new Date());
      render();
    }
    // Automático: troca sozinho quando vira o dia
    if (features.auto) {
      setInterval(() => {
        if (prefs.auto && dayKey(new Date()) !== wardrobeDay) applyWardrobe();
      }, 60000);
    }

    // ---------- Botões ----------
    function open() {
      render();
      showNote('');
      sheet.classList.remove('hidden');
    }
    function close() {
      sheet.classList.add('hidden');
    }
    closeBtn.addEventListener('click', close);
    sheet.addEventListener('click', (e) => {
      if (e.target === sheet) close();
    });
    if (autoBtn) {
      autoBtn.addEventListener('click', () => {
        prefs.auto = !prefs.auto;
        if (!prefs.auto) prefs.roupa = robo.wardrobe.outfit();
        save();
        applyWardrobe();
      });
    }
    clearBtn.addEventListener('click', () => {
      prefs.auto = false;
      robo.wardrobe.clear(now());
      prefs.roupa = robo.wardrobe.outfit();
      save();
      render();
    });
    if (floatBtn) {
      floatBtn.addEventListener('click', async () => {
        try {
          if (floating.active) floating.close();
          else {
            await floating.open();
            close();
          }
        } catch (err) {
          showNote(err.message);
        }
        render();
      });
    }
    if (sensorBtn) {
      sensorBtn.addEventListener('click', async () => {
        showNote('');
        if (sensors.on) {
          sensors.stop();
          prefs.sensor = false;
        } else {
          try {
            await sensors.start();
            prefs.sensor = true;
          } catch (err) {
            prefs.sensor = false;
            showNote(err.message);
          }
        }
        save();
        render();
      });
    }

    // Sensor ligado da última vez: liga ao abrir; se o navegador pedir um toque antes, liga no primeiro toque
    function resumeSensor() {
      if (!sensors || !prefs.sensor || sensors.on) return;
      sensors.start().then(render).catch(() => {
        window.addEventListener('pointerdown', () => {
          if (prefs.sensor && !sensors.on) sensors.start().then(render).catch(() => {});
        }, { once: true, passive: true });
      });
    }

    applyWardrobe();
    resumeSensor();

    return { open, close, render, prefs, floating, sensors, element: sheet };
  }

  window.RoboPersonagem = { create };
})();
