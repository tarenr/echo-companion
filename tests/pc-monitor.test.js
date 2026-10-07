const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMonitor } = require('../src/connectors/pcMonitor');
const { parseQuery, answerQuery, presentation } = require('../src/pcMonitorQueries');
const stats = { sampled_at: 200, cpu: { percent: 25, per_cpu: [20, 30], freq_ghz: 3 }, ram: { percent: 40, used_gb: 8, total_gb: 20 }, gpu: { online: true, temp_c: 52, load_pct: 12 }, disks: [{ device: 'C:\\', total_gb: 500, used_gb: 200 }], network: { up_mb_s: 2, down_mb_s: 4 }, media: { status: 'playing' }, volume: { level: 30, muted: false } };
test('variações de nomes usam o mesmo provedor na fala e na ferramenta', async () => {
  const providers = [
    { id: 'gemini', label: 'Antigravity', status: 'ok', windows: [{ label: '5h', used: 0.3 }] },
    { id: 'opencode', label: 'OpenCode Go', status: 'ok', windows: [] },
    { id: 'glm', label: 'GLM', status: 'needsAuth', windows: [] },
    { id: 'codex', label: 'Codex', status: 'ok', windows: [] }
  ];
  const { monitor } = mock({ '/api/ai-quota-status': { ok: true, dados: { provedores: providers } } });
  for (const [aliases, canonical, id] of [
    [['antigravity', 'anti gravity', 'anti-gravity', 'Anti–Gravity', 'antigravidade', 'anti gravidade', 'ANTI-GRÁVIDADE'], 'antigravity', 'gemini'],
    [['opencode', 'open code', 'open-code'], 'opencode', 'opencode'],
    [['glm', 'g l m', 'g-l-m'], 'glm', 'glm'],
    [['Codex'], 'codex', 'codex'], [['Gemini'], 'gemini', 'gemini']
  ]) {
    for (const alias of aliases) {
      const question = `Bom dia, qual a cota do ${alias}?`;
      assert.deepEqual(parseQuery(question), { secao: 'cotas', provedor: canonical });
      const direct = await answerQuery(question, monitor);
      const tool = await monitor.query({ secao: 'cotas', provedor: alias });
      assert.deepEqual(direct.result.dados.provedores.map(p => p.id), [id]);
      assert.deepEqual(tool.dados.provedores.map(p => p.id), [id]);
    }
  }
  for (const message of ['Abra o anti-gravity', 'Qual a cota de gravidade?', 'Qual o limite do código aberto?']) assert.equal(parseQuery(message), null);
  assert.equal((await monitor.query({ secao: 'cotas', provedor: 'desconhecido' })).dados.provedores.length, 0);
});
test('perguntas naturais de cotas reconhecem provedores e preservam outros assuntos', () => {
  for (const [message, provider] of [
    ['Bom dia, quantos tokens tenho no Codex?', 'codex'],
    ['Qual meu limite do Claude?', 'claude'], ['Quanto resta no Cursor?', 'cursor'],
    ['Quando renova o Gemini?', 'gemini'], ['Qual o saldo do OpenCode?', 'opencode'],
    ['Quais cotas de IA estão disponíveis?', undefined]
  ]) assert.deepEqual(parseQuery(message), { secao: 'cotas', provedor: provider });
  for (const message of ['Qual meu saldo bancário?', 'Qual o limite do cartão?', 'Abra o Cursor', 'Explique tokens em programação']) assert.equal(parseQuery(message), null);
});

test('cotas filtram provedor, mostram renovação em Brasília e não inventam tokens', async () => {
  const { monitor, calls } = mock({ '/api/ai-quota-status': { ok: true, dados: { provedores: [
    { id: 'claude', label: 'Claude', status: 'ok', windows: [] },
    { id: 'codex', label: 'Codex', status: 'ok', windows: [{ label: '5h', used: 0.25, resets_at: Date.UTC(2026, 9, 7, 21, 30) }] }
  ] } } });
  const answer = await answerQuery('Bom dia, quantos tokens tenho no Codex?', monitor);
  assert.equal(answer.result.dados.provedores.length, 1);
  assert.match(answer.reply, /sem quantidade exata de tokens/);
  assert.match(answer.reply, /usou 25%.*75% disponível/);
  assert.match(answer.rows[0].value, /07\/10.*18:30.*Brasília/);
  assert.ok(calls.every(c => c.options.method === 'GET' && c.url.endsWith('/api/ai-quota-status')));
  const overview = await answerQuery('Quais cotas de IA estão disponíveis?', monitor);
  assert.match(overview.reply, /Claude/);
  assert.match(overview.reply, /Codex/);
});

