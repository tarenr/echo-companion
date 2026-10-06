// Cartões de dados com resultados simulados dos conectores: sem banco, sem rede.
const test = require('node:test');
const assert = require('node:assert/strict');

test('dashboard: falha visível e campos ausentes sem valores inventados', () => {
  const { buildToolCard } = require('../src/cards');
  assert.equal(buildToolCard('consultar_dashboard_pc', { ok: false, erro: 'offline' }).title, 'Indisponível');
  const card = buildToolCard('consultar_dashboard_pc', { ok: true, secao: 'gpu', dados: { name: 'GPU', online: true, temp_c: 50 } });
  assert.equal(card.rows.find(r => r.label === 'Uso').value, 'indisponível');
  assert.ok(card.rows.length <= 8);
  assert.equal(card.reply, undefined);
});
const { buildToolCard, buildBriefingCard, forgePendingByProject } = require('../src/cards');

const NOW = new Date(2026, 9, 5, 12, 0, 0); // 05/10/2026

function rowByLabel(card, label) {
  return card.rows.find(r => r.label === label);
}

test('saldos: total no título, um banco por linha e saldo negativo em erro', () => {
  const card = buildToolCard('consultar_saldos_bancos', {
    ok: true,
    total_consolidado: 1500.5,
    quantidade_contas: 2,
    contas: [
      { banco: 'Itaú', nome: 'Conta', saldo: 1700.5 },
      { banco: 'PicPay', nome: 'Carteira', saldo: -200 }
    ]
  }, NOW);
  assert.match(card.title, /1\.500,50/);
  assert.equal(card.rows.length, 2);
  assert.equal(rowByLabel(card, 'PicPay').status, 'error');
  assert.equal(rowByLabel(card, 'Itaú').status, 'ok');
});

test('cartões: fatura, vencimento e status pela data', () => {
  const card = buildToolCard('consultar_cartoes_credito', {
    ok: true,
    total_faturas_abertas: 300,
    quantidade_cartoes: 3,
    cartoes: [
      { nome: 'Nubank', final: '1234', fatura_atual: 100, vencimento: '2026-10-01' },
      { nome: 'XP', final: '9999', fatura_atual: 200, vencimento: '2026-10-07' },
      { nome: 'Itaú', final: '0000', fatura_atual: 0, vencimento: '2026-10-02' }
    ]
  }, NOW);
  assert.match(card.title, /300,00/);
  assert.equal(rowByLabel(card, 'Nubank •1234').status, 'error');
  assert.equal(rowByLabel(card, 'XP •9999').status, 'warn');
  assert.equal(rowByLabel(card, 'Itaú •0000').status, 'ok');
  assert.match(rowByLabel(card, 'XP •9999').value, /vence 07\/10/);
});

test('contas a pagar: ordenadas pelo vencimento', () => {
  const card = buildToolCard('consultar_contas_a_pagar', {
    ok: true,
    total_despesas_pendentes: 80,
    quantidade_pendencias: 2,
    contas: [
      { descricao: 'Internet', valor: 50, vencimento: '2026-10-20' },
      { descricao: 'Luz', valor: 30, vencimento: '2026-10-06' }
    ]
  }, NOW);
  assert.deepEqual(card.rows.map(r => r.label), ['Luz', 'Internet']);
  assert.equal(card.rows[0].status, 'warn');
});

test('consulta que falhou vira cartão indisponível com o erro', () => {
  const card = buildToolCard('consultar_saldos_bancos', { ok: false, erro: 'MySQL fora do ar' }, NOW);
  assert.equal(card.title, 'Indisponível');
  assert.equal(card.rows[0].status, 'error');
  assert.match(card.rows[0].value, /MySQL fora do ar/);
});

test('monitor: lista os serviços com problema; sem problema, diz que todos estão online', () => {
  const withProblems = buildToolCard('consultar_monitor_servicos', {
    ok: true, total_servicos: 24, online: 22, offline: 1, atencao: 1,
    servicos_com_problema: ['Strategy Hub - MySQL (OFFLINE)', 'Forge - Tunnel (ATENCAO)']
  });
  assert.equal(withProblems.title, '22/24 online');
  assert.equal(withProblems.rows[0].status, 'error');
  assert.equal(withProblems.rows[1].status, 'warn');

  const allOk = buildToolCard('consultar_monitor_servicos', { ok: true, total_servicos: 24, online: 24, servicos_com_problema: [] });
  assert.equal(allOk.rows[0].value, 'Todos os 24 online');
});

