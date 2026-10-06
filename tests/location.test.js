const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const { LocationStore } = require('../src/locationStore');
const { LocationService, createLocationRoutes, geohashPoint, targetFromMessage } = require('../src/location');
const { LocationGeocoder, formatAddress } = require('../src/connectors/locationGeocoder');
function fixture(options = {}) {
  let data = {}, clock = Date.parse('2026-10-06T00:00:00Z');
  const store = { configured: true, read: () => structuredClone(data), write: value => { data = structuredClone(value); } };
  const service = new LocationService({ store, now: () => clock, geocoder: { address: async () => null }, ...options });
  const position = (extra = {}) => ({ latitude: -20.13, longitude: -40.31, accuracy: 10, capturedAt: clock, ...extra });
  return { service, position, tick: ms => { clock += ms; }, store };
}
test('armazenamento cifra a posição e autentica o arquivo sem sobrescrever corrupção', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-location-test-'));
  t.after(() => { if (path.dirname(dir) !== os.tmpdir() || !path.basename(dir).startsWith('echo-location-test-')) throw Error('Pasta inesperada'); fs.rmSync(dir, { recursive: true, force: true }); });
  const file = path.join(dir, 'secure.json'), key = crypto.randomBytes(32).toString('base64');
  const store = new LocationStore({ key, file });
  store.write({ luna: { position: { latitude: -20.123456789 } } });
  assert.equal(fs.readFileSync(file, 'utf8').includes('-20.123456789'), false);
  assert.equal(store.read().luna.position.latitude, -20.123456789);
  assert.throws(() => new LocationStore({ key: crypto.randomBytes(32).toString('base64'), file }).read(), /Preserve/);
  const invalid = '{broken'; fs.writeFileSync(file, invalid);
  assert.throws(() => store.read(), /Preserve/); assert.equal(fs.readFileSync(file, 'utf8'), invalid);
});
test('um celular por mascote, substituição explícita e revogação impedem publicação antiga', () => {
  const f = fixture(); f.service.start('echo', 'phone1');
  assert.throws(() => f.service.update('echo', 'phone2', f.position()), /transmissor/);
  assert.throws(() => f.service.start('echo', 'phone2'), /substituição/);
  f.service.update('echo', 'phone1', f.position()); f.service.start('echo', 'phone2', true);
  assert.equal(f.store.read().echo.position, undefined);
  assert.throws(() => f.service.update('echo', 'phone1', f.position()), /transmissor/);
  assert.throws(() => f.service.stop('echo', 'phone1'), /Outro celular/);
  assert.equal(f.service.status('echo', 'phone2').owner, true);
  f.service.stop('echo'); assert.deepEqual(f.store.read(), {});
  assert.throws(() => f.service.update('echo', 'phone2', f.position()), /transmissor/);
});
test('valida coordenadas, precisão, captura antiga, futura e publicação fora de ordem', () => {
  const f = fixture(); f.service.start('luna', 'phone');
  for (const extra of [{ latitude: 91 }, { longitude: '0' }, { accuracy: -1 }, { accuracy: Infinity }, { capturedAt: 0 }, { capturedAt: f.position().capturedAt + 6000 }]) assert.throws(() => f.service.update('luna', 'phone', f.position(extra)), /inválida/);
  assert.equal(f.service.update('luna', 'phone', f.position()).accepted, true);
  assert.equal(f.service.update('luna', 'phone', f.position()).accepted, false);
  f.tick(5000); assert.equal(f.service.update('luna', 'phone', f.position()).accepted, false);
  f.tick(10000); assert.equal(f.service.update('luna', 'phone', f.position()).accepted, true);
});
test('sem GPS, recente, antiga e expirada são respostas distintas', async () => {
  const f = fixture(); assert.match((await f.service.lookup('luna')).reply, /não está compartilhando/);
  f.service.start('luna', 'phone'); assert.match((await f.service.lookup('luna')).reply, /não há posição/);
  f.service.update('luna', 'phone', f.position()); assert.equal((await f.service.lookup('luna')).location.fresh, true);
  f.tick(121000); assert.match((await f.service.lookup('luna')).reply, /última localização conhecida/);
  f.tick(86400000); const expired = await f.service.lookup('luna'); assert.equal(expired.location, undefined); assert.equal(f.store.read().luna.position, undefined);
});
test('proximidade usa geohash do destino cadastrado e rejeita GPS impreciso', async () => {
  const link = 'https://waze.com/ul/h7h7mmdcj9', point = geohashPoint(link);
  assert.ok(Math.abs(point.latitude - (-20.154827)) < 0.00001);
  assert.ok(Math.abs(point.longitude - (-40.186551)) < 0.00001);
  assert.equal(geohashPoint('https://evil.test/ul/h7h7mmdcj9'), null);
  const f = fixture({ memory: { getPreference: async () => JSON.stringify({ casa: { link } }) } });
  f.service.start('echo', 'phone'); f.service.update('echo', 'phone', f.position(point));
  assert.match((await f.service.lookup('echo')).reply, /perto de Casa/);
  f.tick(15000); f.service.update('echo', 'phone', f.position({ ...point, accuracy: 900 }));
  assert.doesNotMatch((await f.service.lookup('echo')).reply, /perto de Casa/);
});
test('revogar durante geocodificação não revela a posição removida', async () => {
  let release; const f = fixture({ geocoder: { address: () => new Promise(resolve => { release = resolve; }) } });
  f.service.start('luna', 'phone'); f.service.update('luna', 'phone', f.position());
  const answer = f.service.lookup('luna'); f.service.stop('luna'); release('Rua simulada');
  const result = await answer; assert.equal(result.location, undefined); assert.equal(result.mapUrl, undefined); assert.doesNotMatch(result.reply, /Rua simulada/);
});
test('comandos reconhecem consultas recíprocas sem confundir outras perguntas', () => {
  assert.equal(targetFromMessage('Echo, onde a Luna está?', 'echo'), 'luna');
  assert.equal(targetFromMessage('Luna, onde o Echo está?', 'luna'), 'echo');
  assert.equal(targetFromMessage('onde é o dentista?', 'echo'), null);
  assert.equal(targetFromMessage('Luna, bom dia', 'luna'), null);
});
test('Geocoding desligado não chama API; falhas não inventam endereço e chave não retorna', async () => {
  let calls = 0; const disabled = new LocationGeocoder({ key: '', mode: 'off', fetchImpl: () => { calls++; } });
  assert.equal(disabled.provider, null);
  assert.equal(await disabled.address({ latitude: 0, longitude: 0 }), null); assert.equal(calls, 0);
  const enabled = new LocationGeocoder({ key: 'test-key', mode: '', fetchImpl: async url => { calls++; assert.equal(url.hostname, 'maps.googleapis.com'); return { ok: true, json: async () => ({ status: 'OK', results: [{ address_components: [
    { long_name: 'Rua de teste', types: ['route'] }, { long_name: '42', types: ['street_number'] }, { long_name: 'Centro', types: ['sublocality_level_1'] },
    { long_name: 'Vitória', types: ['administrative_area_level_2'] }, { long_name: 'Espírito Santo', short_name: 'ES', types: ['administrative_area_level_1'] },
    { long_name: '29000-000', types: ['postal_code'] }] }] }) }; } });
  assert.equal(enabled.provider, 'google', 'com chave, usa o Google');
  assert.equal(await enabled.address({ latitude: 0, longitude: 0 }), 'Rua de teste, 42 – Centro, Vitória – ES, CEP 29000-000');
  assert.equal(await enabled.address({ latitude: 0, longitude: 0 }), 'Rua de teste, 42 – Centro, Vitória – ES, CEP 29000-000', 'mesma posição: repete sem consultar');
  assert.equal(await enabled.address({ latitude: 1, longitude: 1 }), null, 'outra posição em menos de 10 s: espera o limite');
  assert.equal(calls, 1);
  const failed = new LocationGeocoder({ key: 'test-key', fetchImpl: async () => { throw Error('test-key'); } }); assert.equal(await failed.address({}), null);
});
test('OpenStreetMap é o padrão sem chave: identifica o app e monta o endereço completo', async () => {
  const requests = [];
  const osm = new LocationGeocoder({ key: '', mode: '', fetchImpl: async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => ({ address: { house_number: '1578', road: 'Avenida Paulista', suburb: 'Morro dos Ingleses', city: 'São Paulo', state: 'São Paulo', 'ISO3166-2-lvl4': 'BR-SP', postcode: '01310-200', country: 'Brasil' } }) };
  } });
  assert.equal(osm.provider, 'osm');
  assert.equal(await osm.address({ latitude: -23.561414, longitude: -46.655881 }), 'Avenida Paulista, 1578 – Morro dos Ingleses, São Paulo – SP, CEP 01310-200');
  assert.equal(requests[0].url.hostname, 'nominatim.openstreetmap.org');
  assert.equal(requests[0].url.searchParams.get('lat'), '-23.561414');
  assert.match(requests[0].options.headers['User-Agent'], /^echo-companion\//, 'o OpenStreetMap exige identificar o app');
  const missing = new LocationGeocoder({ key: '', fetchImpl: async () => ({ ok: true, json: async () => ({ error: 'Unable to geocode' }) }) });
  assert.equal(await missing.address({ latitude: 0, longitude: 0 }), null, 'sem endereço no mapa, não inventa');
  assert.equal(formatAddress({ district: 'Centro', city: 'Vitória', uf: 'ES' }), 'Centro, Vitória – ES', 'sem rua, começa pelo bairro');
});
test('resposta mostra o endereço completo, inclusive perto de um local cadastrado, com crédito do OpenStreetMap', async () => {
  const address = 'Rua Simulada, 10 – Centro, Vitória – ES, CEP 29000-000';
  const geocoder = { provider: 'osm', address: async () => address };
  const f = fixture({ geocoder });
  f.service.start('luna', 'phone'); f.service.update('luna', 'phone', f.position());
  const far = await f.service.lookup('luna');
  assert.match(far.reply, /^Luna está perto de Rua Simulada, 10 – Centro, Vitória – ES, CEP 29000-000 \(endereço aproximado\)\./);
  assert.match(far.card.detail2, /endereço © OpenStreetMap/);
  assert.equal(f.service.status('luna', 'phone').geocoding, 'osm');
  const link = 'https://waze.com/ul/h7h7mmdcj9';
  const home = fixture({ geocoder, memory: { getPreference: async () => JSON.stringify({ casa: { link } }) } });
  home.service.start('echo', 'phone'); home.service.update('echo', 'phone', home.position(geohashPoint(link)));
  assert.match((await home.service.lookup('echo')).reply, /perto de Casa \(Rua Simulada, 10 – Centro, Vitória – ES, CEP 29000-000\)\./);
  const google = fixture({ geocoder: { provider: 'google', address: async () => address } });
  google.service.start('luna', 'phone'); google.service.update('luna', 'phone', google.position());
  assert.doesNotMatch((await google.service.lookup('luna')).card.detail2, /OpenStreetMap/);
});
test('rotas isolam PINs, cookies e CSRF; consentimento e substituição são obrigatórios', async t => {
  const f = fixture(), app = express(); app.use(express.json());
  const pin = scope => (req, res, next) => req.headers['x-test-role'] === scope ? next() : res.sendStatus(401);
  const routes = createLocationRoutes({ service: f.service, requirePin: pin('echo'), requireLunaPin: pin('luna') });
  app.use('/api/location', routes.router);
  app.post('/voice/echo', pin('echo'), routes.converse('echo'), (req, res) => res.json({ source: 'gemini' }));
  app.post('/voice/luna', pin('luna'), routes.converse('luna'), (req, res) => res.json({ source: 'gemini' }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const root = 'http://127.0.0.1:' + server.address().port;
  const send = (scope, route, headers, body) => fetch(`${root}/api/location/${scope}/${route}`, { method: 'POST', headers, body: JSON.stringify(body) });
  async function session(scope) {
    const r = await fetch(`${root}/api/location/${scope}/status`, { headers: { 'x-test-role': scope } }); const data = await r.json();
    assert.equal(r.headers.get('cache-control'), 'no-store'); assert.equal(JSON.stringify(data).includes('latitude'), false);
    return { 'x-test-role': scope, 'x-location-csrf': data.csrf, Cookie: r.headers.get('set-cookie').split(';')[0], 'Content-Type': 'application/json' };
  }
  assert.equal((await fetch(root + '/api/location/echo/status')).status, 401);
  const echo = await session('echo'), echo2 = await session('echo'), luna = await session('luna');
  assert.equal((await send('echo', 'start', echo, {})).status, 400);
  assert.equal((await send('echo', 'start', { ...echo, 'x-location-csrf': 'é'.repeat(64) }, { consent: true })).status, 403);
  assert.equal((await send('echo', 'start', { ...echo, 'x-location-csrf': echo2['x-location-csrf'] }, { consent: true })).status, 403);
  assert.equal((await send('echo', 'start', echo, { consent: true })).status, 200);
  assert.equal((await send('echo', 'update', echo, f.position())).status, 200);
  assert.equal((await send('echo', 'update', luna, f.position())).status, 401);
  assert.equal((await send('luna', 'update', { ...luna, Cookie: echo.Cookie, 'x-location-csrf': echo['x-location-csrf'] }, f.position())).status, 403);
  assert.equal((await send('echo', 'update', echo2, f.position())).status, 400);
  assert.equal((await send('echo', 'start', echo2, { consent: true })).status, 400);
  assert.ok((await (await send('luna', 'query', luna, {})).json()).location);
  const voice = await fetch(root + '/voice/echo', { method: 'POST', headers: echo, body: JSON.stringify({ message: 'Onde a Luna está?' }) });
  assert.equal((await voice.json()).source, 'shared-location');
  const lunaVoice = await fetch(root + '/voice/luna', { method: 'POST', headers: luna, body: JSON.stringify({ message: 'Luna, onde o Echo está?' }) });
  assert.ok((await lunaVoice.json()).location, 'consulta por voz da Luna acessa somente o compartilhamento autorizado');
  assert.equal((await send('echo', 'stop', echo, { confirm: 'stop' })).status, 200);
  assert.equal((await (await send('luna', 'query', luna, {})).json()).location, undefined);
});
