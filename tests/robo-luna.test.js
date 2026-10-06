const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = file => fs.readFileSync(path.join(__dirname, '..', 'public', file), 'utf8');

// Contexto de desenho de mentira: qualquer chamada funciona e gradientes aceitam cores
function fakeContext() {
  const noop = () => {};
  return new Proxy({}, {
    get: (target, key) => (key in target ? target[key] : () => ({ addColorStop: noop })),
    set: (target, key, value) => { target[key] = value; return true; }
  });
}

// Roupas comuns + as exclusivas de um ou mais personagens (e o motor, quando pedido), num contexto sem navegador
function load({ owner, owners = owner ? [owner] : [], motor = false } = {}) {
  const clock = { now: 1000 };
  class Path2D { moveTo() {} lineTo() {} quadraticCurveTo() {} closePath() {} }
  const sandbox = { performance: { now: () => clock.now }, devicePixelRatio: 1, Path2D, setTimeout, clearTimeout, console };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read('robo-roupas.js'), sandbox);
  for (const who of owners) vm.runInContext(read(`robo-roupas-${who}.js`), sandbox);
  if (motor) vm.runInContext(read('robo-motor.js'), sandbox);
  const canvas = { style: {}, getContext: () => fakeContext() };
  return { Roupas: sandbox.RoboRoupas, Motor: sandbox.RoboMotor, canvas, clock };
}

test('tema: sem tema o robô é o do Echo com as cores de hoje; a Luna tem as cores e os estados dela', () => {
  const { Motor, canvas } = load({ motor: true });
  const echo = new Motor.RoboBot(canvas);
  assert.equal(echo.theme.id, 'echo');
  assert.deepEqual([...echo.spec.shell], ['#f2fdff', '#8fdcf0']);
  assert.equal(echo.spec.ink, '#041622');
  assert.equal(echo.spec.rim, 'rgba(0, 229, 255, 0.35)');
  assert.equal(echo.spec.tagRim, '#00e5ff');
  assert.equal(echo.spec.neck, '#0b2433');
  assert.deepEqual([...echo.spec.hands], ['#7fe3f5', '#00d4ff']);
  assert.deepEqual([...echo.spec.blush], [184, 41, 221]);
  assert.deepEqual({ ...echo.spec.particles, zzz: [...echo.spec.particles.zzz] }, { heart: '#b829dd', star: '#00d4ff', spark: '#10b981', zzz: [167, 139, 250] });
  assert.deepEqual([...echo.col], [0, 212, 255], 'começa em ciano');
  assert.deepEqual(Object.keys(echo.states), ['idle', 'working', 'multi', 'thinking', 'approval', 'finished', 'error', 'listening', 'sleeping']);

  const luna = new Motor.RoboBot(canvas, { theme: Motor.THEMES.luna });
  assert.deepEqual(Object.keys(luna.states), ['idle', 'talking', 'thinking', 'listening', 'happy', 'sleeping']);
  assert.deepEqual(Object.values(luna.states).map(s => s.label), ['Pronta', 'Falando', 'Pensando', 'Ouvindo', 'Feliz', 'Dormindo']);
  assert.deepEqual([...luna.spec.shell], ['#faf5ff', '#e2c6fc'], 'lavanda');
  assert.deepEqual([...luna.col], [192, 132, 252], 'começa em lavanda');
  assert.equal(luna.states.thinking.badge[0], 'dots', 'quadro >_ ao pensar');

  // Cada um só aceita os próprios estados; os sons vêm do tema
  const sounds = [];
  luna.onSound = name => sounds.push(name);
  luna.setState('working');
  assert.equal(luna.state, 'idle', 'a Luna não tem "Trabalhando"');
  luna.setState('thinking');
  luna.setState('happy');
  assert.equal(luna.state, 'happy');
  assert.deepEqual([...sounds], ['love', 'pop']);
  echo.setState('talking');
  assert.equal(echo.state, 'idle', 'o Echo não tem "Falando"');
});