test('dados ausentes, contagens, autenticação e percentuais inválidos são explícitos', async () => {
  const { monitor } = mock({ '/api/ai-quota-status': { ok: true, dados: { provedores: [
    { id: 'cursor', label: 'Cursor', status: 'needsAuth', windows: [] },
    { id: 'opencode', label: 'OpenCode', status: 'ok', count_only: true, backoff: true, windows: [{ label: 'Uso', count: 4, used: 0.1, resets_at: 0 }] },
    { id: 'codex', label: 'Codex', status: 'ok', windows: [{ label: '5h', used: null }, { label: '7d', used: 25 }] }
  ] } } });
  const rows = presentation(await monitor.query({ secao: 'cotas' })).rows;
  assert.match(rows[0].value, /needsAuth/);
  assert.match(rows[1].value, /4 usos \(sem percentual\).*renovação não informada.*em espera/);
  for (const row of rows.slice(2)) assert.match(row.value, /percentual indisponível.*renovação não informada/);
  assert.match((await answerQuery('Qual a cota do Grok?', monitor)).reply, /nenhum provedor disponível/);
});
function mock(routes = {}) {
  const calls = [];
  const monitor = createMonitor({ now: () => 200000, fetchImpl: async (url, options) => {
    calls.push({ url, options });
    const route = new URL(url).pathname + new URL(url).search;
    return { ok: true, json: async () => routes[route] ?? stats };
  } });
  return { monitor, calls };
}

test('fala explica todas as janelas em português e distingue saldo cheio, baixo e esgotado', () => {
  const now = Date.UTC(2026, 9, 7, 18);
  const result = { ok: true, secao: 'cotas', dados: { provedores: [{ label: 'Antigravity', status: 'ok', windows: [
    { label: '5-hour Limit', restante_pct: 100, resets_at: now + 3600000 },
    { label: 'Weekly Limit', restante_pct: 4.7, resets_at: now + 86400000 },
    { label: 'Current session', restante_pct: 0 },
    { label: 'Included usage', restante_pct: 20 }
  ] }] } };
  const view = presentation(result, now);
  assert.match(view.reply, /toda a cota de cinco horas disponível/);
  assert.match(view.reply, /cota semanal.*usou 95,3%.*4,7% disponível.*quase esgotada/);
  assert.match(view.reply, /sessão atual está esgotada/);
  assert.match(view.reply, /cota incluída no plano.*saldo está baixo/);
  assert.match(view.reply, /hoje, às 16h00/);
  assert.match(view.reply, /amanhã, às 15h00/);
  assert.doesNotMatch(view.reply, /Weekly|Current session|Included usage|5-hour/);
  assert.equal(view.rows[1].label, 'Antigravity • cota semanal');
});

test('renovação usa dias de Brasília e não promete renovar em horário passado', () => {
  const now = Date.UTC(2026, 11, 31, 23, 30);
  const reply = resets => presentation({ ok: true, secao: 'cotas', dados: { provedores: [{ label: 'Codex', status: 'ok', windows: [{ label: 'Weekly limit', restante_pct: 50, resets_at: resets }] }] } }, now).reply;
  assert.match(reply(Date.UTC(2027, 0, 1, 2)), /hoje, às 23h00/);
  assert.match(reply(Date.UTC(2027, 0, 1, 4)), /amanhã, às 01h00/);
  assert.match(reply(Date.UTC(2027, 0, 3, 4)), /3 de janeiro de 2027/);
  assert.match(reply(now - 1000), /já passou/);
  assert.match(reply(null), /não foi informado/);
});

