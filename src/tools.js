const strategyHub = require('./connectors/strategyHub');
const forge = require('./connectors/forge');
const estrategiaNerd = require('./connectors/estrategiaNerd');
const gymOs = require('./connectors/gymOs');
const servicesMonitor = require('./connectors/servicesMonitor');
const memory = require('./memory');

const functionDeclarations = [
  {
    name: 'consultar_monitor_servicos',
    description: 'Consulta o status operacional em tempo real de todos os serviços monitorados no computador (NerdOPS / The Forge): Apps locais, Bancos de Dados (SQLite, MySQL, MariaDB, PostgreSQL), Túneis do Cloudflare e APIs externas dos 5 projetos do ecossistema.',
    parameters: {
      type: 'OBJECT',
      properties: {
        projeto: {
          type: 'STRING',
          description: 'Nome opcional do projeto para filtrar (ex: Echo, Strategy Hub, GYM-OS, The Forge, Estratégia Nerd)'
        },
        tipo: {
          type: 'STRING',
          enum: ['todos', 'app', 'db', 'tunnel', 'integracao'],
          description: 'Tipo de serviço desejado (todos, app, db para bancos, tunnel para túneis cloudflare, integracao)'
        },
        apenas_problemas: {
          type: 'BOOLEAN',
          description: 'Se verdadeiro, traz apenas serviços que estejam offline ou com problemas'
        }
      }
    }
  },
  {
    name: 'consultar_saldos_bancos',
    description: 'Consulta os saldos de todas as contas bancárias (Mercado Pago, Itaú, XP, PicPay, etc.) no Strategy Hub, o saldo total consolidado e quebra por instituição.',
    parameters: {
      type: 'OBJECT',
      properties: {
        banco: {
          type: 'STRING',
          description: 'Nome opcional de um banco específico (ex: Mercado Pago, Itau, XP, PicPay)'
        }
      }
    }
  },
  {
    name: 'consultar_cartoes_credito',
    description: 'Consulta os cartões de crédito cadastrados, seus limites disponíveis e as faturas em aberto ou datas de vencimento no Strategy Hub.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'consultar_contas_a_pagar',
    description: 'Consulta as contas e despesas pendentes a pagar cadastradas no Strategy Hub com valores e datas de vencimento.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'consultar_projetos_forge',
    description: 'Consulta a lista de projetos ativos catalogados no painel The Forge, progresso percentual e status atual.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'consultar_tarefas_forge',
    description: 'Consulta tarefas de projetos no The Forge com filtros por nome do projeto e/ou status (pendente ou concluida).',
    parameters: {
      type: 'OBJECT',
      properties: {
        projeto: {
          type: 'STRING',
          description: 'Nome ou ID do projeto (ex: Echo, Estratégia Nerd, Strategy Hub, CodeNotch)'
        },
        status: {
          type: 'STRING',
          enum: ['pendente', 'concluida', 'todas'],
          description: 'Filtro de status das tarefas'
        }
      }
    }
  },
  {
    name: 'consultar_status_backup_forge',
    description: 'Consulta o status e integridade dos backups agendados do sistema e snapshots no The Forge. ESTREITAMENTE SOMENTE-LEITURA.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'consultar_agendamento_posts',
    description: 'Consulta os posts agendados para publicação no Blog ou no canal do Instagram do Estratégia Nerd.',
    parameters: {
      type: 'OBJECT',
      properties: {
        canal: {
          type: 'STRING',
          enum: ['todos', 'blog', 'instagram'],
          description: 'Canal de agendamento desejado'
        }
      }
    }
  },
  {
    name: 'consultar_metricas_blog',
    description: 'Consulta as métricas do Blog Estratégia Nerd: total de visualizações, artigos publicados, agendados, rascunhos e posts mais lidos.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'consultar_metricas_instagram',
    description: 'Consulta as métricas do Instagram do Estratégia Nerd: seguidores, posts publicados, agendados, total de curtidas e comentários registrados.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'consultar_treino_e_streak_gym_os',
    description: 'Consulta a rotina de treinos no Gym OS: missão de treino de hoje, se é descanso, último treino concluído, streak de treinos e nível/XP.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'gravar_preferencia_usuario',
    description: 'Grava na memória de longo prazo do Echo um fato, preferência ou instrução permanente dita pelo Mestre.',
    parameters: {
      type: 'OBJECT',
      properties: {
        chave: {
          type: 'STRING',
          description: 'Nome da chave/tópico (ex: apelido_favorito, horario_treino, foco_da_semana)'
        },
        valor: {
          type: 'STRING',
          description: 'Conteúdo ou valor a ser lembrado'
        }
      },
      required: ['chave', 'valor']
    }
  },
  {
    name: 'consultar_preferencias_usuario',
    description: 'Consulta fatos, preferências ou anotações salvas na memória de longo prazo do Echo.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  }
];

async function executeTool(name, args = {}) {
  let result = null;

  try {
    switch (name) {
      case 'consultar_saldos_bancos': {
        const data = await strategyHub.getBankBalances();
        if (data.ok && args.banco) {
          const filter = String(args.banco).toLowerCase();
          const filtradas = data.contas.filter(c => 
            c.banco.toLowerCase().includes(filter) || c.nome.toLowerCase().includes(filter)
          );
          result = {
            ok: true,
            filtro_banco: args.banco,
            total_consolidado_geral: data.total_consolidado,
            contas_encontradas: filtradas
          };
        } else {
          result = data;
        }
        break;
      }

      case 'consultar_cartoes_credito':
        result = await strategyHub.getCreditCardsAndInvoices();
        break;

      case 'consultar_contas_a_pagar':
        result = await strategyHub.getPendingBills();
        break;

      case 'consultar_projetos_forge':
        result = await forge.getProjects();
        break;

      case 'consultar_tarefas_forge':
        result = await forge.getTasks({
          projeto: args.projeto,
          status: args.status || 'pendente'
        });
        break;

      case 'consultar_status_backup_forge':
        result = await forge.getBackupStatus();
        break;

      case 'consultar_monitor_servicos':
        result = await servicesMonitor.getServicesStatus({
          projeto: args.projeto,
          tipo: args.tipo || 'todos',
          apenas_problemas: Boolean(args.apenas_problemas)
        });
        break;

      case 'consultar_agendamento_posts':
        result = await estrategiaNerd.getScheduledPosts({
          canal: args.canal || 'todos'
        });
        break;

      case 'consultar_metricas_blog':
        result = await estrategiaNerd.getBlogMetrics();
        break;

      case 'consultar_metricas_instagram':
        result = await estrategiaNerd.getInstagramMetrics();
        break;

      case 'consultar_treino_e_streak_gym_os':
        result = await gymOs.getWorkoutAndStreak();
        break;

      case 'gravar_preferencia_usuario':
        await memory.setPreference(args.chave, args.valor);
        result = {
          ok: true,
          mensagem: `Preferência '${args.chave}' memorizada com sucesso: "${args.valor}"`
        };
        break;

      case 'consultar_preferencias_usuario':
        const prefs = await memory.getAllPreferences();
        result = {
          ok: true,
          preferencias: prefs
        };
        break;

      default:
        result = { ok: false, erro: `Ferramenta '${name}' não reconhecida` };
    }
  } catch (err) {
    result = { ok: false, erro: `Falha ao executar ferramenta '${name}': ${err.message}` };
  }

  // Registra no histórico de ferramentas
  try {
    await memory.logToolExecution(name, args, result);
  } catch (_) {}

  return result;
}

module.exports = {
  functionDeclarations,
  executeTool
};
