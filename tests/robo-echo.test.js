const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

// Motor do robô num contexto com canvas e relógio de mentira (sem navegador)
function loadMotor() {
  const clock = { now: 1000 };
  const noop = () => {};
  const ctx2d = new Proxy({}, {
    get: (target, key) => (key in target ? target[key] : () => ({ addColorStop: noop })),
    set: (target, key, value) => { target[key] = value; return true; }
  });
  class Path2D { moveTo() {} lineTo() {} quadraticCurveTo() {} closePath() {} }
  const sandbox = { performance: { now: () => clock.now }, devicePixelRatio: 1, Path2D, setTimeout, clearTimeout, console };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read('public/robo-roupas.js'), sandbox);
  vm.runInContext(read('public/robo-motor.js'), sandbox);
  const canvas = { style: {}, getContext: () => ctx2d };
  return { motor: sandbox.RoboMotor, canvas, clock };
}

test('o Echo carrega o robô: roupas, fantasia, motor e folha antes do app.js, públicos no servidor e no cache do app', () => {
  const html = read('public/index.html');
  const order = ['robo-roupas.js', 'robo-roupas-echo.js', 'robo-motor.js', 'robo-personagem.js', 'app.js?v='].map(file => html.indexOf(file));
  assert.ok(order[0] > 0 && order.every((pos, i) => i === 0 || pos > order[i - 1]), 'ordem dos scripts no index.html');
  assert.ok(html.includes('robo-personagem.css'), 'estilos da folha');
  assert.ok(!html.includes('robo-roupas-luna.js'), 'o Echo não carrega a fantasia da Luna');
  assert.ok(!html.includes('id="character-sheet"'), 'a folha não fica mais no HTML (o módulo monta)');

  const files = ['/robo-motor.js', '/robo-roupas.js', '/robo-roupas-echo.js', '/robo-roupas-luna.js', '/robo-personagem.js', '/robo-personagem.css'];
  const server = read('server.js');
  const publicList = server.slice(server.indexOf('const PUBLIC_STATIC_PATHS'), server.indexOf(']);', server.indexOf('const PUBLIC_STATIC_PATHS')));
  for (const file of files) assert.ok(publicList.includes(`'${file}'`), `${file} público (as telas de PIN do Echo e da Luna precisam dele)`);

  const sw = read('public/sw.js');
  const cached = sw.slice(sw.indexOf('const STATIC_ASSETS'), sw.indexOf('];'));
  for (const file of files) assert.ok(cached.includes(`'${file}'`), `${file} no cache do app`);

  const app = read('public/app.js');
  assert.ok(!app.includes('class Bot'), 'a bolha saiu do app.js');
  assert.ok(app.includes('new RoboBot(echoCanvas)'), 'o Echo cria o robô');
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'docs', 'legado', 'mascote-bolha.js')), 'backup da bolha guardado');
});

test('gancho de som: um som por troca de estado, toque, expressão e a entrada ao acordar', () => {
  const { motor, canvas } = loadMotor();
  const robo = new motor.RoboBot(canvas);
  const sounds = [];
  robo.onSound = name => sounds.push(name);
  robo.setState('working');
  robo.setState('working');
  robo.setState('finished');
  robo.squash();
  robo.emote('love');
  assert.deepEqual([...sounds], ['work', 'finish', 'slap', 'love'], 'mesmo estado repetido não toca de novo');

  sounds.length = 0;
  robo.setState('sleeping');
  robo.setState('idle');
  assert.deepEqual([...sounds], ['sleep', 'whoosh'], 'acordar começa a entrada');
  assert.ok(robo.seq && robo.s.oy < -3, 'robô no alto, caindo');
});

test('dança com tempo: dança enquanto durar e para sozinho', () => {
  const { motor, canvas, clock } = loadMotor();
  const robo = new motor.RoboBot(canvas);
  robo.danceFor(1000);
  robo.update();
  assert.equal(robo.dancing, true);
  for (let i = 0; i < 70; i++) { clock.now += 16; robo.update(); }
  assert.equal(robo.dancing, false, 'acabou depois de 1 s');
});

