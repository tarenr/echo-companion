/**
 * Cartões de dados do Echo: título com o número principal e linhas { label, value, status }.
 * status: 'ok' | 'warn' | 'error' (ou ausente). Só formata o que os conectores já devolvem.
 */

const MAX_ROWS = 8;

const brlFormat = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function isNumber(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

function brl(value) {
  return isNumber(value) ? brlFormat.format(Number(value)) : '—';
}

function num(value) {
  return isNumber(value) ? Number(value).toLocaleString('pt-BR') : '—';
}

function text(value, max = 70) {
  const str = value === null || value === undefined ? '' : String(value).trim();
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

// 'YYYY-MM-DD' (com ou sem hora) -> 'DD/MM' ou 'DD/MM HH:MM'
function shortDate(value, withTime = false) {
  if (!value) return '—';
  const str = value instanceof Date ? value.toISOString() : String(value);
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(str);
  if (!m) return text(str, 16);
  return withTime && m[4] ? `${m[3]}/${m[2]} ${m[4]}:${m[5]}` : `${m[3]}/${m[2]}`;
}

function daysUntil(ymd, now = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ''));
  if (!m) return null;
  const due = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due - today) / 86400000);
}

function dueStatus(ymd, now) {
  const days = daysUntil(ymd, now);
  if (days === null) return undefined;
  if (days < 0) return 'error';
  if (days <= 3) return 'warn';
  return 'ok';
}

function row(label, value, status) {
  return { label: text(label, 40), value: text(value), ...(status ? { status } : {}) };
}

function limitRows(rows, totalLabel = 'itens') {
  if (rows.length <= MAX_ROWS) return rows;
  const shown = rows.slice(0, MAX_ROWS - 1);
  shown.push(row('…', `mais ${rows.length - shown.length} ${totalLabel}`));
  return shown;
}

function unavailableCard(badge, erro) {
  return {
    badge,
    title: 'Indisponível',
    rows: [row('Consulta', text(erro || 'Não foi possível obter os dados', 90), 'error')]
  };
}

function bankBalancesCard(r) {
  if (!r?.ok) return unavailableCard('SALDOS BANCÁRIOS', r?.erro);
  const contas = r.contas_encontradas || r.contas || [];
  const total = r.filtro_banco ? contas.reduce((sum, c) => sum + (Number(c.saldo) || 0), 0) : r.total_consolidado;
  return {
    badge: 'SALDOS BANCÁRIOS',
    title: brl(total),
    detail1: r.filtro_banco ? `Filtro: ${r.filtro_banco}` : `${num(r.quantidade_contas ?? contas.length)} contas`,
    rows: limitRows(contas.map(c => row(c.banco || c.nome, brl(c.saldo), Number(c.saldo) < 0 ? 'error' : 'ok')), 'contas')
  };
}

function creditCardsCard(r, now) {
  if (!r?.ok) return unavailableCard('CARTÕES DE CRÉDITO', r?.erro);
  const cartoes = r.cartoes || [];
  return {
    badge: 'CARTÕES DE CRÉDITO',
    title: brl(r.total_faturas_abertas),
    detail1: `Em faturas abertas • ${num(r.quantidade_cartoes ?? cartoes.length)} cartões`,
    rows: limitRows(cartoes.map(c => {
      const name = c.final ? `${c.nome} •${c.final}` : c.nome;
      const due = c.vencimento ? ` • vence ${shortDate(c.vencimento)}` : '';
      const status = Number(c.fatura_atual) > 0 ? dueStatus(c.vencimento, now) || 'ok' : 'ok';
      return row(name, `${brl(c.fatura_atual)}${due}`, status);
    }), 'cartões')
  };
}

function pendingBillsCard(r, now) {
  if (!r?.ok) return unavailableCard('CONTAS A PAGAR', r?.erro);
  const contas = [...(r.contas || [])].sort((a, b) => String(a.vencimento || '9999').localeCompare(String(b.vencimento || '9999')));
  return {
    badge: 'CONTAS A PAGAR',
    title: brl(r.total_despesas_pendentes),
    detail1: `${num(r.quantidade_pendencias ?? contas.length)} pendentes`,
    rows: limitRows(contas.map(c => row(c.descricao, `${brl(c.valor)} • ${shortDate(c.vencimento)}`, dueStatus(c.vencimento, now))), 'contas')
  };
}

