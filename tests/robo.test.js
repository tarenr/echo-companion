const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = file => fs.readFileSync(path.join(__dirname, '..', 'public', file), 'utf8');

// Geometria do rosto do robô (bloco entre os marcadores do robo-motor.js)
function loadFace() {
  const source = read('robo-motor.js');
  const start = source.indexOf('// [rosto-inicio]');
  const end = source.indexOf('// [rosto-fim]');
  assert.ok(start > 0 && end > start, 'marcadores do rosto no robo-motor.js');
  const context = vm.createContext({ Math });
  vm.runInContext(`const clamp = (v, a, b) => Math.max(a, Math.min(b, v));\n${source.slice(start, end)}\nthis.api = { FACE, faceFrame, facePoints };`, context);
  return context.api;
}

// Função inteira pelo nome (contagem de chaves a partir da primeira "{")
function extractFunction(source, signature) {
  const start = source.indexOf(signature);
  assert.ok(start >= 0, `função ${signature}`);
  let depth = 0;
  let end = source.indexOf('{', start);
  for (; end < source.length; end++) {
    if (source[end] === '{') depth++;
    else if (source[end] === '}' && --depth === 0) return source.slice(start, end + 1);
  }
  throw new Error(`fim de ${signature} não encontrado`);
}

const LOOKS = [];
for (const yaw of [-0.42, -0.2, 0, 0.2, 0.42]) {
  for (const pitch of [-0.24, -0.1, 0, 0.08, 0.16]) LOOKS.push([yaw, pitch]);
}
const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} != ${b}`);

test('rosto do robô se move como peça única ao olhar e ao girar', () => {
  const { FACE, faceFrame, facePoints } = loadFace();
  const rolls = [0, 0.3, 0.8, 1.2, 2 * Math.PI - 0.4];
  for (const [yaw, pitch] of LOOKS) {
    for (const roll of rolls) {
      const f = faceFrame(yaw, pitch, roll);
      if (!f.visible) continue;
      const p = facePoints(f);
      // Distâncias entre as partes = desenho original na mesma escala do rosto
      FACE.eyes.forEach((eye, i) => {
        close((p.eyes[i].x - p.mouth.x) / f.sx, eye.x - FACE.mouth.x, 'olho-boca x');
        close((p.eyes[i].y - p.mouth.y) / f.sy, eye.y - FACE.mouth.y, 'olho-boca y');
      });
      FACE.cheeks.forEach((cheek, i) => {
        close((p.cheeks[i].x - p.mouth.x) / f.sx, cheek.x - FACE.mouth.x, 'bochecha-boca x');
        close((p.cheeks[i].y - p.mouth.y) / f.sy, cheek.y - FACE.mouth.y, 'bochecha-boca y');
      });
      close((p.mouth.y - p.visor.y) / f.sy, FACE.mouth.y, 'boca-visor y');
    }
  }
});

test('bochechas acompanham a boca ao olhar para cima e para baixo (problema do Echo atual)', () => {
  const { faceFrame, facePoints } = loadFace();
  for (const yaw of [-0.3, 0, 0.3]) {
    const up = facePoints(faceFrame(yaw, -0.24, 0));
    const down = facePoints(faceFrame(yaw, 0.16, 0));
    const mouthMove = down.mouth.y - up.mouth.y;
    assert.ok(mouthMove > 5, 'a boca desce ao olhar para baixo');
    // Mesma descida, a menos do leve achatamento do rosto inteiro em perspectiva (menos de 1 px)
    down.cheeks.forEach((cheek, i) => assert.ok(Math.abs((cheek.y - up.cheeks[i].y) - mouthMove) < 1, 'bochecha desce junto com a boca'));
    down.eyes.forEach((eye, i) => assert.ok(Math.abs((eye.y - up.eyes[i].y) - mouthMove) < 1, 'olho desce junto com a boca'));
  }
});

test('ao olhar em qualquer direção o rosto fica dentro da cabeça', () => {
  const { FACE, faceFrame } = loadFace();
  const HEAD = { cy: -151, hw: 91, hh: 65 };
  for (const [yaw, pitch] of LOOKS) {
    const f = faceFrame(yaw, pitch, 0);
    const half = FACE.visor.w / 2 * f.sx;
    assert.ok(Math.abs(f.x) + half <= HEAD.hw + 2, `visor dentro da cabeça (yaw ${yaw})`);
    assert.ok(f.y - FACE.visor.h / 2 * f.sy >= HEAD.cy - HEAD.hh + 10, `visor abaixo do topo (pitch ${pitch})`);
    assert.ok(f.y + FACE.mouth.y * f.sy <= HEAD.cy + HEAD.hh - 8, `boca acima do pescoço (pitch ${pitch})`);
  }
});

test('no giro de comemoração o rosto dá a volta e termina onde começou', () => {
  const { faceFrame } = loadFace();
  const start = faceFrame(0.1, 0, 0);
  const back = faceFrame(0.1, 0, Math.PI);
  const end = faceFrame(0.1, 0, Math.PI * 2);
  assert.equal(start.visible, true);
  assert.equal(back.visible, false, 'de costas no meio do giro');
  assert.equal(end.visible, true);
  close(end.x, start.x, 'posição final');
  close(end.sx, start.sx, 'escala final');
});

// Tela acesa: mesma regra no Echo, na Luna e na página do robô
for (const file of ['app.js', 'luna.js', 'robo.js']) {
  test(`${file}: pede a tela acesa de novo quando o navegador solta o pedido`, async () => {
    const fn = extractFunction(read(file), 'async function requestWakeLock()');
    const sentinels = [];
    const document = { visibilityState: 'visible' };
    const navigator = {
      wakeLock: {
        request: async () => {
          const listeners = {};
          const sentinel = {
            released: false,
            addEventListener: (type, cb) => { listeners[type] = cb; },
            release() { this.released = true; listeners.release?.(); }
          };
          sentinels.push(sentinel);
          return sentinel;
        }
      }
    };
    const context = vm.createContext({ document, navigator, console: { warn() {} } });
    vm.runInContext(`var wakeLock = null; var wakeLockPending = false;\n${fn}\nthis.requestWakeLock = requestWakeLock;`, context);

    await context.requestWakeLock();
    assert.equal(sentinels.length, 1, 'primeiro pedido');
    await context.requestWakeLock();
    assert.equal(sentinels.length, 1, 'não repete enquanto a tela está garantida');

    sentinels[0].release(); // o navegador soltou (app saiu da frente)
    document.visibilityState = 'hidden';
    await context.requestWakeLock();
    assert.equal(sentinels.length, 1, 'não pede com o app escondido');

    document.visibilityState = 'visible';
    await context.requestWakeLock();
    assert.equal(sentinels.length, 2, 'pede de novo ao voltar');

    await Promise.all([context.requestWakeLock(), context.requestWakeLock()]);
    assert.equal(sentinels.length, 2, 'toques seguidos não duplicam o pedido');
  });
}

// ---------- Guarda-roupa, estações e física (robo-roupas.js) ----------

function loadRoupas() {
  const context = vm.createContext({});
  vm.runInContext(read('robo-roupas.js'), context);
  return context.RoboRoupas;
}

// Bloco do robo-motor.js entre os marcadores [nome-inicio] e [nome-fim]
function loadBlock(name, names) {
  const source = read('robo-motor.js');
  const start = source.indexOf(`// [${name}-inicio]`);
  const end = source.indexOf(`// [${name}-fim]`);
  assert.ok(start > 0 && end > start, `marcadores ${name} no robo-motor.js`);
  const context = vm.createContext({});
  vm.runInContext(`const clamp = (v, a, b) => Math.max(a, Math.min(b, v));\n${source.slice(start, end)}\nthis.api = { ${names} };`, context);
  return context.api;
}

