const test = require('node:test');
const assert = require('node:assert/strict');
const { routeConversation, isCalendarIntent } = require('../src/conversationRouting');
test('consultas combinadas não viram saudação ou apenas CPU', () => {
  for (const message of ['Bom dia, confira tarefas do Forge e os backups', 'Qual a CPU e os serviços com problema?', 'Confira os posts agendados e as métricas do Instagram', 'Bom dia, confira o Forge']) {
    const route = routeConversation(message);
    assert.equal(route.orchestrate, true, message);
    assert.equal(route.compound, true, message);
  }
  assert.equal(routeConversation('Qual a CPU?').compound, false);
  assert.equal(routeConversation('Bom dia').orchestrate, false);
  assert.deepEqual(routeConversation('Confira tarefas do Forge e backups').requiredTools, ['consultar_tarefas_forge', 'consultar_status_backup_forge']);
  assert.equal(routeConversation('Confira o Forge e backups', false).orchestrate, false);
});
test('tarefas do Forge não exigem sessão da agenda; agenda e ações mantêm fluxo dedicado', () => {
  assert.equal(isCalendarIntent('Veja as tarefas do Forge'), false);
  assert.equal(isCalendarIntent('Quais as tarefas de hoje?'), true);
  assert.equal(isCalendarIntent('Confira as tarefas de backup e os serviços'), false);
  for (const message of ['Veja Forge e minha agenda', 'Veja reuniões e o Forge', 'Crie tarefa no Forge', 'Esqueça meu projeto Forge', 'Lembre projeto: Echo', 'Abra Waze e veja os backups', 'Confira meu saldo e o Forge']) {
    assert.equal(routeConversation(message).orchestrate, false, message);
  }
});

// Executa o handler real isolado dos serviços que server.js inicializa no topo.
function serverHandler({ enabled = true, modelParts } = {}) {
  const fs = require('node:fs'), vm = require('node:vm');
  const { EventEmitter } = require('node:events');
  const source = fs.readFileSync(require.resolve('../server'), 'utf8');
  const start = source.indexOf("app.post('/api/converse'");
  const end = source.indexOf('// Endpoint exclusivo de Conversação da Luna', start);
  const executions = [], saved = [];
  let handler, turn = 0;
  const memory = { handleMemoryCommand: () => null, isPersonalMemoryQuery: () => false,
    conversationContext: async () => ({ history: [], facts: [], summaries: [] }),
    isContextCurrent: () => true, addMessage: async (role, text) => saved.push({ role, text }), recordTurn: (message, text) => saved.push({ role: 'turn', text }) };
  const policy = require('../src/toolPolicy').createToolPolicy(['consultar_projetos_forge', 'consultar_status_backup_forge'].map(name => ({ name, parameters: { properties: {} } })));
  const context = {
    app: { post: (url, ...handlers) => { handler = handlers.at(-1); } }, requirePin: () => {},
    locationRoutes: { converse: () => () => {} }, calendarRoutes: { converse: () => {}, handleTool: () => { throw new Error('Agenda indevida'); } },
    navigation: { createNavigationMiddleware: () => () => {} },
    memory, tools: { readPolicy: policy, functionDeclarations: policy.declarations, executeTool: async name => { executions.push(name); return { ok: true, total_projetos: 2, projetos: [] }; } },
    cards: require('../src/cards'), conversationConfig: { timeoutMs: 25000 },
    routeConversation: message => routeConversation(message, enabled), isCalendarIntent,
    runConversation: require('../src/conversation').runConversation,
    prepareContext: require('../src/conversation').prepareContext,
    createGeminiProvider: () => async () => ({ role: 'model', parts: ++turn === 1 ? modelParts || [
      { functionCall: { name: 'consultar_projetos_forge', args: {}, id: 'a' } },
      { functionCall: { name: 'consultar_status_backup_forge', args: {}, id: 'b' } }
    ] : [{ text: 'Consultei as fontes solicitadas.' }] }),
    GEMINI_API_KEY: 'TEST', echoState: { telemetry: { available: false } },
    pcMonitorQueries: { parseQuery: () => null }, pcMonitor: {}, briefing: {},
    broadcastState: () => {}, broadcastEvent: () => {}, AbortController,
    console: { log: () => {}, warn: () => {} }
  };
  vm.runInNewContext(source.slice(start, end), context);
  const res = new EventEmitter();
  res.json = value => { res.body = value; return value; };
  res.status = code => { res.statusCode = code; return res; };
  return { run: async message => { await handler({ body: { message } }, res); return res.body; }, executions, saved, context };
}

test('handler real: saudação composta consulta ambas as fontes e grava resposta final', async () => {
  const fixture = serverHandler();
  const response = await fixture.run('Bom dia, confira o Forge e os backups');
  assert.equal(response.source, 'gemini-multi-step');
  assert.equal(response.partial, false);
  assert.equal(response.card.rows.length, 2);
  assert.deepEqual(fixture.executions, ['consultar_projetos_forge', 'consultar_status_backup_forge']);
  assert.equal(fixture.saved.at(-1).text, response.reply);
});
test('handler real: opção desativada conserva saudação antiga', async () => {
  const fixture = serverHandler({ enabled: false });
  assert.equal((await fixture.run('Bom dia, confira Forge e backups')).source, 'fast-local');
  assert.equal(fixture.executions.length, 0);
});
test('handler real: saudação com uma consulta não esconde a consulta', async () => {
  const fixture = serverHandler();
  assert.equal((await fixture.run('Bom dia, confira o Forge')).source, 'gemini-multi-step');
});
test('handler real: aviso concreto no cartão prevalece sobre síntese otimista', async () => {
  const fixture = serverHandler();
  const result = await fixture.run('Confira Forge e backups');
  assert.match(result.reply, /atenção/i);
  assert.match(result.reply, /Última execução/i);
});
test('handler real: rejeita mensagem inválida e indisponibilidade não vira confirmação', async () => {
  const fixture = serverHandler();
  assert.ok((await fixture.run({})).error);
  fixture.context.GEMINI_API_KEY = '';
  const result = await fixture.run('Confira Forge e backups');
  assert.equal(result.ok, false);
  assert.equal(result.partial, true);
});

test('handler real: memória invalidada não reinsere a pergunta no histórico', async () => {
  const fixture = serverHandler();
  fixture.context.memory.isContextCurrent = () => false;
  const result = await fixture.run('Confira Forge e backups');
  assert.match(result.reply, /memória foi atualizada/i);
  assert.equal(fixture.saved.length, 0);
});
test('handler real: preparação pendente também respeita o prazo', async () => {
  const fixture = serverHandler();
  fixture.context.conversationConfig.timeoutMs = 20;
  fixture.context.memory.conversationContext = () => new Promise(() => {});
  const result = await Promise.race([fixture.run('Confira Forge e backups'), new Promise(resolve => setTimeout(() => resolve({ hung: true }), 150))]);
  assert.equal(result.hung, undefined);
  assert.equal(result.partial, true);
  assert.equal(fixture.saved.length, 0);
});