function forgeProjectsCard(r) {
  if (!r?.ok) return unavailableCard('THE FORGE', r?.erro);
  const projetos = r.projetos || [];
  return {
    badge: 'THE FORGE',
    title: `${num(r.total_projetos ?? projetos.length)} projetos`,
    rows: limitRows(projetos.map(p => {
      const progress = isNumber(p.progresso) ? `${p.progresso}%` : '—';
      const tasks = isNumber(p.tarefas_total) ? ` • ${num(p.tarefas_concluidas ?? 0)}/${num(p.tarefas_total)}` : '';
      return row(p.nome, `${progress}${tasks}`, p.status === 'ativo' ? 'ok' : undefined);
    }), 'projetos')
  };
}

function forgeTasksCard(r) {
  if (!r?.ok) return unavailableCard('THE FORGE', r?.erro);
  // Projeto sem tarefa vem do Forge como linha sem título: não vira linha do cartão
  const tarefas = (r.tarefas || []).filter(t => t.titulo);
  const pendentes = isNumber(r.pendentes) ? r.pendentes : tarefas.filter(t => !t.concluida).length;
  return {
    badge: 'THE FORGE',
    title: `${num(pendentes)} pendentes`,
    detail1: `${num(r.total_encontradas ?? tarefas.length)} tarefas encontradas`,
    rows: limitRows(tarefas.map(t => row(t.projeto_nome || 'Forge', t.titulo, t.concluida ? 'ok' : 'warn')), 'tarefas')
  };
}

function backupStatusCard(r) {
  if (!r?.ok) return unavailableCard('BACKUP ECOSSISTEMA', r?.erro);
  const sched = r.tarefa_agendada || {};
  const restic = r.restic_snapshots || {};
  const nerd = r.estrategia_nerd_backups || {};
  const okResult = String(sched.ultimo_resultado || '').startsWith('Sucesso');
  const rows = [
    row('Última execução', shortDate(sched.ultima_execucao, true), okResult ? 'ok' : 'error'),
    row('Próxima', shortDate(sched.proxima_execucao, true)),
    row('Restic projetos', shortDate(restic.projetos_ultimo, true), restic.projetos_ultimo ? 'ok' : 'warn'),
    row('Restic documentos', shortDate(restic.documentos_ultimo, true), restic.documentos_ultimo ? 'ok' : 'warn'),
    row('Estratégia Nerd prod', shortDate(nerd.prod_dados, true), nerd.prod_dados && nerd.prod_dados !== 'Indisponível' ? 'ok' : 'warn')
  ];
  return { badge: 'BACKUP ECOSSISTEMA', title: text(sched.ultimo_resultado || 'Sem resultado', 40), rows };
}

// "Projeto - Serviço (OFFLINE)" -> linha com status
function problemRow(entry) {
  const m = /^(.*?) - (.*) \(([A-ZÇÃ]+)\)$/.exec(String(entry));
  if (!m) return row('Serviço', entry, 'warn');
  return row(`${m[1]} - ${m[2]}`, m[3].toLowerCase(), m[3] === 'OFFLINE' ? 'error' : 'warn');
}

function servicesMonitorCard(r) {
  if (!r?.ok) return unavailableCard('MONITOR DE SERVIÇOS', r?.erro);
  const problems = r.servicos_com_problema || [];
  const rows = problems.length
    ? problems.map(problemRow)
    : [row('Situação', `Todos os ${num(r.total_servicos)} online`, 'ok')];
  return {
    badge: 'MONITOR DE SERVIÇOS',
    title: `${num(r.online)}/${num(r.total_servicos)} online`,
    detail1: problems.length ? `${num(r.offline ?? 0)} offline • ${num(r.atencao ?? 0)} em atenção` : '',
    rows: limitRows(rows, 'serviços')
  };
}

function scheduledPostsCard(r) {
  if (!r?.ok) return unavailableCard('POSTS AGENDADOS', r?.erro);
  const posts = [...(r.posts || [])].sort((a, b) => String(a.data_agendada || '').localeCompare(String(b.data_agendada || '')));
  const total = (Number(r.total_blog_agendados) || 0) + (Number(r.total_instagram_agendados) || 0);
  return {
    badge: 'POSTS AGENDADOS',
    title: `${num(total)} agendados`,
    detail1: `Blog: ${num(r.total_blog_agendados ?? 0)} • Instagram: ${num(r.total_instagram_agendados ?? 0)}`,
    rows: limitRows(posts.map(p => row(`${p.canal} ${shortDate(p.data_agendada, true)}`, p.titulo || p.preview_legenda || p.tipo)), 'posts')
  };
}

