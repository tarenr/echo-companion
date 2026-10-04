const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const express = require('express');
const { CalendarStore } = require('../src/calendarStore');
const { CalendarAuth, SCOPE } = require('../src/calendarAuth');
const { CalendarService, eventData, range } = require('../src/calendarService');
const { createCalendarRoutes } = require('../src/calendarRoutes');
const { GoogleCalendar } = require('../src/connectors/googleCalendar');

const event = { summary: 'Consulta', start: { dateTime: '2026-10-10T14:00:00-03:00' }, end: { dateTime: '2026-10-10T15:00:00-03:00' } };
function memoryStore() {
  let state = {};
  return { read: () => structuredClone(state), update: fn => { const copy = structuredClone(state); fn(copy); state = copy; } };
}
function fixture() {
  const store = memoryStore();
  const auth = { epoch: 0, status: () => ({ connected: true, configured: true }), getStore: () => store, disconnect: async () => { auth.epoch++; return { revoked: true }; } };
  const calls = [];
  const existing = { ...structuredClone(event), id: 'abc123', etag: 'v1', organizer: { self: true } };
  const api = { list: async () => [structuredClone(existing)], get: async () => structuredClone(existing),
    create: async data => { calls.push(['create', data]); return data; },
    update: async (id, data, etag) => { calls.push(['update', id, data, etag]); return data; },
    delete: async (id, etag) => { calls.push(['delete', id, etag]); } };
  let now = Date.now();
  const service = new CalendarService({ auth, api, now: () => now });
  return { service, store, api, calls, auth, existing, advance: amount => { now += amount; } };
}

test('store cifra tokens e snapshots, autentica conteúdo e preserva arquivo corrompido', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-calendar-test-'));
  try {
    const file = path.join(directory, 'secure.json');
    const store = new CalendarStore({ key: crypto.randomBytes(32).toString('base64'), file });
    store.update(data => { data.tokens = { refresh_token: 'TEST_SECRET_ONLY' }; data.recovery = { event: 'PRIVATE_EVENT_TEST' }; });
    const raw = fs.readFileSync(file, 'utf8');
    assert.equal(raw.includes('TEST_SECRET_ONLY'), false);
    assert.equal(raw.includes('PRIVATE_EVENT_TEST'), false);
    assert.equal(store.read().tokens.refresh_token, 'TEST_SECRET_ONLY');
    const modified = JSON.parse(raw); modified.tag = crypto.randomBytes(16).toString('base64');
    fs.writeFileSync(file, JSON.stringify(modified));
    const before = fs.readFileSync(file, 'utf8');
    assert.throws(() => store.update(() => {}), /armazenamento seguro/);
    assert.equal(fs.readFileSync(file, 'utf8'), before);
    assert.throws(() => new CalendarStore({ key: 'invalid', file }), /Chave/);
  } finally {
    const resolved = path.resolve(directory);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('echo-calendar-test-'));
    fs.rmSync(resolved, { recursive: true });
  }
});

