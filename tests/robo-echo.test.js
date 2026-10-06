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

test('o Echo carrega o robô: roupas e motor antes do app.js, públicos no servidor e no cache do app', () => {
  const html = read('public/index.html');
  const roupas = html.indexOf('robo-roupas.js'), motor = html.indexOf('robo-motor.js'), appTag = html.indexOf('app.js?v=');
  assert.ok(roupas > 0 && roupas < motor && motor < appTag, 'ordem dos scripts no index.html');

  const server = read('server.js');
  const publicList = server.slice(server.indexOf('const PUBLIC_STATIC_PATHS'), server.indexOf(']);', server.indexOf('const PUBLIC_STATIC_PATHS')));
  for (const file of ['/robo-motor.js', '/robo-roupas.js']) assert.ok(publicList.includes(`'${file}'`), `${file} público (a tela de PIN do Echo precisa dele)`);

  const sw = read('public/sw.js');
  const cached = sw.slice(sw.indexOf('const STATIC_ASSETS'), sw.indexOf('];'));
  for (const file of ['/robo-motor.js', '/robo-roupas.js']) assert.ok(cached.includes(`'${file}'`), `${file} no cache do app`);

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
