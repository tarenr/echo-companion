// Modo celular: pedidos em memória e hook de aprovação contra um servidor falso (sem o Echo real).
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const {
  ApprovalStore, summarizeTool, normalizeQuestions, buildPushPayload
} = require('../src/approvals');

const QUESTION_INPUT = {
  questions: [
    { question: 'Qual banco usar?', header: 'Banco', multiSelect: false, options: [{ label: 'SQLite', description: 'local' }, { label: 'MySQL', description: '' }] },
    { question: 'Quais testes?', header: 'Testes', multiSelect: true, options: [{ label: 'Unitários' }, { label: 'Navegador' }] }
  ]
};

function storeWithClock(start = 1000) {
  const clock = { now: start };
  let n = 0;
  const store = new ApprovalStore({ now: () => clock.now, randomId: () => `id-${++n}` });
  return { store, clock };
}

test('pedido aceita uma única resposta e quem espera recebe a decisão', async () => {
  const { store } = storeWithClock();
  const item = store.create({ kind: 'permission', summary: 'Bash: npm run', project: 'echo' });
  const waiting = store.wait(item.id, 5000);
  assert.equal(store.list().length, 1);
  assert.equal(store.resolve(item.id, { action: 'allow' }).ok, true);
  assert.deepEqual(await waiting, { outcome: 'allow' });
  assert.deepEqual(store.resolve(item.id, { action: 'deny' }), { ok: false, reason: 'not_pending' });
  assert.equal(store.list().length, 0);
});

test('prazo vencido: pedido expira e resposta atrasada é recusada', async () => {
  const { store } = storeWithClock();
  const item = store.create({ kind: 'permission', summary: 'Edit app.js' });
  assert.deepEqual(await store.wait(item.id, 20), { outcome: 'expired' });
  assert.deepEqual(store.resolve(item.id, { action: 'allow' }), { ok: false, reason: 'not_pending' });
});

test('pedido passado da validade não aceita resposta mesmo sem ninguém esperando', () => {
  const { store, clock } = storeWithClock();
  const item = store.create({ kind: 'permission', summary: 'x' });
  clock.now += 121 * 1000;
  assert.deepEqual(store.resolve(item.id, { action: 'allow' }), { ok: false, reason: 'not_pending' });
  assert.equal(store.list().length, 0);
});

test('dois pedidos ao mesmo tempo são independentes', async () => {
  const { store } = storeWithClock();
  const a = store.create({ kind: 'permission', summary: 'A' });
  const b = store.create({ kind: 'permission', summary: 'B' });
  const waitA = store.wait(a.id, 5000);
  const waitB = store.wait(b.id, 5000);
  store.resolve(b.id, { action: 'deny' });
  store.resolve(a.id, { action: 'allow' });
  assert.deepEqual(await waitA, { outcome: 'allow' });
  assert.deepEqual(await waitB, { outcome: 'deny' });
});

test('ação inválida para o tipo de pedido é recusada; cancelado não aceita resposta', () => {
  const { store } = storeWithClock();
  const item = store.create({ kind: 'permission', summary: 'x' });
  assert.equal(store.resolve(item.id, { action: 'answer' }).reason, 'invalid_action');
  store.cancel(item.id);
  assert.equal(store.resolve(item.id, { action: 'allow' }).reason, 'not_pending');
});

test('perguntas: só opções existentes; multi-seleção vira lista', async () => {
  const { store } = storeWithClock();
  const questions = normalizeQuestions(QUESTION_INPUT);
  const item = store.create({ kind: 'question', summary: 'Banco', questions });
  assert.equal(store.resolve(item.id, { action: 'answer', answers: { 'Qual banco usar?': 'Postgres', 'Quais testes?': ['Unitários'] } }).reason, 'invalid_answers');
  assert.equal(store.resolve(item.id, { action: 'answer', answers: { 'Qual banco usar?': 'SQLite', 'Quais testes?': 'Unitários' } }).reason, 'invalid_answers');
  const waiting = store.wait(item.id, 5000);
  assert.equal(store.resolve(item.id, { action: 'answer', answers: { 'Qual banco usar?': 'SQLite', 'Quais testes?': ['Navegador', 'Unitários', 'Inventado'] } }).ok, true);
  assert.deepEqual(await waiting, { outcome: 'answer', answers: { 'Qual banco usar?': 'SQLite', 'Quais testes?': ['Navegador', 'Unitários'] } });
});

test('normalizeQuestions aceita opções em texto e o campo prompt', () => {
  const q = normalizeQuestions({ questions: [{ prompt: 'Seguir?', options: ['Sim', 'Não'] }, { question: 'Sem opções', options: [] }] });
  assert.equal(q.length, 1);
  assert.equal(q[0].question, 'Seguir?');
  assert.deepEqual(q[0].options.map(o => o.label), ['Sim', 'Não']);
});