const day = (y, m, d) => new Date(y, m - 1, d, 12);

test('Páscoa calculada a cada ano', () => {
  const { easter } = loadRoupas();
  for (const [year, m, d] of [[2024, 3, 31], [2025, 4, 20], [2026, 4, 5], [2027, 3, 28]]) {
    const e = easter(year);
    assert.deepEqual([e.m, e.d], [m, d], `Páscoa de ${year}`);
  }
});

test('modo automático veste conforme a tabela de datas do Brasil', () => {
  const { seasonFor } = loadRoupas();
  const cases = [
    [day(2026, 1, 1), 'ano-novo', { cabeca: 'festa' }],
    [day(2027, 1, 2), 'ano-novo', { cabeca: 'festa' }],
    [day(2026, 1, 3), 'verao', { rosto: 'oculosEscuros' }],
    [day(2027, 3, 20), 'verao', { rosto: 'oculosEscuros' }],
    [day(2026, 3, 29), 'nenhuma', {}],                       // domingo de Ramos: fora da semana
    [day(2026, 3, 30), 'pascoa', { cabeca: 'coelho' }],
    [day(2026, 4, 5), 'pascoa', { cabeca: 'coelho' }],
    [day(2026, 4, 6), 'nenhuma', {}],
    [day(2027, 3, 22), 'pascoa', { cabeca: 'coelho' }],
    [day(2026, 6, 20), 'nenhuma', {}],
    [day(2026, 6, 21), 'inverno', { cabeca: 'gorro', pescoco: 'cachecol' }],
    [day(2026, 9, 22), 'inverno', { cabeca: 'gorro', pescoco: 'cachecol' }],
    [day(2026, 9, 23), 'nenhuma', {}],
    [day(2026, 10, 6), 'nenhuma', {}],
    [day(2026, 10, 25), 'halloween', { cabeca: 'bruxa' }],
    [day(2026, 10, 31), 'halloween', { cabeca: 'bruxa' }],
    [day(2026, 11, 1), 'aboboras', { cabeca: 'abobora' }],
    [day(2026, 11, 2), 'aboboras', { cabeca: 'abobora' }],
    [day(2026, 11, 3), 'nenhuma', {}],
    [day(2026, 12, 1), 'natal', { cabeca: 'noel' }],
    [day(2026, 12, 21), 'natal', { cabeca: 'noel' }],       // Natal vence o verão
    [day(2026, 12, 25), 'natal', { cabeca: 'noel' }],
    [day(2026, 12, 26), 'ano-novo', { cabeca: 'festa' }]
  ];
  for (const [date, key, outfit] of cases) {
    const season = seasonFor(date);
    assert.equal(season.key, key, date.toDateString());
    assert.deepEqual({ ...season.outfit }, outfit, date.toDateString());
  }
});

