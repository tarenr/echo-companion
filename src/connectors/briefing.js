const servicesMonitor = require('./servicesMonitor');
const scheduledTasks = require('./scheduledTasks');
const forge = require('./forge');
const email = require('./email');
const { buildBriefingCard, forgePendingByProject } = require('../cards');

/**
 * Obtém a saudação apropriada baseada no horário local de Brasília.
 */
function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

/**
 * Orquestra o briefing completo do sistema em tempo real.
 */
async function getDailyBriefing() {
  const saudacao = getGreeting();

  // Executa todas as checagens em paralelo
  const [servicosRes, tasksRes, forgeRes, emailRes, projetosRes] = await Promise.allSettled([
    servicesMonitor.getServicesStatus(),
    scheduledTasks.getScheduledTasksStatus(),
    forge.getTasks({ status: 'pendente' }),
    email.getUnreadCount(),
    forge.getProjects()
  ]);

  // Consulta que falhou fica marcada como indisponível; nunca vira "tudo ok"
  const servicos = servicosRes.status === 'fulfilled' ? servicosRes.value : { ok: false, erro: String(servicosRes.reason?.message || servicosRes.reason) };
  const agendadas = tasksRes.status === 'fulfilled' ? tasksRes.value : { ok: false, tarefas: [] };
  const tarefasForge = forgeRes.status === 'fulfilled' ? forgeRes.value : { ok: false, total_encontradas: 0, tarefas: [] };
  const emailInfo = emailRes.status === 'fulfilled' ? emailRes.value : { configurado: false, total_nao_lidos: 0 };

  const servicosDisponiveis = servicos.ok === true;
  const totalServicos = servicos.total_servicos || 0;
  const servicosOnline = servicos.online || 0;
  const todosServicosOk = servicosDisponiveis && servicos.todos_online !== false;

  // Pendências por projeto (tarefas_total − tarefas_concluidas de cada projeto do Forge).
  // Sem a lista de projetos, agrupa as tarefas pendentes lidas (até 30) pelo nome do projeto.
  const projetosForge = projetosRes.status === 'fulfilled' ? projetosRes.value : { ok: false };
  let pendenciasForge = forgePendingByProject(projetosForge);
  if (!pendenciasForge && tarefasForge.ok === true) {
    const porProjeto = new Map();
    (tarefasForge.tarefas || []).filter(t => t.titulo).forEach(t => {
      const nome = t.projeto_nome || 'Forge';
      porProjeto.set(nome, (porProjeto.get(nome) || 0) + 1);
    });
    pendenciasForge = forgePendingByProject({
      ok: true,
      projetos: [...porProjeto].map(([nome, pendentes]) => ({ nome, tarefas_total: pendentes, tarefas_concluidas: 0 }))
    });
  }

  const forgeDisponivel = Boolean(pendenciasForge);
  const totalPendentesForge = pendenciasForge ? pendenciasForge.total : 0;
  const amostraTarefasForge = (tarefasForge.tarefas || [])
    .map(t => t.titulo || t.title)
    .filter(Boolean)
    .slice(0, 3);

  // Sem nenhuma tarefa lida, o Agendador não foi consultado de verdade
  const agendadasDisponiveis = agendadas.ok === true && Array.isArray(agendadas.tarefas) && agendadas.tarefas.length > 0;
  const agendadasOk = agendadasDisponiveis && agendadas.todas_ok !== false;

  // Monta texto falado dinâmico e natural (falado pelo Echo)
  let fala = `${saudacao}, Mestre! `;
  if (!servicosDisponiveis) {
    fala += `Não consegui verificar os serviços agora. `;
  } else if (todosServicosOk && totalServicos > 0) {
    fala += `Todos os ${totalServicos} serviços estão online. `;
  } else {
    fala += `${servicosOnline} de ${totalServicos} serviços estão operando. `;
  }

  if (!agendadasDisponiveis) {
    fala += `Não consegui conferir os backups e as tarefas agendadas. `;
  } else if (agendadasOk) {
    fala += `Os backups diários e as tarefas agendadas rodaram perfeitamente. `;
  } else {
    fala += `${agendadas.resumo_fala || 'Algumas tarefas agendadas requerem atenção.'} `;
  }

  if (!forgeDisponivel) {
    fala += `O The Forge não respondeu.`;
  } else if (totalPendentesForge > 0) {
    fala += `Você tem ${totalPendentesForge} tarefa${totalPendentesForge > 1 ? 's' : ''} pendente${totalPendentesForge > 1 ? 's' : ''} no The Forge.`;
  } else {
    fala += `O painel The Forge está com todas as tarefas em dia!`;
  }

  if (emailInfo.configurado && emailInfo.total_nao_lidos > 0) {
    fala += ` E você tem ${emailInfo.total_nao_lidos} novo(s) e-mail(s) na caixa de entrada.`;
  }

  // Cartão com uma linha por item verificado (src/cards.js)
  const { problems, unavailable, ...card } = buildBriefingCard({
    servicos,
    agendadas: agendadasDisponiveis ? agendadas : { ok: false },
    forge: pendenciasForge,
    emailInfo
  });

  return {
    ok: true,
    saudacao,
    fala_sugerida: fala,
    card,
    dados: {
      servicos: {
        disponivel: servicosDisponiveis,
        total: totalServicos,
        online: servicosOnline,
        todos_online: todosServicosOk,
        resumo: servicos.resumo || servicos.erro
      },
      tarefas_agendadas: {
        disponivel: agendadasDisponiveis,
        todas_ok: agendadasOk,
        resumo: agendadas.resumo,
        amostra: (agendadas.tarefas || []).filter(t => t.tipo === 'backup' || t.tipo === 'cron')
      },
      forge: {
        disponivel: forgeDisponivel,
        total_pendentes: totalPendentesForge,
        pendentes_por_projeto: pendenciasForge ? pendenciasForge.projetos : [],
        principais_tarefas: amostraTarefasForge
      },
      emails: {
        configurado: emailInfo.configurado,
        total_nao_lidos: emailInfo.total_nao_lidos
      }
    }
  };
}

module.exports = {
  getDailyBriefing,
  getGreeting
};