test('resumo e notificação nunca levam o comando inteiro nem o caminho', () => {
  assert.equal(summarizeTool('Bash', { command: 'cd /x && TOKEN=segredo123 curl https://api' }), 'Bash: TOKEN=*** curl');
  assert.equal(summarizeTool('Edit', { file_path: 'C:/Users/WINDOWS/Projects/echo-companion/server.js' }), 'Edit server.js');
  const payload = buildPushPayload({ id: 'abc', kind: 'permission', project: 'echo-companion', summary: 'Bash: rm -rf' });
  const json = JSON.stringify(payload);
  assert.equal(json.includes('rm'), false);
  assert.equal(json.includes('Bash'), false);
  assert.equal(payload.body, 'Projeto: echo-companion');
  assert.equal(buildPushPayload({ id: 'q', kind: 'question', project: '' }).title, 'Claude Code fez uma pergunta');
});

// ---------- Hook contra um servidor falso ----------

function fakeServer(handler) {
  return new Promise(resolve => {
    const received = [];
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', c => { body += c; });
      req.on('end', () => {
        received.push({ path: req.url, body: body ? JSON.parse(body) : null });
        handler(req, res);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, received }));
  });
}

function runHook(port, kind, payload) {
  return new Promise(resolve => {
    const t0 = Date.now();
    const child = spawn(process.execPath, [path.join(__dirname, '../bin/approval-hook.js'), '--kind', kind], {
      env: { ...process.env, ECHO_PORT: String(port) }
    });
    let out = '';
    child.stdout.on('data', c => { out += c; });
    child.on('exit', code => resolve({ code, out, ms: Date.now() - t0 }));
    child.stdin.end(JSON.stringify(payload));
  });
}

const PERMISSION_PAYLOAD = { hook_event_name: 'PermissionRequest', session_id: 's1', cwd: 'C:/p/echo-companion', tool_name: 'Bash', tool_input: { command: 'npm run deploy' } };

test('hook: decisão "allow" do celular vira a saída de permissão do Claude Code', async () => {
  const { server, port, received } = await fakeServer((req, res) => res.end(JSON.stringify({ decision: 'allow' })));
  const r = await runHook(port, 'permission', PERMISSION_PAYLOAD);
  server.close();
  assert.equal(r.code, 0);
  assert.deepEqual(JSON.parse(r.out), { hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow' } } });
  assert.equal(received[0].path, '/api/approvals/request');
  assert.equal(received[0].body.kind, 'permission');
});

test('hook: "deny" nega com mensagem', async () => {
  const { server, port } = await fakeServer((req, res) => res.end(JSON.stringify({ decision: 'deny' })));
  const r = await runHook(port, 'permission', PERMISSION_PAYLOAD);
  server.close();
  assert.equal(JSON.parse(r.out).hookSpecificOutput.decision.behavior, 'deny');
});

test('hook: sem decisão (modo desligado) sai rápido e sem saída', async () => {
  const { server, port } = await fakeServer((req, res) => res.end(JSON.stringify({ decision: null, reason: 'modo_desligado' })));
  const r = await runHook(port, 'permission', PERMISSION_PAYLOAD);
  server.close();
  assert.equal(r.code, 0);
  assert.equal(r.out, '');
  assert.ok(r.ms < 1500, `levou ${r.ms} ms`);
});

test('hook: Echo desligado (porta fechada) sai rápido e sem saída', async () => {
  const { server, port } = await fakeServer(() => {});
  await new Promise(r => server.close(r));
  const r = await runHook(port, 'permission', PERMISSION_PAYLOAD);
  assert.equal(r.code, 0);
  assert.equal(r.out, '');
  assert.ok(r.ms < 1500, `levou ${r.ms} ms`);
});

test('hook: resposta inesperada do servidor nunca vira liberação', async () => {
  const { server, port } = await fakeServer((req, res) => res.end(JSON.stringify({ decision: 'answer', answers: { x: 'y' } })));
  const r = await runHook(port, 'permission', PERMISSION_PAYLOAD);
  server.close();
  assert.equal(r.out, '');
});

test('hook de pergunta: ignora outras ferramentas e devolve as respostas no updatedInput', async () => {
  const answers = { 'Qual banco usar?': 'SQLite', 'Quais testes?': ['Unitários'] };
  const { server, port, received } = await fakeServer((req, res) => res.end(JSON.stringify({ decision: 'answer', answers })));
  const other = await runHook(port, 'question', { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'ls' } });
  assert.equal(other.out, '');
  assert.equal(received.length, 0);
  const r = await runHook(port, 'question', { hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', tool_input: QUESTION_INPUT, cwd: 'C:/p/echo' });
  server.close();
  const out = JSON.parse(r.out).hookSpecificOutput;
  assert.equal(out.hookEventName, 'PreToolUse');
  assert.equal(out.permissionDecision, 'allow');
  assert.deepEqual(out.updatedInput.answers, answers);
  assert.deepEqual(out.updatedInput.questions, QUESTION_INPUT.questions);
});