test('comando de voz "dança" reconhecido sem confundir outras frases', () => {
  const app = read('public/app.js');
  const start = app.indexOf('// [danca-inicio]'), end = app.indexOf('// [danca-fim]');
  assert.ok(start > 0 && end > start, 'marcadores do comando no app.js');
  const context = vm.createContext({});
  vm.runInContext(`${app.slice(start, end)}\nthis.isDanceCommand = isDanceCommand;`, context);
  for (const phrase of ['dança', 'Dança!', 'dançar', 'dance', 'Echo, dança', 'echo dança comigo', 'vamos dançar', 'bora dançar', 'dança aí']) {
    assert.equal(context.isDanceCommand(phrase), true, phrase);
  }
  for (const phrase of ['qual a dança do momento', 'como está o tempo', 'ensaio de dança amanhã', '']) {
    assert.equal(context.isDanceCommand(phrase), false, phrase);
  }
});

test('quadro da cabeça só durante ações; some parado e fica escondido na entrada', async () => {
  const { motor, canvas, clock } = loadMotor();
  const robo = new motor.RoboBot(canvas);
  // O selo troca depois de 90 ms (relógio de verdade); a animação usa o relógio de mentira
  const settle = async (ms = 640) => {
    await new Promise(r => setTimeout(r, 120));
    for (let t = 0; t < ms; t += 16) { clock.now += 16; robo.update(); }
  };
  assert.equal(robo.tagScale(), 0, 'abre parado e sem quadro');
  const table = [
    ['working', true], ['idle', false], ['thinking', true], ['listening', false],
    ['multi', true], ['finished', false], ['approval', true], ['error', false], ['sleeping', false]
  ];
  for (const [state, shows] of table) {
    robo.setState(state);
    await settle();
    if (shows) assert.ok(robo.tagScale() > 0.9, `${state}: quadro aparece (${robo.tagScale().toFixed(2)})`);
    else assert.equal(robo.tagScale(), 0, `${state}: sem quadro`);
  }

  // Acordar para trabalhar faz a entrada: o quadro só aparece quando ela acaba (3 s)
  robo.setState('working');
  await settle(1500);
  assert.ok(robo.tagScale() < 0.01, `escondido durante a entrada (${robo.tagScale().toFixed(2)})`);
  await settle(2000);
  assert.ok(robo.tagScale() > 0.9, `aparece depois da entrada (${robo.tagScale().toFixed(2)})`);
});

test('sensor do motor: inclinar, chacoalhar, desligar, sem leitura e permissão negada', async () => {
  const clock = { now: 1000 };
  const listeners = {};
  const sandbox = {
    performance: { now: () => clock.now }, devicePixelRatio: 1, setTimeout, clearTimeout, console,
    Path2D: class { moveTo() {} lineTo() {} quadraticCurveTo() {} closePath() {} },
    DeviceOrientationEvent: function () {}, DeviceMotionEvent: function () {},
    addEventListener: (type, fn) => { listeners[type] = fn; },
    removeEventListener: (type, fn) => { if (listeners[type] === fn) delete listeners[type]; }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read('public/robo-roupas.js'), sandbox);
  vm.runInContext(read('public/robo-motor.js'), sandbox);
  const { createSensors } = sandbox.RoboMotor;

  const calls = { tilt: [], shake: 0, stop: 0, noData: 0 };
  const sensors = createSensors({
    onTilt: v => calls.tilt.push(v), onShake: () => { calls.shake++; },
    onStop: () => { calls.stop++; }, onNoData: () => { calls.noData++; }, noDataMs: 40
  });
  await sensors.start();
  assert.equal(sensors.on, true);
  listeners.deviceorientation({ beta: 45, gamma: 35 });
  assert.equal(calls.tilt[0].lookX, 1, 'inclinado para a direita olha para a direita');
  assert.ok(Math.abs(calls.tilt[0].lean - 0.16) < 1e-9);
  listeners.devicemotion({ acceleration: { x: 20, y: 0, z: 0 } });
  clock.now += 300;
  listeners.devicemotion({ acceleration: { x: -19, y: 0, z: 0 } });
  assert.equal(calls.shake, 1, 'duas sacudidas = tonto');
  await new Promise(r => setTimeout(r, 60));
  assert.equal(sensors.on, true, 'com leitura, continua ligado depois do prazo');
  sensors.stop();
  assert.equal(sensors.on, false);
  assert.equal(calls.stop, 1);
  assert.ok(!listeners.deviceorientation && !listeners.devicemotion, 'parou de ouvir o sensor');

  await sensors.start();
  await new Promise(r => setTimeout(r, 60));
  assert.equal(calls.noData, 1, 'sem leitura no prazo, avisa');
  assert.equal(sensors.on, false, 'e desliga');

  sandbox.DeviceOrientationEvent.requestPermission = async () => 'denied';
  await assert.rejects(sensors.start(), /Permissão do sensor negada/);
  assert.equal(sensors.on, false);
});