test('fantasias exclusivas: Echo só vê o esqueleto, Luna só a boneca de pano; as 11 peças comuns nos dois', () => {
  const echo = load({ owner: 'echo' }).Roupas;
  const luna = load({ owner: 'luna' }).Roupas;
  const ids = entries => [...entries.map(([id]) => id)];

  assert.deepEqual(ids(echo.setsFor('echo')), ['esqueleto']);
  assert.deepEqual(ids(luna.setsFor('luna')), ['bonecaDePano']);
  assert.deepEqual(ids(echo.setsFor('luna')), [], 'a página do Echo não tem a fantasia da Luna');
  assert.deepEqual(ids(luna.setsFor('echo')), [], 'a página da Luna não tem a fantasia do Echo');

  const common = ['festa', 'gorro', 'coroa', 'bruxa', 'noel', 'coelho', 'laco', 'abobora', 'oculosEscuros', 'oculosRedondos', 'cachecol'];
  assert.deepEqual(ids(echo.itemsFor('echo')), [...common, 'sorrisoCosturado', 'ternoEsqueleto']);
  assert.deepEqual(ids(luna.itemsFor('luna')), [...common, 'cabeloRuivo', 'rostoBoneca', 'vestidoRetalhos']);

  // Mesmo com os dois arquivos juntos, o filtro por dono separa
  const both = load({ owners: ['echo', 'luna'] });
  assert.ok(!ids(both.Roupas.itemsFor('echo')).includes('cabeloRuivo'), 'peça da Luna fora da lista do Echo');
  assert.ok(!ids(both.Roupas.itemsFor('luna')).includes('ternoEsqueleto'), 'peça do Echo fora da lista da Luna');
});

test('fantasia como conjunto: veste e tira todas as peças; a da Luna devolve o laço ao tirar', () => {
  const { Roupas } = load({ owner: 'luna' });
  assert.deepEqual({ ...Roupas.outfitOf('bonecaDePano') }, { cabeca: 'cabeloRuivo', rosto: 'rostoBoneca', pescoco: 'vestidoRetalhos' }, 'padrão da Luna');

  const w = new Roupas.Wardrobe();
  w.wear('oculosEscuros', 0);
  Roupas.toggleSet(w, 'bonecaDePano', 0);
  assert.equal(Roupas.setWorn(w, 'bonecaDePano'), true);
  assert.deepEqual({ ...w.outfit() }, { cabeca: 'cabeloRuivo', rosto: 'rostoBoneca', pescoco: 'vestidoRetalhos' }, 'a fantasia troca os óculos');
  Roupas.toggleSet(w, 'bonecaDePano', 1000);
  assert.deepEqual({ ...w.outfit() }, { cabeca: 'laco', rosto: null, pescoco: null }, 'sem fantasia, volta o laço');
  assert.equal(Roupas.setWorn(w, 'bonecaDePano'), false);

  // Se ela trocar só uma peça, a fantasia deixa de contar como vestida
  Roupas.toggleSet(w, 'bonecaDePano', 2000);
  w.wear('coroa', 2000);
  assert.equal(Roupas.setWorn(w, 'bonecaDePano'), false);

  const echo = load({ owner: 'echo' }).Roupas;
  const we = new echo.Wardrobe();
  echo.toggleSet(we, 'esqueleto', 0);
  echo.toggleSet(we, 'esqueleto', 1000);
  assert.deepEqual([...we.ids()], [], 'o Echo tira a fantasia sem colocar nada no lugar');
});

test('peças da boneca de pano: lugares, cabelo preso ao robô e desenho sem erro (frente e trás)', () => {
  const { Roupas } = load({ owner: 'luna' });
  const { ITEMS } = Roupas;
  assert.equal(ITEMS.cabeloRuivo.slot, 'cabeca');
  assert.equal(ITEMS.cabeloRuivo.anchor, 'robo', 'o cabelo fica no lugar da cabeça, não na base dos chapéus');
  assert.equal(typeof ITEMS.cabeloRuivo.back, 'function', 'tem a parte de trás');
  assert.equal(ITEMS.rostoBoneca.slot, 'rosto');
  assert.equal(ITEMS.vestidoRetalhos.slot, 'pescoco');
  for (const id of ['cabeloRuivo', 'rostoBoneca', 'vestidoRetalhos']) {
    const it = ITEMS[id];
    assert.equal(it.owner, 'luna');
    const a = it.springs.map(() => 0.3);
    assert.doesNotThrow(() => it.draw(fakeContext(), 0, a), `${id}: frente`);
    if (it.back) assert.doesNotThrow(() => it.back(fakeContext(), 0, a), `${id}: trás`);
  }
});

test('motor: parte de trás antes do corpo e quadro >_ por cima das peças da cabeça; Luna fantasiada desenha', () => {
  const source = read('robo-motor.js');
  const draw = source.slice(source.indexOf('    draw() {'), source.indexOf('    // Peças de um lugar do guarda-roupa'));
  const at = text => {
    const i = draw.indexOf(text);
    assert.ok(i >= 0, text);
    return i;
  };
  assert.ok(at('this.drawWornBack(n)') < at('this.drawBody(t)'), 'cabelo de trás antes do corpo');
  assert.ok(at("this.drawWorn('cabeca', n, t, 'chapeu')") < at('this.drawTag(t)'), 'quadro depois dos chapéus');
  assert.ok(at("this.drawWorn('cabeca', n, t, 'robo')") < at('this.drawTag(t)'), 'quadro depois do cabelo');

  const { Motor, Roupas, canvas, clock } = load({ owner: 'luna', motor: true });
  const robo = new Motor.RoboBot(canvas, { theme: Motor.THEMES.luna });
  Roupas.toggleSet(robo.wardrobe, 'bonecaDePano', clock.now);
  robo.setState('thinking');
  assert.doesNotThrow(() => {
    for (let i = 0; i < 40; i++) {
      clock.now += 16;
      robo.update();
      robo.draw();
    }
  });
});

