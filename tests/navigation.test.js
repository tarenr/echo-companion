const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const navigation = require('../src/navigation');

function memoryMock(address) {
  const values = new Map(address ? [[navigation.WORK_KEY, address]] : []);
  return {
    values,
    getPreference: async key => values.get(key),
    setPreference: async (key, value) => values.set(key, typeof value === 'object' ? JSON.stringify(value) : value)
  };
}

test('cadastro persiste e viagem usa o endereço exato, com parâmetros codificados', async () => {
  const memory = memoryMock();
  const address = 'Rua São João, 123, Centro, Serra, ES';
  const saved = await navigation.handleNavigationMessage(`Echo, meu endereço de trabalho é ${address}`, memory);
  assert.equal(saved.action, undefined);
  assert.equal((await navigation.readDestinations(memory)).trabalho1.address, address);
  for (const command of ['Echo, iniciar uma viagem até o meu trabalho', 'ir para o trabalho', 'abra o Waze para meu trabalho', 'quero ir pro trabalho']) {
    const result = await navigation.handleNavigationMessage(command, memory);
    const url = new URL(result.action.url);
    assert.equal(url.origin, 'https://waze.com');
    assert.equal(url.searchParams.get('q'), address);
    assert.equal(url.searchParams.get('navigate'), 'yes');
  }
});

test('destino ausente ou inválido nunca produz ação nem sobrescreve preferência', async () => {
  assert.equal((await navigation.handleNavigationMessage('ir para o trabalho', memoryMock())).action, undefined);
  const memory = memoryMock('Rua Central, 123, Serra, ES');
  for (const address of ['Centro', '', '<script>, Serra', 'https://evil.test, Serra']) {
    const result = await navigation.handleNavigationMessage(`meu endereço de trabalho é ${address}`, memory);
    assert.equal(result.action, undefined);
    assert.equal(memory.values.get(navigation.WORK_KEY), 'Rua Central, 123, Serra, ES');
  }
});

test('perguntas e destinos diferentes seguem o fluxo conversacional sem abrir Waze', async () => {
  for (const message of ['Qual o endereço do meu trabalho?', 'Como iniciar viagem até meu trabalho?', 'não iniciar viagem até meu trabalho', 'buscar tarefas', 'bom dia', null]) {
    assert.equal(await navigation.handleNavigationMessage(message, memoryMock()), null);
  }
});

test('três links salvos abrem os destinos corretos e trabalho ambíguo pede especificação', async () => {
  const memory = memoryMock('Rua antiga, 123, Serra, ES');
  const links = { 'trabalho 1': 'https://waze.com/ul/h123456789', casa: 'https://waze.com/ul/h234567890', 'trabalho 2': 'https://waze.com/ul/h345678901' };
  for (const [name, link] of Object.entries(links)) {
    await navigation.saveDestination(memory, name, link);
    for (const command of [`ir para ${name}`, `Echo, iniciar uma viagem até ${name}`]) {
      const result = await navigation.handleNavigationMessage(command, memory);
      assert.equal(new URL(result.action.url).pathname, new URL(link).pathname);
      assert.equal(new URL(result.action.url).searchParams.get('navigate'), 'yes');
    }
  }
  assert.equal(memory.values.get(navigation.WORK_KEY), 'Rua antiga, 123, Serra, ES');
  const ambiguous = await navigation.handleNavigationMessage('ir para meu trabalho', memory);
  assert.equal(ambiguous.action, undefined);
  assert.match(ambiguous.reply, /Qual trabalho/);
  const dhl = await navigation.handleNavigationMessage('ir para DHL', memory);
  assert.equal(new URL(dhl.action.url).pathname, '/ul/h123456789');
});