test('sensor no Echo: dormindo, chacoalhar acorda; com cartão, o robô segue olhando para ele', () => {
  const app = read('public/app.js');
  const start = app.indexOf('// [sensor-echo-inicio]'), end = app.indexOf('// [sensor-echo-fim]');
  assert.ok(start > 0 && end > start, 'marcadores das regras no app.js');
  const context = vm.createContext({});
  vm.runInContext(`${app.slice(start, end)}\nthis.sensorAction = sensorAction;`, context);
  const { sensorAction } = context;
  assert.equal(sensorAction('tilt', { sleeping: false, cardOpen: false }), 'olhar-e-inclinar');
  assert.equal(sensorAction('tilt', { sleeping: false, cardOpen: true }), 'inclinar', 'com cartão só inclina');
  assert.equal(sensorAction('tilt', { sleeping: true, cardOpen: false }), 'nada', 'dormindo não se mexe');
  assert.equal(sensorAction('shake', { sleeping: false, cardOpen: false }), 'tonto');
  assert.equal(sensorAction('shake', { sleeping: true, cardOpen: false }), 'acordar');

  assert.ok(read('public/robo-personagem.js').includes("'character-sensor'"), 'botão na folha Personagem');
  assert.match(app, /features: \{ auto: true, floating: true, sensor: true \}/, 'o Echo mostra o sensor na folha');
  assert.ok(app.includes("sensor: false }"), 'desligado por padrão');
});

test('robô muito inclinado recua para o quadro da cabeça não sair pelo alto', () => {
  const { motor, canvas, clock } = loadMotor();
  const robo = new motor.RoboBot(canvas);
  const run = (ms) => { for (let t = 0; t < ms; t += 16) { clock.now += 16; robo.update(); } };
  run(1000);
  assert.ok(Math.abs(robo.fz - 1) < 1e-3, 'reto: tamanho normal');
  robo.tg.tilt = 0.16;   // tonto
  robo.tg.lean = 0.16;   // celular inclinado
  run(2000);
  assert.ok(robo.fz < 0.97, `inclinado: recua (${robo.fz.toFixed(3)})`);
  // Canto de cima do quadro da cabeça, já inclinado e recuado, fica dentro do quadro de 280
  const r = robo.s.tilt + robo.s.lean + robo.s.sway;
  const top = 246 - (100 + 126 * Math.cos(r) + 90 * Math.sin(r)) * robo.fz;
  assert.ok(top >= 8, `topo do quadro a ${top.toFixed(1)} px do alto`);
  robo.tg.tilt = 0;
  robo.tg.lean = 0;
  run(3000);
  assert.ok(robo.fz > 0.995, `volta ao normal (${robo.fz.toFixed(3)})`);
});