function blogMetricsCard(r) {
  if (!r?.ok) return unavailableCard('MÉTRICAS DO BLOG', r?.erro);
  const rows = [
    row('Publicados', num(r.artigos_publicados)),
    row('Agendados', num(r.artigos_agendados)),
    row('Rascunhos', num(r.artigos_rascunhos)),
    row('Curtidas', num(r.total_curtidas)),
    ...(r.top_artigos || []).slice(0, 3).map(t => row(t.titulo, `${num(t.views)} views`))
  ];
  return { badge: 'MÉTRICAS DO BLOG', title: `${num(r.total_visualizacoes)} views`, rows };
}

function instagramMetricsCard(r) {
  if (!r?.ok) return unavailableCard('MÉTRICAS DO INSTAGRAM', r?.erro);
  return {
    badge: 'MÉTRICAS DO INSTAGRAM',
    title: `${num(r.seguidores)} seguidores`,
    detail1: r.perfil || '',
    rows: [
      row('Publicados', num(r.posts_publicados)),
      row('Agendados', num(r.posts_agendados)),
      row('Curtidas registradas', num(r.total_curtidas_registradas)),
      row('Comentários registrados', num(r.total_comentarios_registrados))
    ]
  };
}

function gymOsCard(r) {
  if (!r?.ok) return unavailableCard('GYM OS RPG', r?.erro);
  const hoje = r.hoje || {};
  const gam = r.gamificacao || {};
  const ultimo = r.ultimo_treino;
  const rows = [
    row('Hoje', hoje.dia_semana || '—'),
    row('Intensidade', hoje.intensidade || '—'),
    row('Bônus de XP', num(hoje.bonus_xp ?? 0)),
    row('Streak', `${num(gam.streak_dias_treinados ?? 0)} dias`, Number(gam.streak_dias_treinados) > 0 ? 'ok' : 'warn'),
    row('Nível', `${num(gam.nivel)} • ${num(gam.total_xp)} XP`),
    row('Próximo nível', `faltam ${num(gam.xp_para_proximo_nivel)} XP`)
  ];
  if (ultimo && typeof ultimo === 'object') rows.push(row('Último treino', `${ultimo.nome || '—'} • ${ultimo.data || '—'}`));
  return {
    badge: 'GYM OS RPG',
    title: hoje.dia_descanso ? 'Dia de descanso' : text(hoje.missao || 'Treino do dia', 40),
    rows
  };
}

function weatherCard(r) {
  if (!r?.ok) return unavailableCard('CLIMA & TEMPO', r?.erro);
  return {
    badge: 'CLIMA & TEMPO',
    title: `${r.temperatura ?? '--'}°C • ${r.condicao || 'tempo atual'}`,
    detail1: r.cidade || '',
    rows: [
      row('Sensação', `${r.sensacao ?? '--'}°C`),
      row('Máx / Mín', `${r.maxima ?? '--'}°C / ${r.minima ?? '--'}°C`),
      row('Chuva', `${r.probabilidade_chuva ?? 0}%`, Number(r.probabilidade_chuva) >= 60 ? 'warn' : undefined),
      row('Umidade', `${r.umidade ?? '--'}%`),
      row('Vento', r.vento || '—')
    ]
  };
}

const BRIEFING_MAX_PROBLEM_SERVICES = 2;
const BRIEFING_MAX_PROJECTS = 4;

/**
 * Pendências do Forge por projeto a partir de getProjects() (tarefas_total − tarefas_concluidas).
 * Projeto sem pendência fica de fora; ordem: mais pendências primeiro.
 */
function forgePendingByProject(projetosForge) {
  if (!projetosForge?.ok) return null;
  const projetos = (projetosForge.projetos || [])
    .map(p => ({ nome: p.nome, pendentes: (Number(p.tarefas_total) || 0) - (Number(p.tarefas_concluidas) || 0) }))
    .filter(p => p.pendentes > 0)
    .sort((a, b) => b.pendentes - a.pendentes || String(a.nome).localeCompare(String(b.nome)));
  return { total: projetos.reduce((sum, p) => sum + p.pendentes, 0), projetos };
}

/**
 * Cartão do CHECK / briefing, compacto: uma linha por item, sem títulos de tarefas.
 * forge: { total, projetos: [{ nome, pendentes }] } (de forgePendingByProject) ou null se indisponível.
 * Consulta que falhou aparece como "indisponível", nunca como sucesso.
 */