test('busca livre e viagem textual mantêm nome/endereço e não alteram favoritos', async () => {
  const memory = memoryMock();
  const search = await navigation.handleNavigationMessage('Echo, buscar Shopping Vitória no Waze', memory);
  const searchUrl = new URL(search.action.url);
  assert.equal(searchUrl.searchParams.get('q'), 'Shopping Vitória');
  assert.equal(searchUrl.searchParams.has('navigate'), false);
  const trip = await navigation.handleNavigationMessage('inicie uma viagem até Rua X, 100, Serra, ES', memory);
  assert.equal(new URL(trip.action.url).searchParams.get('q'), 'Rua X, 100, Serra, ES');
  assert.equal(new URL(trip.action.url).searchParams.get('navigate'), 'yes');
  assert.equal(memory.values.size, 0);
});

test('cadastro por frase preserva outros destinos e rejeita link externo', async () => {
  const memory = memoryMock();
  await navigation.handleNavigationMessage('minha casa é Rua Central, 123, Serra, ES', memory);
  await navigation.handleNavigationMessage('meu endereço de trabalho dois é Rua Secundária, 456, Serra, ES', memory);
  const before = memory.values.get(navigation.DESTINATIONS_KEY);
  await navigation.handleNavigationMessage('minha casa é https://evil.test/ul/h234567890', memory);
  assert.equal(memory.values.get(navigation.DESTINATIONS_KEY), before);
  assert.equal((await navigation.readDestinations(memory)).trabalho2.address, 'Rua Secundária, 456, Serra, ES');
  for (const command of ['buscar javascript:alert(1) no Waze', 'ir para https://evil.test', 'buscar xx no Waze']) {
    assert.equal((await navigation.handleNavigationMessage(command, memory)).action, undefined);
  }
});

test('cadastro corrompido não é sobrescrito', async () => {
  const memory = memoryMock();
  memory.values.set(navigation.DESTINATIONS_KEY, '{broken');
  await assert.rejects(navigation.saveDestination(memory, 'casa', 'Rua Central, 123, Serra, ES'));
  assert.equal(memory.values.get(navigation.DESTINATIONS_KEY), '{broken');
});

test('middleware responde somente ao requisitante e propaga conversa não relacionada', async () => {
  const handler = navigation.createNavigationMiddleware(memoryMock('Rua Central, 123, Serra, ES'));
  let response;
  let nextCount = 0;
  const res = { json: body => { response = body; } };
  await handler({ body: { message: 'ir para o trabalho' } }, res, () => nextCount++);
  assert.equal(response.action.type, 'open_waze');
  assert.equal(nextCount, 0);
  response = undefined;
  await handler({ body: { message: 'bom dia' } }, res, () => nextCount++);
  assert.equal(response, undefined);
  assert.equal(nextCount, 1);
});

test('erro de memória retorna falha explícita sem ação', async () => {
  const handler = navigation.createNavigationMiddleware({ getPreference: async () => { throw new Error('offline'); } });
  let status, response;
  const res = { status: value => { status = value; return res; }, json: body => { response = body; } };
  await handler({ body: { message: 'ir para o trabalho' } }, res, () => assert.fail());
  assert.equal(status, 503);
  assert.equal(response.ok, false);
  assert.equal(response.action, undefined);
});

test('cliente rejeita URLs externas e mostra alternativa para ação válida', () => {
  const source = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  const start = source.indexOf('  function showNavigationAction(');
  const end = source.indexOf('\n  function getAuthHeaders()', start);
  const wazeLink = { hidden: true };
  const context = vm.createContext({ URL, wazeLink });
  vm.runInContext(source.slice(start, end), context);
  for (const url of ['javascript:alert(1)', 'https://evil.test/ul?q=x&navigate=yes', 'https://waze.com.evil.test/ul?q=x&navigate=yes', 'https://waze.com/other?q=x&navigate=yes', 'https://user@waze.com/ul?q=x&navigate=yes']) {
    assert.equal(context.showNavigationAction({ type: 'open_waze', url }), null);
    assert.equal(wazeLink.hidden, true);
  }
  const url = 'https://waze.com/ul?q=Serra&navigate=yes';
  assert.equal(context.showNavigationAction({ type: 'open_waze', url }), url);
  assert.equal(wazeLink.href, url);
  assert.equal(wazeLink.hidden, false);
  for (const valid of ['https://waze.com/ul/h123456789?navigate=yes&utm_source=echo_companion', 'https://waze.com/ul?q=Shopping+Vit%C3%B3ria&utm_source=echo_companion']) {
    assert.equal(context.showNavigationAction({ type: 'open_waze', url: valid }), valid);
  }
});