test('páginas de teste: cada uma carrega só as peças do seu personagem', () => {
  const echo = read('robo.html'), luna = read('robo-luna.html');
  assert.match(echo, /<body data-personagem="echo">/);
  assert.match(luna, /<body data-personagem="luna">/);
  const order = (html, file) => {
    const roupas = html.indexOf('robo-roupas.js'), own = html.indexOf(file), motor = html.indexOf('robo-motor.js'), robo = html.indexOf('robo.js?');
    return roupas > 0 && roupas < own && own < motor && motor < robo;
  };
  assert.ok(order(echo, 'robo-roupas-echo.js'), 'ordem no robo.html');
  assert.ok(order(luna, 'robo-roupas-luna.js'), 'ordem no robo-luna.html');
  assert.ok(!luna.includes('robo-roupas-echo.js'), 'a página da Luna não carrega o esqueleto');

  // O robo.js escolhe pelo <body>; a Luna não tem acessórios de trabalho nem modo automático
  const lab = read('robo.js');
  assert.match(lab, /document\.body\.dataset\.personagem === 'luna'/);
  assert.match(lab, /only: 'echo',\s*id: 'acessorios'/);
  assert.match(lab, /IS_ECHO \? \[\['auto', 'Automático \(estação\)'\]\] : \[\]/);
});

// DOM de mentira, só o que a folha Personagem usa
class FakeElement {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.attrs = {};
    this.listeners = {};
    this.hidden = false;
    this.textContent = '';
    this.className = '';
    const el = this;
    this.classList = {
      add: c => { if (!el.classList.contains(c)) el.className = `${el.className} ${c}`.trim(); },
      remove: c => { el.className = el.className.split(' ').filter(x => x && x !== c).join(' '); },
      toggle: (c, on) => (on ? el.classList.add(c) : el.classList.remove(c)),
      contains: c => el.className.split(' ').includes(c)
    };
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  click() { return Promise.all((this.listeners.click || []).map(fn => fn({ target: this }))); }
}

function loadSheet(owner, stored) {
  const storage = new Map(stored ? [[`${owner}_personagem`, JSON.stringify(stored)]] : []);
  const sandbox = {
    performance: { now: () => 1000 }, setInterval: () => 0, console,
    localStorage: { getItem: k => (storage.has(k) ? storage.get(k) : null), setItem: (k, v) => storage.set(k, v) },
    document: { createElement: tag => new FakeElement(tag), body: new FakeElement('body') }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read('robo-roupas.js'), sandbox);
  vm.runInContext(read(`robo-roupas-${owner}.js`), sandbox);
  sandbox.RoboMotor = {
    createFloating: () => ({ active: null, open: async () => {}, close: () => {} }),
    createSensors: () => ({ on: false, start: async () => {}, stop: () => {} })
  };
  vm.runInContext(read('robo-personagem.js'), sandbox);
  const Roupas = sandbox.RoboRoupas;
  const robo = { wardrobe: new Roupas.Wardrobe() };
  return { sandbox, Roupas, robo, storage };
}
const labels = el => el.children.map(b => b.textContent);
const find = (sheet, cls) => {
  const card = sheet.children[0];
  return card.children.find(c => c.className.split(' ').includes(cls));
};