test('janelas iguais de grupos diferentes permanecem distintas na fala e nos cartões', async () => {
  const { monitor } = mock({ '/api/ai-quota-status': { ok: true, dados: { provedores: [{ id: 'gemini', label: 'Antigravity', status: 'ok', windows: [
    { label: 'Weekly Limit', group: 'Gemini Models', used: 0.953, secret: 'privado' },
    { label: 'Weekly Limit', group: 'Claude and GPT models', used: 0.512 },
    { label: 'Monthly Limit', group: 'Outro grupo', used: 0.1 }
  ] }] } } });
  const answer = await answerQuery('Qual a cota do anti-gravity?', monitor);
  assert.equal(answer.result.dados.provedores[0].windows[0].group, 'Gemini Models');
  assert.equal(answer.result.dados.provedores[0].windows[0].secret, undefined);
  assert.match(answer.reply, /semanal para modelos Gemini.*4,7% disponível/);
  assert.match(answer.reply, /semanal para modelos Claude e GPT.*48,8% disponível/);
  assert.match(answer.reply, /mensal para Outro grupo/);
  assert.equal(answer.rows[0].label, 'Antigravity • cota semanal para modelos Gemini');
  assert.equal(answer.rows[1].label, 'Antigravity • cota semanal para modelos Claude e GPT');
  const summary = await answerQuery('Quais cotas de IA estão disponíveis?', monitor);
  assert.match(summary.reply, /semanal para modelos Gemini.*quase esgotada/);
  assert.doesNotMatch(summary.reply, /Claude e GPT/);
});