test('Android tenta abrir pela voz e mantém botão quando abertura é bloqueada', () => {
  const source = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  const start = source.indexOf('  function showNavigationAction(');
  const end = source.indexOf('\n  function getAuthHeaders()', start);
  const calls = [];
  const wazeLink = { hidden: true };
  const context = vm.createContext({ URL, wazeLink,
    navigator: { userAgent: 'Android' }, document: { visibilityState: 'visible' },
    window: { open: (...args) => { calls.push(args); return null; } }
  });
  vm.runInContext(source.slice(start, end), context);
  const url = context.showNavigationAction({ type: 'open_waze', url: 'https://waze.com/ul?q=Serra&navigate=yes' });
  context.openNavigationOnAndroid(url);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], url);
  assert.equal(wazeLink.hidden, false);
  context.document.visibilityState = 'hidden';
  context.openNavigationOnAndroid(url);
  assert.equal(calls.length, 1);
  context.document.visibilityState = 'visible';
  context.navigator.userAgent = 'Windows';
  context.openNavigationOnAndroid(url);
  assert.equal(calls.length, 1);
  context.navigator.userAgent = 'Android';
  context.window.open = () => { throw new Error('blocked'); };
  assert.doesNotThrow(() => context.openNavigationOnAndroid(url));
  assert.equal(wazeLink.hidden, false);
});

test('estado SSE idle preserva cartão Waze e novo cartão permite retornar ao modo normal', () => {
  const source = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  const start = source.indexOf('  function renderState(state)');
  const end = source.indexOf('    // Se estiver no meio do reconhecimento', start);
  const classes = new Set();
  const context = vm.createContext({
    currentState: null, brandProject: {}, badgeTop: {}, renderAgentChips: () => {},
    echoWrapper: { className: '', classList: { add: () => {}, remove: () => {} } },
    infoPanel: { classList: { add: value => classes.add(value), remove: value => classes.delete(value) } },
    wazeLink: { hidden: false }, setLookForInfoMode: () => {}, mochi: { look: { x: 0, y: 0 } }
  });
  vm.runInContext(source.slice(start, end) + '\n  }', context);
  context.renderState({ mode: 'full', state: 'idle' });
  assert.equal(classes.has('visible'), true);
  assert.match(context.echoWrapper.className, /mode-info/);
  context.wazeLink.hidden = true;
  context.renderState({ mode: 'full', state: 'idle' });
  assert.equal(classes.has('visible'), false);
  assert.match(context.echoWrapper.className, /mode-full/);
});

test('timer normal não esconde ação Waze pendente', () => {
  const source = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  const start = source.indexOf('    infoCardTimeout = setTimeout(');
  const end = source.indexOf('\n  async function processAndRespond', start);
  let callback;
  let removed = false;
  const context = vm.createContext({
    infoCardTimeout: null, duration: 20000, currentState: { mode: 'full' },
    wazeLink: { hidden: false },
    echoWrapper: { className: 'echo-wrapper mode-info', classList: { contains: () => true } },
    infoPanel: { classList: { remove: () => { removed = true; } } },
    panelExtraItems: null, mochi: { look: {} }, setTimeout: fn => { callback = fn; }
  });
  // Retira apenas o fechamento externo de displayInfoCard.
  vm.runInContext(source.slice(start, end).trim().replace(/\}\s*$/, ''), context);
  callback();
  assert.equal(removed, false);
  context.wazeLink.hidden = true;
  callback();
  assert.equal(removed, true);
});