test('mola das roupas volta ao repouso, reage ao toque e não explode', () => {
  const { Spring } = loadRoupas();
  const rest = new Spring(70, 6);
  for (let i = 0; i < 120; i++) rest.step(1 / 60);
  assert.equal(rest.a, 0, 'parada sem força continua parada');

  const s = new Spring(70, 6);
  s.kick(6);
  let peak = 0;
  for (let i = 0; i < 30; i++) { s.step(1 / 60); peak = Math.max(peak, Math.abs(s.a)); }
  assert.ok(peak > 0.3, `balança depois do toque (pico ${peak.toFixed(2)})`);
  for (let i = 0; i < 120; i++) s.step(1 / 60);
  assert.ok(Math.abs(s.a) < 0.02, `volta ao repouso em 2,5 s (${s.a.toFixed(3)})`);

  const wild = new Spring(140, 4, 1);
  for (let i = 0; i < 50; i++) wild.step(0.1, 1e6 * (i % 2 ? 1 : -1), -1e6);
  assert.ok(Number.isFinite(wild.a) && Math.abs(wild.a) <= 1.2, 'quadros espaçados e força enorme não estouram');
});

test('guarda-roupa: um item por lugar, combinações e transição de troca', () => {
  const { Wardrobe, ITEMS, SLOTS } = loadRoupas();
  assert.equal(Object.keys(ITEMS).length, 11, '11 peças');
  for (const [id, it] of Object.entries(ITEMS)) {
    assert.ok(SLOTS.includes(it.slot), `${id}: lugar válido`);
    assert.ok(it.label && typeof it.draw === 'function', `${id}: nome e desenho`);
  }
  const w = new Wardrobe();
  w.wear('gorro', 0);
  w.wear('oculosRedondos', 0);
  w.wear('cachecol', 0);
  assert.deepEqual({ ...w.outfit() }, { cabeca: 'gorro', rosto: 'oculosRedondos', pescoco: 'cachecol' }, 'combina os três lugares');
  w.wear('coroa', 1000);
  assert.equal(w.outfit().cabeca, 'coroa', 'outro chapéu troca o atual');
  assert.equal(w.headroom(), ITEMS.coroa.top);

  // Transição: a coroa entra caindo; o gorro sai subindo e some
  const entering = w.layers('cabeca', 1000);
  assert.equal(entering.length, 2, 'gorro saindo e coroa entrando');
  const leaving = entering.find(l => l.item === ITEMS.gorro), arriving = entering.find(l => l.item === ITEMS.coroa);
  assert.equal(leaving.alpha, 1);
  assert.equal(arriving.alpha, 0);
  assert.ok(arriving.dy < -50, 'começa acima');
  w.step(0.35, 1350, 0, 0);
  const settled = w.layers('cabeca', 1500);
  assert.equal(settled.length, 1, 'o gorro já saiu');
  assert.equal(settled[0].alpha, 1);
  assert.ok(Math.abs(settled[0].dy) < 1e-9, 'a coroa assentou');

  assert.equal(w.toggle('coroa', 2000), true);
  assert.equal(w.outfit().cabeca, null, 'tocar de novo tira');
  w.clear(2000);
  assert.deepEqual([...w.ids()], [], 'tirar tudo');
});