test('zero aparece como 0, não como traço', () => {
  const weather = buildToolCard('consultar_previsao_tempo', {
    ok: true, cidade: 'Serra, ES', temperatura: 0, sensacao: 0, maxima: 5, minima: 0, probabilidade_chuva: 0, umidade: 0, vento: '0 km/h', condicao: 'Céu limpo'
  });
  assert.match(weather.title, /^0°C/);
  assert.equal(rowByLabel(weather, 'Chuva').value, '0%');

  const gym = buildToolCard('consultar_treino_e_streak_gym_os', {
    ok: true,
    hoje: { dia_semana: 'Domingo', missao: 'Corrida', dia_descanso: false, intensidade: 'Leve', bonus_xp: 0 },
    gamificacao: { nivel: 3, total_xp: 1200, xp_para_proximo_nivel: 0, streak_dias_treinados: 0 }
  });
  assert.equal(gym.title, 'Corrida');
  assert.equal(rowByLabel(gym, 'Streak').value, '0 dias');
  assert.equal(rowByLabel(gym, 'Streak').status, 'warn');
  assert.equal(rowByLabel(gym, 'Bônus de XP').value, '0');
});

test('texto longo é cortado e listas longas resumem o excedente', () => {
  const tarefas = Array.from({ length: 12 }, (_, i) => ({ projeto_nome: 'Echo', titulo: `Tarefa ${i} ${'x'.repeat(90)}`, concluida: false }));
  const card = buildToolCard('consultar_tarefas_forge', { ok: true, total_encontradas: 12, pendentes: 12, tarefas });
  assert.equal(card.rows.length, 8);
  assert.ok(card.rows[0].value.length <= 70);
  assert.ok(card.rows[0].value.endsWith('…'));
  assert.equal(card.rows[7].value, 'mais 5 tarefas');
});

test('ferramenta sem cartão devolve null', () => {
  assert.equal(buildToolCard('gravar_preferencia_usuario', { ok: true }), null);
});

const SERVICOS_OK = { ok: true, total_servicos: 24, online: 24, servicos_com_problema: [] };
const ROTINAS_OK = {
  ok: true,
  tarefas: [
    { nome: 'Projects-Backup-Daily', rotulo: 'Backup Diário dos Projetos', tipo: 'backup', ultima_execucao: '05/10 03:00', sucesso: true },
    { nome: 'EstrategiaNerd-BackupDiario', rotulo: 'Backup Banco Estratégia Nerd', tipo: 'backup', ultima_execucao: '05/10 02:00', sucesso: true },
    { nome: 'EstrategiaNerd-InstagramPublicarAgendados', rotulo: 'Publicador Instagram', tipo: 'cron', ultima_execucao: '05/10 12:31', sucesso: true },
    { nome: 'TheForge', rotulo: 'The Forge', tipo: 'service', ultima_execucao: '05/10 08:00', sucesso: true }
  ]
};

test('pendências por projeto: total − concluídas, sem projetos zerados, maiores primeiro', () => {
  const forge = forgePendingByProject({
    ok: true,
    projetos: [
      { nome: 'Echo', tarefas_total: 130, tarefas_concluidas: 127 },
      { nome: 'Cloud Journey', tarefas_total: 0, tarefas_concluidas: 0 },
      { nome: 'Estrategia Nerd', tarefas_total: 40, tarefas_concluidas: 24 },
      { nome: 'Strategy Hub', tarefas_total: 10, tarefas_concluidas: 6 }
    ]
  });
  assert.equal(forge.total, 23);
  assert.deepEqual(forge.projetos.map(p => `${p.nome}:${p.pendentes}`), ['Estrategia Nerd:16', 'Strategy Hub:4', 'Echo:3']);
  assert.equal(forgePendingByProject({ ok: false }), null);
});