function buildBriefingCard({ servicos, agendadas, forge, emailInfo } = {}) {
  const rows = [];
  let problems = 0;
  let unavailable = 0;

  if (servicos?.ok) {
    const lista = servicos.servicos_com_problema || [];
    rows.push(row('Serviços', `${num(servicos.online)}/${num(servicos.total_servicos)} online`, lista.length === 0 ? 'ok' : 'warn'));
    lista.slice(0, BRIEFING_MAX_PROBLEM_SERVICES).forEach(entry => rows.push(problemRow(entry)));
    if (lista.length > BRIEFING_MAX_PROBLEM_SERVICES) rows.push(row('…', `mais ${lista.length - BRIEFING_MAX_PROBLEM_SERVICES} com problema`, 'warn'));
    problems += lista.length;
  } else {
    rows.push(row('Serviços', 'indisponível', 'error'));
    unavailable += 1;
  }

  // Backups e rotinas: uma linha quando tudo deu certo; com falha, a linha de cada falha
  const rotinas = (Array.isArray(agendadas?.tarefas) ? agendadas.tarefas : []).filter(t => t.tipo === 'backup' || t.tipo === 'cron');
  if (agendadas?.ok && rotinas.length > 0) {
    const falhas = rotinas.filter(t => !t.sucesso);
    rows.push(row('Backups e agendadas', `${num(rotinas.length - falhas.length)}/${num(rotinas.length)} OK`, falhas.length ? 'error' : 'ok'));
    falhas.forEach(t => rows.push(row(t.rotulo || t.nome, `falhou • ${t.ultima_execucao || '—'}`, 'error')));
    problems += falhas.length;
  } else {
    rows.push(row('Backups e agendadas', 'indisponível', 'error'));
    unavailable += 1;
  }

  // Forge: total e pendências por projeto (sem listar tarefas)
  if (forge) {
    const projetos = forge.projetos || [];
    const totalLabel = forge.total > 0
      ? `${num(forge.total)} pendentes em ${num(projetos.length)} ${projetos.length === 1 ? 'projeto' : 'projetos'}`
      : 'tudo em dia';
    rows.push(row('Forge', totalLabel, forge.total > 0 ? 'warn' : 'ok'));
    projetos.slice(0, BRIEFING_MAX_PROJECTS).forEach(p => rows.push(row(p.nome, num(p.pendentes))));
    const rest = projetos.slice(BRIEFING_MAX_PROJECTS);
    if (rest.length) rows.push(row(`+${rest.length} ${rest.length === 1 ? 'projeto' : 'projetos'}`, num(rest.reduce((sum, p) => sum + p.pendentes, 0))));
  } else {
    rows.push(row('Forge', 'indisponível', 'error'));
    unavailable += 1;
  }

  if (emailInfo?.configurado) {
    const unread = Number(emailInfo.total_nao_lidos) || 0;
    rows.push(row('E-mails', `${num(unread)} não lidos`, unread > 0 ? 'warn' : 'ok'));
  }

  let title = 'Tudo operacional';
  if (unavailable > 0) title = `Verificação incompleta (${unavailable})`;
  else if (problems > 0) title = `${problems} ${problems === 1 ? 'ponto' : 'pontos'} de atenção`;

  return { badge: 'BRIEFING DO SISTEMA', title, rows, problems, unavailable };
}

const TOOL_CARD_BUILDERS = {
  consultar_saldos_bancos: bankBalancesCard,
  consultar_cartoes_credito: creditCardsCard,
  consultar_contas_a_pagar: pendingBillsCard,
  consultar_projetos_forge: forgeProjectsCard,
  consultar_tarefas_forge: forgeTasksCard,
  consultar_status_backup_forge: backupStatusCard,
  consultar_monitor_servicos: servicesMonitorCard,
  consultar_agendamento_posts: scheduledPostsCard,
  consultar_metricas_blog: blogMetricsCard,
  consultar_metricas_instagram: instagramMetricsCard,
  consultar_treino_e_streak_gym_os: gymOsCard,
  consultar_previsao_tempo: weatherCard
};

/**
 * Cartão para o resultado de uma ferramenta do Gemini. Retorna null quando a ferramenta não tem cartão.
 */
function buildToolCard(name, toolResult, now = new Date()) {
  if (name === 'executar_briefing_sistema') {
    return toolResult?.card || unavailableCard('BRIEFING DO SISTEMA', toolResult?.erro);
  }
  const builder = TOOL_CARD_BUILDERS[name];
  return builder ? builder(toolResult, now) : null;
}

module.exports = {
  buildToolCard,
  buildBriefingCard,
  forgePendingByProject,
  formatters: { brl, num, shortDate, daysUntil }
};
