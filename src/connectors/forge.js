const FORGE_URL = process.env.FORGE_URL || 'http://127.0.0.1:4477';

/**
 * Consulta a lista de projetos cadastrados no The Forge
 */
async function getProjects() {
  try {
    const res = await fetch(`${FORGE_URL}/api/projects`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.projects || []);
    return {
      ok: true,
      total_projetos: list.length,
      projetos: list.map(p => ({
        id: p.id,
        nome: p.nome || p.name,
        status: p.status,
        prioridade: p.prioridade,
        progresso: p.progresso,
        proximo_passo: p.proximo_passo,
        tarefas_concluidas: p.tarefasConcluidas,
        tarefas_total: p.tarefasTotal
      }))
    };
  } catch (err) {
    return {
      ok: false,
      erro: `The Forge offline ou inacessível: ${err.message}`
    };
  }
}

/**
 * Consulta tarefas no The Forge com opção de filtro por projeto ou status
 * @param {Object} options
 * @param {string} [options.projeto] - Nome ou ID do projeto
 * @param {string} [options.status] - 'pendente', 'concluida' ou 'todas'
 */
async function getTasks(options = {}) {
  try {
    const { projeto, status } = options;
    const res = await fetch(`${FORGE_URL}/api/tasks`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let tasks = await res.json();
    if (!Array.isArray(tasks)) tasks = tasks.tasks || [];

    // Normaliza campo concluida / status
    tasks = tasks.map(t => ({
      id: t.task_id || t.id,
      projeto_id: t.project_id,
      projeto_nome: t.project_nome || t.project_name || t.projeto_nome,
      projeto_slug: t.project_slug,
      titulo: t.titulo,
      concluida: Boolean(t.concluida),
      criada_em: t.task_created_at || t.created_at
    }));

    if (projeto) {
      const projTerm = String(projeto).toLowerCase();
      tasks = tasks.filter(t => 
        (t.projeto_nome && t.projeto_nome.toLowerCase().includes(projTerm)) ||
        (t.projeto_slug && t.projeto_slug.toLowerCase().includes(projTerm)) ||
        String(t.projeto_id) === projTerm
      );
    }

    if (status === 'pendente') {
      tasks = tasks.filter(t => !t.concluida);
    } else if (status === 'concluida') {
      tasks = tasks.filter(t => t.concluida);
    }

    const pendentes = tasks.filter(t => !t.concluida).length;
    const concluidas = tasks.filter(t => t.concluida).length;

    return {
      ok: true,
      total_encontradas: tasks.length,
      pendentes,
      concluidas,
      tarefas: tasks.slice(0, 30) // Limita para contexto conciso
    };
  } catch (err) {
    return {
      ok: false,
      erro: `The Forge offline ou inacessível: ${err.message}`
    };
  }
}

/**
 * Consulta estritamente somente-leitura do status dos backups no The Forge.
 * ATENÇÃO: NUNCA executa backup; apenas lê o endpoint /api/backup/status.
 */
async function getBackupStatus() {
  try {
    const res = await fetch(`${FORGE_URL}/api/backup/status`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const sched = data.scheduledTask || {};
    const restic = data.restic?.snapshots || {};
    const nerd = data.estrategiaNerd || {};

    return {
      ok: true,
      resumo: "Consulta de integridade dos backups do ecossistema",
      tarefa_agendada: {
        estado: sched.State || 'Desconhecido',
        ultima_execucao: sched.LastRunTime,
        proxima_execucao: sched.NextRunTime,
        ultimo_resultado: sched.LastTaskResult === 0 ? 'Sucesso (código 0)' : `Código ${sched.LastTaskResult}`
      },
      restic_snapshots: {
        projetos_ultimo: restic.projects?.[0]?.time || null,
        documentos_ultimo: restic.documents?.[0]?.time || null,
        claude_ultimo: restic.claude?.[0]?.time || null,
        opencode_ultimo: restic.opencode?.[0]?.time || null
      },
      estrategia_nerd_backups: {
        prod_dados: nerd.prod?.dados?.created_at || 'Indisponível',
        prod_tecnico: nerd.prod?.tecnico?.created_at || 'Indisponível',
        stage_dados: nerd.stage?.dados?.created_at || 'Indisponível',
        stage_tecnico: nerd.stage?.tecnico?.created_at || 'Indisponível'
      },
      atualizado_em: data.atualizadoEm
    };
  } catch (err) {
    return {
      ok: false,
      erro: `Erro ao consultar status de backup no The Forge: ${err.message}`
    };
  }
}

module.exports = {
  getProjects,
  getTasks,
  getBackupStatus
};