test('briefing: tudo ok fica compacto, com backups numa linha e pendências por projeto', () => {
  const card = buildBriefingCard({
    servicos: SERVICOS_OK,
    agendadas: ROTINAS_OK,
    forge: { total: 26, projetos: [{ nome: 'Estrategia Nerd', pendentes: 16 }, { nome: 'Strategy Hub', pendentes: 4 }, { nome: 'Echo', pendentes: 3 }, { nome: 'NERD // OPS', pendentes: 3 }] },
    emailInfo: { configurado: true, total_nao_lidos: 0 }
  });
  assert.equal(card.title, 'Tudo operacional');
  assert.deepEqual(card.rows.map(r => r.label), ['Serviços', 'Backups e agendadas', 'Forge', 'Estrategia Nerd', 'Strategy Hub', 'Echo', 'NERD // OPS', 'E-mails']);
  assert.equal(rowByLabel(card, 'Backups e agendadas').value, '3/3 OK');
  assert.equal(rowByLabel(card, 'Forge').value, '26 pendentes em 4 projetos');
  assert.equal(rowByLabel(card, 'Estrategia Nerd').value, '16');
  assert.ok(card.rows.every(r => r.value.length <= 30), 'nenhum título de tarefa no CHECK');
});

test('briefing: mais de 4 projetos vira uma linha com o restante', () => {
  const projetos = [7, 5, 4, 3, 2, 1].map((pendentes, i) => ({ nome: `P${i}`, pendentes }));
  const card = buildBriefingCard({ servicos: SERVICOS_OK, agendadas: ROTINAS_OK, forge: { total: 22, projetos }, emailInfo: {} });
  assert.deepEqual(card.rows.slice(3).map(r => `${r.label}=${r.value}`), ['P0=7', 'P1=5', 'P2=4', 'P3=3', '+2 projetos=3']);
});

test('briefing: Forge sem pendência diz que está em dia; Forge fora do ar fica indisponível', () => {
  const emDia = buildBriefingCard({ servicos: SERVICOS_OK, agendadas: ROTINAS_OK, forge: { total: 0, projetos: [] }, emailInfo: {} });
  assert.equal(rowByLabel(emDia, 'Forge').value, 'tudo em dia');
  const fora = buildBriefingCard({ servicos: SERVICOS_OK, agendadas: ROTINAS_OK, forge: null, emailInfo: {} });
  assert.equal(rowByLabel(fora, 'Forge').value, 'indisponível');
  assert.equal(fora.title, 'Verificação incompleta (1)');
});

test('briefing: consulta que falhou aparece como indisponível, não como sucesso', () => {
  const card = buildBriefingCard({
    servicos: { ok: false, erro: 'Monitor offline' },
    agendadas: { ok: false },
    forge: { total: 2, projetos: [{ nome: 'Echo', pendentes: 2 }] },
    emailInfo: { configurado: false }
  });
  assert.equal(card.title, 'Verificação incompleta (2)');
  assert.equal(rowByLabel(card, 'Serviços').value, 'indisponível');
  assert.equal(rowByLabel(card, 'Serviços').status, 'error');
  assert.equal(rowByLabel(card, 'Backups e agendadas').status, 'error');
  assert.equal(rowByLabel(card, 'Forge').value, '2 pendentes em 1 projeto');
});

test('Forge: projeto sem tarefa (linha sem título) não vira linha vazia na lista de tarefas', () => {
  const tarefasForge = { ok: true, total_encontradas: 2, tarefas: [{ projeto_nome: 'Cloud Journey', titulo: null }, { projeto_nome: 'Echo', titulo: 'Validar Waze' }] };
  const card = buildToolCard('consultar_tarefas_forge', tarefasForge);
  assert.deepEqual(card.rows.map(r => r.label), ['Echo']);
});

test('briefing: backup que falhou aparece em linha própria e conta como ponto de atenção', () => {
  const agendadas = { ok: true, tarefas: ROTINAS_OK.tarefas.map(t => t.nome === 'EstrategiaNerd-BackupDiario' ? { ...t, sucesso: false } : t) };
  const card = buildBriefingCard({ servicos: SERVICOS_OK, agendadas, forge: { total: 0, projetos: [] }, emailInfo: {} });
  assert.equal(card.title, '1 ponto de atenção');
  assert.equal(rowByLabel(card, 'Backups e agendadas').value, '2/3 OK');
  assert.equal(rowByLabel(card, 'Backups e agendadas').status, 'error');
  assert.equal(rowByLabel(card, 'Backup Banco Estratégia Nerd').value, 'falhou • 05/10 02:00');
});