test('chapéu alto: o robô recua o suficiente para a peça caber no quadro', () => {
  const { ITEMS, headroomZoom } = loadRoupas();
  assert.equal(headroomZoom(0), 1, 'sem chapéu, sem recuo');
  for (const [id, it] of Object.entries(ITEMS)) {
    const z = headroomZoom(it.top);
    assert.ok(z <= 1 && z > 0.7, `${id}: recuo razoável (${z.toFixed(2)})`);
    assert.ok(z * Math.max(226, 216 + it.top) <= 246 - 12 + 1e-9, `${id}: cabe com margem`);
  }
});

test('óculos ficam sobre os olhos: lentes no mesmo lugar dos olhos do rosto', () => {
  const { LENS_X } = loadRoupas();
  const { FACE } = loadFace();
  assert.equal(LENS_X, FACE.eyes[1].x);
  assert.equal(-LENS_X, FACE.eyes[0].x);
});

test('gestos: toque, duplo, bravo, regiões, segurar e carinho', () => {
  const { GestureReader } = loadBlock('gestos', 'GestureReader');
  const tapAt = (g, t, region) => { g.start(t, 100, 100, region); return g.end(t + 60); };

  let g = new GestureReader();
  assert.deepEqual([...tapAt(g, 0, 'corpo')], ['toque']);
  assert.deepEqual([...tapAt(g, 200, 'corpo')], ['duplo'], 'segundo toque rápido');
  assert.deepEqual([...tapAt(g, 1000, 'visor')], ['toque-visor']);

  g = new GestureReader();
  assert.deepEqual([...tapAt(g, 0, 'peito')], ['toque-peito']);
  assert.deepEqual([...tapAt(g, 1000, 'chapeu')], ['toque-chapeu']);

  g = new GestureReader();
  const burst = [0, 400, 800, 1200, 1600].map(t => [...tapAt(g, t, 'corpo')]);
  assert.deepEqual(burst[4], ['bravo'], '5 toques em 2 s');

  g = new GestureReader();
  g.start(0, 100, 100, 'corpo');
  assert.deepEqual([...g.poll(500)], []);
  assert.deepEqual([...g.poll(650)], ['segurar']);
  assert.deepEqual([...g.end(700)], [], 'segurar não vira toque');

  g = new GestureReader();
  g.start(0, 100, 100, 'cabeca');
  let events = [];
  for (let i = 1; i <= 6; i++) events = events.concat([...g.move(i * 30, 100 + i * 8, 100)]);
  assert.deepEqual(events, ['carinho'], 'um carinho por arrasto');
  assert.deepEqual([...g.end(300)], []);

  g = new GestureReader();
  g.start(0, 100, 100, 'corpo');
  for (let i = 1; i <= 6; i++) assert.deepEqual([...g.move(i * 30, 100 + i * 8, 100)], [], 'arrastar no corpo não é carinho');
  assert.deepEqual([...g.end(300)], [], 'arrastar não é toque');
});