test('resumo destaca a janela mais limitada e preserva avisos sem inferir saldo de contagens', async () => {
  const { monitor } = mock({ '/api/ai-quota-status': { ok: true, dados: { provedores: [
    { id: 'claude', label: 'Claude', status: 'ok', stale: true, windows: [{ label: 'Current session', used: 0 }, { label: 'Weekly (all models)', used: 1 }] },
    { id: 'opencode', label: 'OpenCode', status: 'needsAuth', count_only: true, backoff: true, windows: [{ label: 'Usage', count: 6 }] }
  ] } } });
  const answer = await answerQuery('Quais cotas de IA estão disponíveis?', monitor);
  assert.match(answer.reply, /desatualizados.*últimos valores/);
  assert.match(answer.reply, /semanal de todos os modelos está esgotada/);
  assert.doesNotMatch(answer.reply, /toda a cota da sessão/);
  assert.match(answer.reply, /autenticar.*6 usos registrados.*não permite calcular quanto resta/);
  assert.match(answer.reply, /consultas estão em espera/);
});
test('consultas atuais: GET, seção específica e espaço livre derivado', async () => {
  const { monitor, calls } = mock();
  for (const secao of ['cpu', 'ram', 'gpu', 'discos', 'rede', 'midia', 'resumo']) assert.equal((await monitor.query({ secao })).ok, true);
  assert.ok(calls.every(c => c.options.method === 'GET' && c.url.endsWith('/api/stats') && c.options.signal));
  assert.deepEqual((await monitor.query({ secao: 'cpu' })).dados, stats.cpu);
  assert.equal((await monitor.query({ secao: 'discos', disco: 'C:' })).dados.unidades[0].free_gb, 300);
  assert.equal((await monitor.query({ secao: 'discos', disco: 'Z' })).ok, false);
});
test('falhas HTTP/rede/timeout, GPU ausente e amostra antiga não viram sucesso', async () => {
  for (const fetchImpl of [async () => ({ ok: false, status: 503 }), async () => { throw new TypeError('fetch failed'); }, async () => { throw new DOMException('timeout', 'TimeoutError'); }]) assert.equal((await createMonitor({ fetchImpl }).query()).ok, false);
  assert.equal((await mock({ '/api/stats': { ...stats, sampled_at: 180 } }).monitor.query()).ok, false);
  assert.equal((await mock({ '/api/stats': { cpu: {} } }).monitor.query()).ok, false);
  assert.equal((await mock({ '/api/stats': { ...stats, gpu: { online: false } } }).monitor.query({ secao: 'gpu' })).ok, false);
  const missing = await mock({ '/api/stats': { sampled_at: 200 } }).monitor.query({ secao: 'ram' });
  assert.equal(presentation(missing).rows[0].value, 'indisponível');
});
test('filtros inválidos não acessam rede', async () => {
  const { monitor, calls } = mock();
  for (const args of [{ secao: '../open-app' }, { periodo: '2h' }, { recurso: 'cmd' }]) assert.equal((await monitor.query(args)).ok, false);
  assert.equal(calls.length, 0);
});
test('processos exigem coletor saudável e omitem PID/comando', async () => {
  const routes = { '/api/processes': { top_ram: [{ name: 'app.exe', mem_mb: 100, pid: 123, command: 'segredo' }], app_status: { chrome: true } }, '/api/system': { collector_ok: true } };
  assert.deepEqual((await mock(routes).monitor.query({ secao: 'processos', recurso: 'ram' })).dados.processos, [{ name: 'app.exe', mem_mb: 100 }]);
  routes['/api/system'] = { collector_ok: false };
  assert.equal((await mock(routes).monitor.query({ secao: 'processos' })).ok, false);
});
test('sistema e serviços omitem identidade e URLs', async () => {
  const r = await mock({ '/api/system': { os: 'Windows', uptime_s: 3600, user: 'privado', mac: 'privado', ip_local: 'privado', hostname: 'privado', collector_last_error: 'privado' } }).monitor.query({ secao: 'sistema' });
  assert.deepEqual(r.dados, { os: 'Windows', uptime_s: 3600 });
  const s = await mock({ '/api/forge-status': { ok: true, projetos: [{ nome: 'Echo', servicos: [{ nome: 'HTTP', status: 'online', url: 'privado' }] }] } }).monitor.query({ secao: 'servicos' });
  assert.equal(s.dados.projetos[0].servicos[0].url, undefined);
});
test('histórico resume números sem converter null em zero e sinaliza idade', async () => {
  const route = '/api/history?window=15min';
  const r = await mock({ [route]: [{ t: 150, cpu: 10, ram: 20, gpu: null }, { t: 180, cpu: 30, ram: 40, gpu: null }] }).monitor.query({ secao: 'historico', periodo: '15min' });
  assert.equal(r.dados.metricas.cpu.media, 20);
  assert.equal(r.dados.metricas.cpu.maximo, 30);
  assert.equal(r.dados.metricas.gpu, null);
  assert.match(presentation(r).reply, /desatualizados/);
  assert.equal((await mock({ [route]: [] }).monitor.query({ secao: 'historico', periodo: '15min' })).ok, false);
});
test('cotas distinguem percentual, contagem e snapshots antigos', async () => {
  const { monitor } = mock({ '/api/ai-quota-status': { ok: true, dados: { provedores: [{ id: 'codex', label: 'Codex', status: 'ok', stale: true, windows: [{ label: '5h', used: 0.25 }] }, { id: 'antigravity', label: 'Antigravity', status: 'ok', windows: [{ label: 'Uso', count: 5 }] }] } } });
  const r = await monitor.query({ secao: 'cotas' });
  assert.equal(r.dados.provedores[0].windows[0].restante_pct, 75);
  assert.equal(r.dados.provedores[1].windows[0].restante_pct, null);
  assert.match(presentation(r).rows[1].value, /sem percentual/);
  assert.match(presentation(r).rows[0].value, /desatualizado/);
});
test('voz distingue GPU, disco, processos, histórico e cotas sem consumir ações', async () => {
  assert.equal(parseQuery('Qual a temperatura da GPU?').secao, 'gpu');
  assert.equal(parseQuery('Quanto espaço livre tenho no C:?').disco, 'c');
  assert.equal(parseQuery('Qual programa está consumindo mais memória?').recurso, 'ram');
  assert.equal(parseQuery('Como ficou a CPU nos últimos 15 minutos?').periodo, '15min');
  assert.equal(parseQuery('Quanto tenho de cota de IA?').secao, 'cotas');
  for (const message of ['Aumente o volume', 'Abra o programa', 'Imprima o arquivo', 'Qual o saldo do banco?']) assert.equal(parseQuery(message), null);
  assert.equal((await answerQuery('Qual a temperatura da GPU?', mock().monitor)).reply, 'Temperatura: 52 °C.');
  assert.equal((await answerQuery('Qual o volume?', mock().monitor)).reply, 'Volume: 30%.');
  assert.equal((await answerQuery('Qual o upload da rede?', mock().monitor)).reply, 'Upload: 2 MB/s.');
  assert.equal(parseQuery('Histórico da CPU nos últimos 10 minutos').periodo, '10min');
  assert.equal((await answerQuery('Histórico da CPU nos últimos 10 minutos', mock().monitor)).result.ok, false);
});
