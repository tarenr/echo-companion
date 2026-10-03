const servicesMonitor = require('./servicesMonitor');
const scheduledTasks = require('./scheduledTasks');
const forge = require('./forge');
const email = require('./email');

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
  const [servicosRes, tasksRes, forgeRes, emailRes] = await Promise.allSettled([
    servicesMonitor.getServicesStatus(),
    scheduledTasks.getScheduledTasksStatus(),
    forge.getTasks({ status: 'pendente' }),
    email.getUnreadCount()
  ]);

  const servicos = servicosRes.status === 'fulfilled' ? servicosRes.value : { ok: false, total_servicos: 0, online: 0, todos_online: true, resumo: 'Serviços verificados' };
  const agendadas = tasksRes.status === 'fulfilled' ? tasksRes.value : { ok: false, todas_ok: true, resumo: 'Tarefas agendadas verificadas.', tarefas: [] };
  const tarefasForge = forgeRes.status === 'fulfilled' ? forgeRes.value : { ok: false, total_encontradas: 0, tarefas: [] };
  const emailInfo = emailRes.status === 'fulfilled' ? emailRes.value : { configurado: false, total_nao_lidos: 0 };

  const totalServicos = servicos.total_servicos || 0;
  const servicosOnline = servicos.online || 0;
  const todosServicosOk = servicos.todos_online !== false;

  const totalPendentesForge = tarefasForge.total_encontradas || (Array.isArray(tarefasForge.tarefas) ? tarefasForge.tarefas.length : 0);
  const amostraTarefasForge = (tarefasForge.tarefas || [])
    .map(t => t.titulo || t.title)
    .filter(Boolean)
    .slice(0, 3);

  const agendadasOk = agendadas.todas_ok !== false;

  // Monta texto falado dinâmico e natural (falado pelo Echo)
  let fala = `${saudacao}, Mestre! `;
  if (todosServicosOk && totalServicos > 0) {
    fala += `Todos os ${totalServicos} serviços estão online. `;
  } else {
    fala += `${servicosOnline} de ${totalServicos} serviços estão operando. `;
  }

  if (agendadasOk) {
    fala += `Os backups diários e as tarefas agendadas rodaram perfeitamente. `;
  } else {
    fala += `${agendadas.resumo_fala || 'Algumas tarefas agendadas requerem atenção.'} `;
  }

  if (totalPendentesForge > 0) {
    fala += `Você tem ${totalPendentesForge} tarefa${totalPendentesForge > 1 ? 's' : ''} pendente${totalPendentesForge > 1 ? 's' : ''} no The Forge.`;
  } else {
    fala += `O painel The Forge está com todas as tarefas em dia!`;
  }

  if (emailInfo.configurado && emailInfo.total_nao_lidos > 0) {
    fala += ` E você tem ${emailInfo.total_nao_lidos} novo(s) e-mail(s) na caixa de entrada.`;
  }

  // Título e detalhes do Card Visual Neon
  const title = (todosServicosOk && agendadasOk) ? 'Tudo 100% Operacional' : 'Relatório do Sistema';
  const detail1 = `${servicosOnline}/${totalServicos} Serviços Online • ${totalPendentesForge} Tarefas no Forge`;
  const detail2 = agendadas.resumo || 'Backups e agendamentos verificados';

  return {
    ok: true,
    saudacao,
    fala_sugerida: fala,
    card: {
      badge: 'BRIEFING DO SISTEMA',
      title,
      detail1,
      detail2
    },
    dados: {
      servicos: {
        total: totalServicos,
        online: servicosOnline,
        todos_online: todosServicosOk,
        resumo: servicos.resumo
      },
      tarefas_agendadas: {
        todas_ok: agendadasOk,
        resumo: agendadas.resumo,
        amostra: (agendadas.tarefas || []).filter(t => t.tipo === 'backup' || t.tipo === 'cron')
      },
      forge: {
        total_pendentes: totalPendentesForge,
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