function authFixture() {
  const store = memoryStore();
  const env = { GOOGLE_CALENDAR_CLIENT_ID: 'test-client', GOOGLE_CALENDAR_CLIENT_SECRET: 'test-secret', GOOGLE_CALENDAR_REDIRECT_URI: 'https://echo.test/api/calendar/oauth/callback', GOOGLE_CALENDAR_ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64') };
  const clients = [];
  const factory = () => {
    const client = new EventEmitter();
    client.generateCodeVerifierAsync = async () => ({ codeVerifier: 'TEST_VERIFIER', codeChallenge: 'TEST_CHALLENGE' });
    client.generateAuthUrl = options => { client.options = options; return 'https://accounts.google.com/o/oauth2/v2/auth?state=' + options.state; };
    client.getToken = async args => { client.exchange = args; return { tokens: { refresh_token: 'TEST_REFRESH', access_token: 'TEST_ACCESS' } }; };
    client.getTokenInfo = async () => ({ scopes: [SCOPE] });
    client.setCredentials = credentials => { client.credentials = credentials; };
    client.revokeToken = async () => {};
    clients.push(client); return client;
  };
  return { auth: new CalendarAuth({ env, store, clientFactory: factory }), store, clients, env };
}
test('OAuth usa state, PKCE, acesso offline e restringe retorno ao mesmo dispositivo', async () => {
  const { auth, clients, store } = authFixture();
  const url = new URL(await auth.start('device1'));
  const state = url.searchParams.get('state');
  assert.equal(clients[0].options.code_challenge_method, 'S256');
  assert.equal(clients[0].options.access_type, 'offline');
  assert.deepEqual(clients[0].options.scope, [SCOPE]);
  await assert.rejects(auth.callback('device2', { state, code: 'TEST_CODE' }), /outro dispositivo/);
  await auth.callback('device1', { state, code: 'TEST_CODE' });
  assert.equal(clients.at(-1).exchange.codeVerifier, 'TEST_VERIFIER');
  assert.equal(store.read().tokens.refresh_token, 'TEST_REFRESH');
  await assert.rejects(auth.callback('device1', { state, code: 'TEST_CODE' }), /expirada/);
});
test('OAuth rejeita permissão ausente, state expirado e URI insegura', async () => {
  const { auth, clients, env } = authFixture();
  let state = new URL(await auth.start('device1')).searchParams.get('state');
  auth.states.get(state).expires = 0;
  await assert.rejects(auth.callback('device1', { state, code: 'TEST_CODE' }));
  auth.clientFactory = () => { const client = clients[0]; client.getTokenInfo = async () => ({ scopes: [] }); return client; };
  state = new URL(await auth.start('device1')).searchParams.get('state');
  await assert.rejects(auth.callback('device1', { state, code: 'TEST_CODE' }), /permissão/);
  env.GOOGLE_CALENDAR_REDIRECT_URI = 'http://external.test/api/calendar/oauth/callback';
  assert.equal(auth.configured(), false);
});
test('refresh preserva refresh_token e não restaura acesso após desconexão', async () => {
  const { auth, store, clients } = authFixture();
  store.update(data => { data.tokens = { refresh_token: 'TEST_REFRESH', access_token: 'old' }; data.accountId = 'account1'; });
  const client = auth.client();
  client.emit('tokens', { access_token: 'renewed' });
  assert.equal(store.read().tokens.refresh_token, 'TEST_REFRESH');
  clients.at(-1).revokeToken = async () => { throw new Error('offline'); };
  await auth.disconnect();
  client.emit('tokens', { access_token: 'late' });
  assert.equal(store.read().tokens, undefined);
});
test('validação rejeita datas impossíveis, fim anterior, convidados e lembretes por email', () => {
  assert.throws(() => eventData({ ...event, start: { dateTime: '2026-02-30T10:00:00' } }));
  assert.throws(() => eventData({ ...event, end: { dateTime: '2026-10-10T13:00:00' } }));
  assert.throws(() => eventData({ ...event, attendees: [{ email: 'nobody@example.test' }] }));
  assert.throws(() => eventData({ ...event, reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 10 }] } }));
  assert.throws(() => range({ timeMin: '2026-10-10T10:00:00', timeMax: '2026-10-09T10:00:00' }));
  assert.equal(eventData({ ...event, start: { dateTime: '2026-10-10T14:00' } }).start.dateTime, '2026-10-10T14:00:00-03:00');
});
test('dia inteiro e recorrência têm validação e fim exclusivo', () => {
  const allDay = { summary: 'Folga', start: { date: '2026-10-10' }, end: { date: '2026-10-11' }, recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=SA;COUNT=4'] };
  assert.deepEqual(eventData(allDay), allDay);
  assert.throws(() => eventData({ ...allDay, end: { date: '2026-10-10' } }));
  assert.throws(() => eventData({ ...allDay, recurrence: ['RRULE:FREQ=WEEKLY;COUNT=3;UNTIL=20261201'] }));
  assert.throws(() => eventData({ ...allDay, recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=BAD'] }));
});
test('criação só escreve após confirmação, bloqueia outro dispositivo e confirma apenas uma vez', async () => {
  const { service, calls } = fixture();
  const draft = await service.prepare('device1', { action: 'create', event });
  assert.equal(calls.length, 0);
  await assert.rejects(service.confirm('device2', draft.confirmation.id), /inválida/);
  const saved = await service.confirm('device1', draft.confirmation.id);
  assert.match(saved.reply, /criado/);
  await service.confirm('device1', draft.confirmation.id);
  assert.equal(calls.length, 1);
  assert.match(calls[0][1].id, /^[a-f0-9]{40}$/);
});
test('cancelamento, expiração e mudança da conta impedem escrita', async () => {
  const { service, calls, auth, advance } = fixture();
  let draft = await service.prepare('device1', { action: 'create', event });
  service.cancel('device1', draft.confirmation.id);
  await assert.rejects(service.confirm('device1', draft.confirmation.id));
  draft = await service.prepare('device1', { action: 'create', event });
  advance(11 * 60000);
  await assert.rejects(service.confirm('device1', draft.confirmation.id));
  draft = await service.prepare('device1', { action: 'create', event });
  auth.epoch++;
  await assert.rejects(service.confirm('device1', draft.confirmation.id));
  assert.equal(calls.length, 0);
});
test('resposta perdida na criação reutiliza ID e reconhece evento existente', async () => {
  const { service, api } = fixture();
  let created, count = 0;
  api.create = async data => { count++; if (!created) { created = data; throw new Error('network'); } assert.equal(data.id, created.id); throw Object.assign(new Error('duplicate'), { code: 409 }); };
  api.get = async () => created;
  const draft = await service.prepare('device1', { action: 'create', event });
  await assert.rejects(service.confirm('device1', draft.confirmation.id));
  const result = await service.confirm('device1', draft.confirmation.id);
  assert.match(result.reply, /criado/);
  assert.equal(count, 2);
});
test('edição e exclusão usam ETag e salvam cópia de recuperação antes da mutação', async () => {
  const { service, calls, store, api } = fixture();
  await service.list('device1', {});
  let draft = await service.prepare('device1', { action: 'update', eventId: 'abc123', event: { summary: 'Consulta nova' } });
  await service.confirm('device1', draft.confirmation.id);
  assert.equal(calls[0][3], 'v1');
  assert.equal(store.read().recovery[draft.confirmation.id].event.summary, 'Consulta');
  api.delete = async (id, etag) => { assert.equal(store.read().recovery[draft.confirmation.id].action, 'delete'); calls.push(['delete', id, etag]); };
  draft = await service.prepare('device1', { action: 'delete', eventId: 'abc123' });
  await service.confirm('device1', draft.confirmation.id);
  assert.deepEqual(calls[1], ['delete', 'abc123', 'v1']);
});
test('mudança concorrente exige nova consulta, sem repetir edição', async () => {
  const { service, api } = fixture();
  await service.list('device1', {});
  const draft = await service.prepare('device1', { action: 'update', eventId: 'abc123', event: { summary: 'Novo' } });
  api.update = async () => { throw Object.assign(new Error('changed'), { code: 412 }); };
  await assert.rejects(service.confirm('device1', draft.confirmation.id), /mudou/);
  await assert.rejects(service.confirm('device1', draft.confirmation.id), /inválida/);
});
test('busca ambígua não escreve e permite escolher por número', async () => {
  const { service, api, existing, calls } = fixture();
  api.list = async () => [existing, { ...existing, id: 'def456', summary: 'Consulta segunda' }];
  api.get = async id => ({ ...existing, id });
  const result = await service.prepare('device1', { action: 'delete', q: 'Consulta', timeMin: '2026-10-01T00:00:00', timeMax: '2026-11-01T00:00:00' });
  assert.equal(result.confirmation, undefined);
  const draft = await service.select('device1', 2);
  await service.confirm('device1', draft.confirmation.id);
  assert.equal(calls[0][1], 'def456');
});
test('recorrência exige alcance explícito e distingue ocorrência da série', async () => {
  const { service, api, existing, calls } = fixture();
  const instance = { ...existing, recurringEventId: 'series123' };
  api.list = async () => [instance];
  api.get = async id => id === 'series123' ? { ...existing, id, recurrence: ['RRULE:FREQ=WEEKLY'] } : instance;
  await service.list('device1', {});
  const question = await service.prepare('device1', { action: 'delete', eventId: instance.id });
  assert.equal(question.confirmation, undefined);
  let draft = await service.chooseScope('device1', 'series');
  assert.match(draft.reply, /série inteira/);
  await service.confirm('device1', draft.confirmation.id);
  assert.equal(calls[0][1], 'series123');
  draft = await service.prepare('device1', { action: 'delete', eventId: instance.id, scope: 'occurrence' });
  await service.confirm('device1', draft.confirmation.id);
  assert.equal(calls[1][1], instance.id);
});
test('convidados, evento de outra pessoa e IDs não consultados são bloqueados', async () => {
  const { service, api, existing } = fixture();
  await assert.rejects(service.prepare('device1', { action: 'delete', eventId: 'unknown' }), /Consulte/);
  await service.list('device1', {});
  api.get = async () => ({ ...existing, organizer: { self: false } });
  await assert.rejects(service.prepare('device1', { action: 'delete', eventId: existing.id }), /organiza/);
  api.get = async () => ({ ...existing, attendees: [{ email: 'test@example.test' }] });
  await assert.rejects(service.prepare('device1', { action: 'delete', eventId: existing.id }), /convidados/);
});
test('conector fixa agenda primary, pagina consultas e usa If-Match sem retries', async () => {
  const calls = [];
  const api = new GoogleCalendar({ client: () => ({ request: async options => { calls.push(options); return { data: calls.length === 1 ? { items: [], nextPageToken: 'next' } : { items: [] } }; } }) });
  await api.list({ timeMin: '2026-10-01T00:00:00Z', timeMax: '2026-11-01T00:00:00Z' });
  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /calendars\/primary\/events/);
  assert.match(calls[1].url, /pageToken=next/);
  await api.delete('abc123', 'v1');
  assert.equal(calls[2].headers['If-Match'], 'v1');
  assert.equal(calls[2].retry, false);
});

test('autorização revogada sinaliza reconexão e invalida propostas', async () => {
  const { auth, store } = authFixture();
  store.update(data => { data.tokens = { refresh_token: 'TEST_REFRESH' }; data.accountId = 'account1'; });
  auth.client = () => ({ request: async () => { throw Object.assign(new Error('expired'), { response: { status: 401 } }); } });
  const api = new GoogleCalendar(auth);
  await assert.rejects(api.get('abc123'));
  assert.equal(auth.status().connected, false);
  assert.equal(auth.status().reconnectRequired, true);
  assert.equal(auth.epoch, 1);
});

test('confirmações concorrentes não duplicam escrita e rascunho novo invalida o anterior', async () => {
  const { service, api, calls } = fixture();
  let release;
  api.create = data => new Promise(resolve => { release = () => { calls.push(['create', data]); resolve(data); }; });
  let draft = await service.prepare('device1', { action: 'create', event });
  const result = service.confirm('device1', draft.confirmation.id);
  await assert.rejects(service.confirm('device1', draft.confirmation.id), /andamento/);
  await new Promise(resolve => setImmediate(resolve)); release(); await result;
  assert.equal(calls.length, 1);
  const old = draft.confirmation.id;
  draft = await service.prepare('device1', { action: 'create', event: { ...event, summary: 'Outro' } });
  await assert.rejects(service.confirm('device1', old));
  service.cancel('device1', draft.confirmation.id);
});

test('rotas protegem PIN, sessão e CSRF; confirmação não pode cruzar dispositivos', async t => {
  const { auth } = authFixture();
  const context = fixture();
  const app = express(); app.use(express.json());
  const routes = createCalendarRoutes({ auth, service: context.service, requirePin: (req, res, next) => req.headers['x-test-pin'] === 'test' ? next() : res.sendStatus(401) });
  app.use('/api/calendar', routes.router);
  app.post('/api/converse', routes.converse, (req, res) => res.json({ source: 'fallback' }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const root = 'http://127.0.0.1:' + server.address().port + '/api/calendar';
  assert.equal((await fetch(root + '/status')).status, 401);
  async function session() {
    const result = await fetch(root + '/status', { headers: { 'x-test-pin': 'test' } });
    const body = await result.json();
    return { 'x-test-pin': 'test', 'x-agenda-csrf': body.csrf, Cookie: result.headers.get('set-cookie').split(';')[0], 'Content-Type': 'application/json' };
  }
  const headers1 = await session(), headers2 = await session();
  const draft = await (await fetch(root + '/draft', { method: 'POST', headers: headers1, body: JSON.stringify({ action: 'create', event }) })).json();
  assert.equal((await fetch(root + '/confirm', { method: 'POST', headers: headers2, body: JSON.stringify({ id: draft.confirmation.id }) })).status, 400);
  assert.equal((await fetch(root + '/confirm', { method: 'POST', headers: { ...headers1, 'x-agenda-csrf': 'wrong' }, body: JSON.stringify({ id: draft.confirmation.id }) })).status, 403);
  const good = await fetch(root + '/confirm', { method: 'POST', headers: headers1, body: JSON.stringify({ id: draft.confirmation.id }) });
  assert.equal(good.status, 200);
  assert.equal(context.calls.length, 1);
  const next = await (await fetch(root + '/draft', { method: 'POST', headers: headers1, body: JSON.stringify({ action: 'create', event }) })).json();
  const voiceRoot = root.replace('/api/calendar', '/api/converse');
  const voice = await fetch(voiceRoot, { method: 'POST', headers: headers1, body: JSON.stringify({ message: 'confirmar agenda', calendarConfirmation: next.confirmation.id }) });
  assert.equal(voice.status, 200);
  assert.equal(context.calls.length, 2);
  assert.equal((await fetch(root + '/confirm', { method: 'POST', headers: { ...headers1, 'x-agenda-csrf': 'é'.repeat(64) }, body: '{}' })).status, 403);
  context.api.create = async () => { throw new Error('network'); };
  const retryDraft = await (await fetch(root + '/draft', { method: 'POST', headers: headers1, body: JSON.stringify({ action: 'create', event }) })).json();
  const failed = await fetch(root + '/confirm', { method: 'POST', headers: headers1, body: JSON.stringify({ id: retryDraft.confirmation.id }) });
  assert.equal(failed.status, 400);
  assert.equal((await failed.json()).confirmation.id, retryDraft.confirmation.id);
});