test('sensor: inclinar mira o lado mais baixo; chacoalhar pede dois picos', () => {
  const { tiltFromOrientation, ShakeDetector } = loadBlock('sensor', 'tiltFromOrientation, ShakeDetector');
  assert.deepEqual({ ...tiltFromOrientation(45, 0) }, { lookX: 0, lookY: 0, lean: 0 }, 'celular reto na mão');
  const right = tiltFromOrientation(45, 35);
  assert.equal(right.lookX, 1);
  assert.ok(Math.abs(right.lean - 0.16) < 1e-9);
  const extreme = tiltFromOrientation(120, -90);
  assert.deepEqual([extreme.lookX, extreme.lookY], [-1, 1], 'limitado');

  const shake = new ShakeDetector();
  assert.equal(shake.push(0, 20, 0, 0), false, 'um pico só');
  assert.equal(shake.push(60, 20, 0, 0), false, 'ainda o mesmo pico');
  assert.equal(shake.push(300, 0, 18, 0), true, 'dois picos em 0,6 s');
  assert.equal(shake.push(700, 20, 0, 0), false);
  assert.equal(shake.push(1000, 20, 0, 0), false, 'espera antes de ficar tonto de novo');
  assert.equal(shake.push(3200, 5, 5, 5), false, 'movimento fraco não conta');
});

test('ritmo: batidas de música fazem dançar; silêncio e som contínuo não', () => {
  const { BeatDetector } = loadBlock('ritmo', 'BeatDetector');
  const run = (detector, from, ms, energyAt) => {
    let beats = 0, last = null;
    for (let t = from; t < from + ms; t += 33) {
      last = detector.push(t, energyAt(t));
      if (last.beat) beats++;
    }
    return { beats, music: last.music };
  };
  const d = new BeatDetector();
  const music = run(d, 0, 4000, t => (t % 500 < 66 ? 200 : 60));   // 120 batidas por minuto
  assert.ok(music.beats >= 6 && music.beats <= 9, `batidas em 4 s: ${music.beats}`);
  assert.equal(music.music, true);
  const pause = run(d, 4000, 2500, () => 10);
  assert.equal(pause.music, true, 'continua dançando até 3 s sem batida');
  const silence = run(d, 6500, 1500, () => 10);
  assert.equal(silence.beats, 0);
  assert.equal(silence.music, false, 'para depois de 3 s sem batida');

  const tone = run(new BeatDetector(), 0, 4000, () => 200);
  assert.ok(tone.beats <= 1, 'som alto contínuo não é batida');
  assert.equal(tone.music, false);
});