test('folha Personagem compartilhada: botões por personagem; Luna começa de fantasia e volta ao laço', async () => {
  // Echo: tudo como antes, mais a fantasia de esqueleto em primeiro
  const echo = loadSheet('echo');
  const sheetE = echo.sandbox.RoboPersonagem.create({
    robo: echo.robo, owner: 'echo', storageKey: 'echo_personagem',
    defaults: { auto: true, roupa: {}, sensor: false },
    features: { auto: true, floating: true, sensor: true },
    floating: { canvas: {}, driver: {}, home: () => {} },
    sensor: { onTilt() {}, onShake() {}, onStop() {} }
  });
  const itemsE = labels(find(sheetE.element, 'character-items'));
  assert.equal(itemsE[0], 'Fantasia de esqueleto');
  assert.equal(itemsE.length, 1 + 13, 'fantasia + 11 comuns + 2 do Echo');
  assert.ok(!itemsE.includes('Cabelo ruivo'), 'sem peças da Luna');
  assert.deepEqual(labels(find(sheetE.element, 'character-actions')), ['Automático (estação)', 'Tirar tudo', 'Janela flutuante', 'Sensor de movimento']);
  assert.equal(sheetE.prefs.auto, true, 'Echo continua no automático');

  // Luna: sem automático e sem janela flutuante; começa vestida de boneca de pano
  const luna = loadSheet('luna');
  const sheetL = luna.sandbox.RoboPersonagem.create({
    robo: luna.robo, owner: 'luna', storageKey: 'luna_personagem',
    defaults: { auto: false, roupa: luna.Roupas.outfitOf('bonecaDePano'), sensor: false },
    features: { auto: false, floating: false, sensor: true },
    sensor: { onTilt() {}, onShake() {}, onStop() {} }
  });
  const itemsL = find(sheetL.element, 'character-items');
  assert.equal(itemsL.children[0].textContent, 'Fantasia de boneca de pano');
  assert.ok(!labels(itemsL).includes('Terno de esqueleto'), 'sem peças do Echo');
  assert.deepEqual(labels(find(sheetL.element, 'character-actions')), ['Tirar tudo', 'Sensor de movimento']);
  assert.equal(sheetL.element.dataset.personagem, 'luna', 'cores lavanda na folha');
  assert.deepEqual([...luna.robo.wardrobe.ids()], ['cabeloRuivo', 'rostoBoneca', 'vestidoRetalhos'], 'começa fantasiada');
  assert.ok(itemsL.children[0].classList.contains('active'), 'fantasia marcada como ativa');

  await itemsL.children[0].click();
  assert.deepEqual([...luna.robo.wardrobe.ids()], ['laco'], 'tirou a fantasia: volta o laço');
  assert.deepEqual(JSON.parse(luna.storage.get('luna_personagem')).roupa, { cabeca: 'laco', rosto: null, pescoco: null }, 'lembra a escolha');
  assert.ok(!itemsL.children[0].classList.contains('active'));

  // Um automático guardado por engano não vale para a Luna
  const again = loadSheet('luna', { auto: true, roupa: { cabeca: 'laco' } });
  const sheetA = again.sandbox.RoboPersonagem.create({
    robo: again.robo, owner: 'luna', storageKey: 'luna_personagem',
    defaults: { auto: false, roupa: again.Roupas.outfitOf('bonecaDePano'), sensor: false },
    features: { auto: false, floating: false, sensor: true },
    sensor: { onTilt() {}, onShake() {}, onStop() {} }
  });
  assert.equal(sheetA.prefs.auto, false);
  assert.deepEqual([...again.robo.wardrobe.ids()], ['laco'], 'abre com o que ela escolheu da última vez');
});

test('Luna vira o robô: scripts na página, tema lavanda, folha dela e backup do desenho antigo', () => {
  const html = read('luna.html');
  const order = ['robo-roupas.js', 'robo-roupas-luna.js', 'robo-motor.js', 'robo-personagem.js', 'src="luna.js?v='].map(file => html.indexOf(file));
  assert.ok(order[0] > 0 && order.every((pos, i) => i === 0 || pos > order[i - 1]), 'ordem dos scripts no luna.html');
  assert.ok(html.includes('robo-personagem.css'), 'estilos da folha');
  assert.ok(!html.includes('robo-roupas-echo.js'), 'a Luna não carrega a fantasia do Echo');

  const luna = read('luna.js');
  assert.ok(!/class LunaBot/.test(luna), 'o desenho antigo saiu');
  assert.match(luna, /new RoboBot\(canvas, \{ theme: THEMES\.luna \}\)/);
  assert.match(luna, /owner: 'luna'/);
  assert.match(luna, /storageKey: 'luna_personagem'/);
  assert.match(luna, /defaults: \{ auto: false, roupa: Roupas\.outfitOf\('bonecaDePano'\), sensor: false \}/, 'começa de boneca de pano');
  assert.match(luna, /features: \{ auto: false, floating: false, sensor: true \}/, 'sem automático e sem janela flutuante');
  assert.match(luna, /mochi\.speaking = true;\s*mochi\.setState\('talking'\);/, 'ao falar, a boca mexe e o estado é Falando');
  assert.match(luna, /else if \(ev === 'segurar'\) \{\s*skipGreeting = true;\s*personagem\.open\(\);/, 'segurar abre a folha sem saudar');
  assert.match(read('luna.css'), /#luna-canvas \{[^}]*touch-action: none;/, 'segurar e arrastar sem rolar a tela');

  const backup = fs.readFileSync(path.join(__dirname, '..', 'docs', 'legado', 'mascote-luna.js'), 'utf8');
  assert.match(backup, /class LunaBot/, 'backup do desenho antigo guardado');
});
