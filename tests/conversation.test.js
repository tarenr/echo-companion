const test = require('node:test');
const assert = require('node:assert/strict');
const { runConversation } = require('../src/conversation');
const { createToolPolicy } = require('../src/toolPolicy');
const policy = createToolPolicy(['consultar_projetos_forge', 'consultar_status_backup_forge'].map(name => ({ name, parameters: { type: 'OBJECT', properties: {} } })));
const call = (name, id) => ({ functionCall: { name, args: {}, id } });
const content = parts => ({ role: 'model', parts });
const base = { message: 'Confira Forge e backups', policy, executeTool: async () => ({ ok: true, total: 2 }) };
test('múltiplas chamadas preservam correlação e assinatura e reutilizam resultado', async () => {
  let turn = 0; const seen = []; const executed = [];
  const first = content([{ ...call('consultar_projetos_forge', 'one'), thoughtSignature: 'TEST' }, call('consultar_status_backup_forge', 'two')]);
  const result = await runConversation({ ...base, executeTool: async name => { executed.push(name); return { ok: true, total: 2 }; }, provider: async input => {
    seen.push(structuredClone(input)); turn++;
    return turn === 1 ? first : turn === 2 ? content([call('consultar_projetos_forge', 'three')]) : content([{ text: 'Consultei os dois sistemas.' }]);
  } });
  assert.equal(result.partial, false);
  assert.equal(executed.length, 2);
  assert.deepEqual(seen[1].contents[1], first);
  assert.deepEqual(seen[1].contents[2].parts.map(p => p.functionResponse.id), ['one', 'two']);
  assert.equal(seen[2].contents.at(-1).parts[0].functionResponse.id, 'three');
});
test('ferramenta proibida é recusada e falha parcial aparece mesmo se modelo omitir', async () => {
  let turn = 0; const executed = [];
  const result = await runConversation({ ...base, executeTool: async name => { executed.push(name); return { ok: false, erro: 'offline' }; }, provider: async () => ++turn === 1 ? content([call('abrir_waze', 'x'), call('consultar_projetos_forge', 'y')]) : content([{ text: 'Tudo certo.' }]) });
  assert.deepEqual(executed, ['consultar_projetos_forge']);
  assert.equal(result.partial, true);
  assert.match(result.reply, /incompleta|indisponível/i);
});
test('limites de rodadas e execuções encerram o ciclo', async () => {
  let count = 0;
  const result = await runConversation({ ...base, limits: { maxRounds: 2, maxExecutions: 1 }, executeTool: async () => { count++; return { ok: true }; }, provider: async () => content([call('consultar_projetos_forge', 'a'), call('consultar_status_backup_forge', 'b')]) });
  assert.equal(count, 1);
  assert.equal(result.partial, true);
  assert.ok(result.metrics.providerCalls <= 3);
});
test('prazo encerra ferramenta pendente e ignora resultado tardio', async () => {
  let release; let calls = 0;
  const result = await runConversation({ ...base, limits: { timeoutMs: 25 }, executeTool: () => new Promise(resolve => { release = resolve; }), provider: async () => { calls++; return content([call('consultar_projetos_forge', 'a')]); } });
  assert.equal(result.reason, 'timeout');
  assert.equal(result.partial, true);
  release({ ok: true, PRIVATE: 'late' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1);
  assert.equal(JSON.stringify(result).includes('late'), false);
});
test('mudança de memória interrompe o ciclo e remove resultados', async () => {
  let current = true;
  const result = await runConversation({ ...base, isCurrent: () => current, provider: async () => content([call('consultar_projetos_forge', 'a')]), executeTool: async () => { current = false; return { ok: true, private: 'old' }; } });
  assert.equal(result.reason, 'context_changed');
  assert.deepEqual(result.results, []);
  assert.equal(JSON.stringify(result).includes('old'), false);
});
test('nenhuma consulta realizada não permite confirmação inventada do modelo', async () => {
  const result = await runConversation({ ...base, provider: async () => content([{ text: 'Backups perfeitos.' }]) });
  assert.equal(result.partial, true);
  assert.doesNotMatch(result.reply, /perfeitos/);
});

test('cancelamento não inicia ferramenta nem segunda chamada', async () => {
  const controller = new AbortController(); let executions = 0;
  const result = await runConversation({ ...base, signal: controller.signal,
    executeTool: async () => { executions++; return { ok: true }; },
    provider: async () => { controller.abort(); return content([call('consultar_projetos_forge', 'a')]); }
  });
  assert.equal(result.reason, 'cancelled');
  assert.equal(executions, 0);
});

test('limite real de seis execuções e quatro rodadas, incluindo repetição', async () => {
  const localPolicy = createToolPolicy([{ name: 'consultar_tarefas_forge', parameters: { properties: { projeto: { type: 'STRING' } } } }]);
  let count = 0, turn = 0;
  const result = await runConversation({ ...base, policy: localPolicy,
    executeTool: async () => { count++; return { ok: true }; },
    provider: async () => content([0, 1].map(() => ({ functionCall: { name: 'consultar_tarefas_forge', args: { projeto: String(turn++) } } })))
  });
  assert.equal(count, 6);
  assert.equal(result.metrics.providerCalls, 5);
  assert.equal(result.reason, 'round_limit');
});

test('recorte é explícito, métricas não incluem dados e execução pede leitura sem log privado', async () => {
  let turn = 0; const metrics = [];
  const result = await runConversation({ ...base, onMetric: metric => metrics.push(metric),
    executeTool: async (name, args, options) => {
      assert.equal(options.readOnly, true);
      assert.equal(options.logExecution, false);
      return { ok: true, title: 'PRIVATE', rows: ['x'.repeat(10000)] };
    },
    provider: async input => {
      if (++turn === 1) return content([call('consultar_projetos_forge', 'a')]);
      const result = input.contents.at(-1).parts[0].functionResponse.response;
      assert.equal(result.truncated, true);
      assert.ok(JSON.stringify(result).length < 4200);
      return content([{ text: 'Há resultados disponíveis.' }]);
    }
  });
  assert.equal(result.partial, true);
  assert.equal(JSON.stringify(metrics).includes('PRIVATE'), false);
  assert.deepEqual(Object.keys(metrics[0]).sort(), ['durationMs', 'name', 'status', 'type']);
});

test('resposta HTTP sem corpo dentro do prazo não deixa o ciclo preso', async () => {
  const { createGeminiProvider } = require('../src/geminiProvider');
  const result = await runConversation({ ...base, limits: { timeoutMs: 20 },
    provider: createGeminiProvider({ apiKey: 'TEST', models: ['test'], fetchImpl: async () => ({ ok: true, json: () => new Promise(() => {}) }) })
  });
  assert.equal(result.reason, 'timeout');
});

test('fonte pedida mas omitida pelo modelo torna resposta incompleta e aparece no cartão', async () => {
  let turn = 0;
  const result = await runConversation({ ...base, requiredTools: ['consultar_projetos_forge', 'consultar_status_backup_forge'],
    provider: async () => ++turn === 1 ? content([call('consultar_projetos_forge', 'a')]) : content([{ text: 'Tudo certo com seus sistemas.' }])
  });
  assert.equal(result.partial, true);
  assert.equal(result.reason, 'missing_sources');
  assert.equal(result.results.at(-1).name, 'consultar_status_backup_forge');
  assert.equal(result.results.at(-1).result.ok, false);
  assert.doesNotMatch(result.reply, /Tudo certo/);
});

test('erro retornado pelo conector não envia detalhes internos ao provedor', async () => {
  let turn = 0, sent;
  await runConversation({ ...base, executeTool: async () => ({ ok: false, erro: 'PRIVATE token URL C:/secret' }),
    provider: async input => {
      if (++turn === 1) return content([call('consultar_projetos_forge', 'a')]);
      sent = JSON.stringify(input.contents);
      return content([{ text: 'Fonte indisponível.' }]);
    }
  });
  assert.equal(typeof sent, 'string');
  assert.equal(sent.includes('PRIVATE'), false);
});
