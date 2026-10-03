const NERDOPS_URL = process.env.NERDOPS_URL || 'http://127.0.0.1:5000';
const FORGE_URL = process.env.FORGE_URL || 'http://127.0.0.1:4477';

/**
 * Consulta o status de todos os serviços monitorados em tempo real.
 * Prioriza o NerdOPS (porta 5000) e faz fallback para o The Forge (porta 4477).
 * 
 * @param {Object} [options]
 * @param {string} [options.projeto] - Filtrar por nome do projeto (ex: Echo, Strategy Hub, Estratégia Nerd)
 * @param {string} [options.tipo] - Filtrar por tipo ('todos', 'app', 'db', 'tunnel', 'integracao')
 * @param {boolean} [options.apenas_problemas] - Se true, retorna apenas serviços com status != 'online'
 */
async function getServicesStatus(options = {}) {
  const { projeto, tipo, apenas_problemas } = options;

  let servicosConsolidados = [];
  let fonte = 'nerdops';

  // 1. Tenta consultar primeiramente o NerdOPS (cache contínuo de segundo plano)
  try {
    const res = await fetch(`${NERDOPS_URL}/api/forge-status`, { signal: AbortSignal.timeout(2800) });
    if (res.ok) {
      const data = await res.json();
      if (data.ok && Array.isArray(data.projetos)) {
        for (const proj of data.projetos) {
          if (Array.isArray(proj.servicos)) {
            for (const s of proj.servicos) {
              servicosConsolidados.push({
                projeto: proj.nome,
                nome: s.nome,
                status: s.status || 'desconhecido',
                tipo: s.tipo || 'app',
                url: s.url || null,
                last_checked_at: s.last_checked_at
              });
            }
          }
        }
      }
    }
  } catch (err) {
    // NerdOPS indisponível, tentará fallback no Forge
  }

  // 2. Fallback: Se o NerdOPS não respondeu, consulta o The Forge diretamente
  if (servicosConsolidados.length === 0) {
    fonte = 'forge';
    try {
      const resProj = await fetch(`${FORGE_URL}/api/projects`, { signal: AbortSignal.timeout(3000) });
      if (resProj.ok) {
        const projetos = await resProj.json();
        const listaProj = Array.isArray(projetos) ? projetos : (projetos.projects || []);

        for (const p of listaProj.slice(0, 10)) {
          try {
            const resDet = await fetch(`${FORGE_URL}/api/projects/${p.id}/detalhes`, { signal: AbortSignal.timeout(2000) });
            if (resDet.ok) {
              const det = await resDet.json();
              if (Array.isArray(det.servicos)) {
                for (const s of det.servicos) {
                  servicosConsolidados.push({
                    projeto: p.nome,
                    nome: s.nome,
                    status: s.status || 'desconhecido',
                    tipo: (s.nome || '').toLowerCase().includes('banco') ? 'db' : ((s.nome || '').toLowerCase().includes('tunnel') ? 'tunnel' : 'app'),
                    url: s.url || null,
                    last_checked_at: s.last_checked_at
                  });
                }
              }
            }
          } catch (_) {}
        }
      }
    } catch (err) {
      return {
        ok: false,
        erro: `Monitor de serviços e The Forge offline: ${err.message}`
      };
    }
  }

  if (servicosConsolidados.length === 0) {
    return {
      ok: false,
      erro: 'Nenhum serviço encontrado no monitor no momento.'
    };
  }

  // 3. Aplica filtros solicitados
  let filtrados = [...servicosConsolidados];

  if (projeto) {
    const term = String(projeto).toLowerCase();
    filtrados = filtrados.filter(s => s.projeto.toLowerCase().includes(term));
  }

  if (tipo && tipo !== 'todos') {
    const tipoTerm = String(tipo).toLowerCase();
    filtrados = filtrados.filter(s => s.tipo.toLowerCase().includes(tipoTerm));
  }

  if (apenas_problemas) {
    filtrados = filtrados.filter(s => s.status !== 'online');
  }

  // 4. Estatísticas consolidadas
  const total = filtrados.length;
  const online = filtrados.filter(s => s.status === 'online').length;
  const offline = filtrados.filter(s => s.status === 'offline').length;
  const atencao = filtrados.filter(s => s.status === 'atencao').length;
  const problemas = offline + atencao;

  const listaProblemas = filtrados
    .filter(s => s.status !== 'online')
    .map(s => `${s.projeto} - ${s.nome} (${s.status.toUpperCase()})`);

  return {
    ok: true,
    fonte,
    total_servicos: total,
    online,
    offline,
    atencao,
    todos_online: problemas === 0,
    resumo: problemas === 0
      ? `Todos os ${total} serviços monitorados estão 100% online.`
      : `Atenção: ${problemas} de ${total} serviços requerem atenção (${offline} offline, ${atencao} alerta).`,
    servicos_com_problema: listaProblemas,
    amostra_servicos: filtrados.slice(0, 15)
  };
}

module.exports = {
  getServicesStatus
};
