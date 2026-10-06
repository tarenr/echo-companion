const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function frontend({ deny = false, failPublish = false } = {}) {
  const elements = [], events = {}, calls = [], watchers = [], intervals = new Map(), timers = new Map(); let cleared = 0, gpsCalls = 0, timerId = 0;
  class Element {
    constructor(tag) { this.tag = tag; this.textContent = ''; this.children = []; this.events = {}; this.open = false; this.hidden = false; this.attrs = {}; this.classList = { toggle: () => {} }; elements.push(this); }
    append(...nodes) { this.children.push(...nodes); }
    setAttribute(k, v) { this.attrs[k] = v; }
    removeAttribute(k) { delete this.attrs[k]; }
    addEventListener(k, v) { this.events[k] = v; }
    showModal() { this.open = true; }
    close() { this.open = false; }
  }
  const bottom = new Element('footer'), body = new Element('body');
  const document = { visibilityState: 'visible', body, createElement: tag => new Element(tag), querySelector: () => bottom, addEventListener: (k, v) => { events[k] = v; } };
  let sharing = false;
  const state = () => ({ ok: true, configured: true, sharing, owner: sharing, csrf: 'test-csrf' });
  const position = () => ({ coords: { latitude: -20.15, longitude: -40.18, accuracy: 10 }, timestamp: Date.now() });
  const navigator = { geolocation: {
    getCurrentPosition: (ok, fail) => { gpsCalls++; deny ? fail({ code: 1 }) : ok(position()); },
    watchPosition: ok => { gpsCalls++; watchers.push(ok); return watchers.length; },
    clearWatch: () => { cleared++; }
  } };
  const window = { isSecureContext: true, addEventListener: (k, v) => { events[k] = v; }, confirm: () => true };
  const context = vm.createContext({ document, window, navigator, URL, Date,
    setInterval: fn => { const id = intervals.size + 1; intervals.set(id, fn); return id; }, clearInterval: id => intervals.delete(id),
    setTimeout: (fn, delay) => { const id = ++timerId; timers.set(id, { fn, delay }); return id; }, clearTimeout: id => timers.delete(id),
    fetch: async (url, options) => {
      const route = url.split('/').at(-1), data = options.body && JSON.parse(options.body); calls.push({ route, data, headers: options.headers });
      if (route === 'update' && failPublish) throw new Error('Sem conexão simulada');
      if (route === 'start') sharing = true; if (route === 'stop') sharing = false;
      return { ok: true, json: async () => route === 'update' ? { ok: true, accepted: true } : state() };
    }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/location.js'), 'utf8'), context);
  const client = window.createEchoLocation({ scope: 'echo', getHeaders: () => ({ 'Content-Type': 'application/json' }) });
  return { elements, events, calls, watchers, intervals, timers, document, client, gpsCalls: () => gpsCalls, cleared: () => cleared, position,
    click: text => elements.find(e => e.tag === 'button' && e.textContent === text).events.click() };
}
test('abrir controle não captura GPS; permissão negada não ativa compartilhamento', async () => {
  const f = frontend({ deny: true }); await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.gpsCalls(), 0);
  await f.click('Compartilhar minha localização');
  assert.equal(f.calls.some(c => c.route === 'start'), false);
  assert.equal(f.calls.some(c => c.route === 'update'), false);
  assert.ok(f.elements.some(e => e.textContent.includes('Permissão de localização negada')));
});
test('GPS só publica após consentimento e callbacks antigos não publicam em segundo plano', async () => {
  const f = frontend(); await new Promise(resolve => setImmediate(resolve));
  await f.click('Compartilhar minha localização');
  assert.ok(f.calls.some(c => c.route === 'start' && c.data.consent === true));
  assert.equal(f.calls.filter(c => c.route === 'update').length, 1);
  assert.equal(f.calls.find(c => c.route === 'update').headers['x-location-csrf'], 'test-csrf');
  const oldWatcher = f.watchers[0];
  f.document.visibilityState = 'hidden'; await f.events.visibilitychange();
  assert.equal(f.intervals.size, 0); assert.equal(f.cleared(), 1);
  await oldWatcher(f.position()); assert.equal(f.calls.filter(c => c.route === 'update').length, 1);
  f.document.visibilityState = 'visible'; await f.events.visibilitychange();
  assert.equal(f.watchers.length, 2);
  assert.equal(f.calls.filter(c => c.route === 'start').length, 1, 'retorno usa consentimento já registrado');
  await f.click('Parar compartilhamento');
  assert.ok(f.calls.some(c => c.route === 'stop')); assert.equal(f.intervals.size, 0);
  await f.watchers[1](f.position()); assert.equal(f.calls.filter(c => c.route === 'update').length, 1);
});
test('mapa só aceita domínio esperado; localização nunca é gravada no localStorage', () => {
  const f = frontend(); const link = f.elements.find(e => e.tag === 'a');
  f.client.show({ source: 'shared-location', reply: 'teste', location: {}, mapUrl: 'https://evil.test/location' });
  assert.equal(link.hidden, true);
  f.client.show({ source: 'shared-location', reply: 'teste', location: {}, mapUrl: 'https://www.google.com/maps/search/?api=1&query=0,0' });
  assert.equal(link.hidden, false); assert.equal(link.referrerPolicy, 'no-referrer');
});

test('falha de envio agenda recuperação limitada e sair da tela cancela a tentativa', async () => {
  const f = frontend({ failPublish: true }); await new Promise(resolve => setImmediate(resolve));
  await f.click('Compartilhar minha localização');
  assert.equal(f.timers.size, 1); assert.equal([...f.timers.values()][0].delay, 30000);
  const retry = [...f.timers.values()][0].fn;
  f.document.visibilityState = 'hidden'; await f.events.visibilitychange();
  assert.equal(f.timers.size, 0);
  const count = f.calls.length; await retry(); assert.equal(f.calls.length, count);
});
