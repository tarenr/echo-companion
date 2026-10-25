const config = require('./conversationConfig');
const normalize = message => String(message || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function isCalendarIntent(message) {
  const text = normalize(message);
  if (/\b(agenda|calendario|compromissos?|reuniao|reunioes|eventos?|dentista|lembretes?)\b|^(?:echo[, ]+)?(?:marque|agende|remarque|anote|grave)\b/.test(text)) return true;
  return /\btarefas?\b/.test(text) && !/\b(forge|projetos?|backups?|agendador|windows)\b/.test(text);
}

function routeConversation(message, enabled = config.enabled) {
  const text = normalize(message);
  const topics = [
    /\b(forge|projetos?|pendencias)\b/,
    /\b(backups?|snapshots?)\b/,
    /\b(servicos?|tuneis|aplicativos?)\b/,
    /\b(cpu|ram|gpu|discos?|rede|cotas?|computador|pc|memoria ram)\b/,
    /\bposts?\b.*\bagendad|\bagendament\w*\b.*\bposts?\b/,
    /\b(blog|instagram|metricas|seguidores|curtidas)\b/
  ].filter(pattern => pattern.test(text)).length;
  const requiredTools = [];
  if (/\b(forge|projetos?|pendencias)\b/.test(text) && !/\bbackups? d[oa] (?:the )?forge\b/.test(text)) {
    requiredTools.push(/\b(tarefas?|pendencias)\b/.test(text) ? 'consultar_tarefas_forge' : 'consultar_projetos_forge');
  }
  if (/\b(backups?|snapshots?)\b/.test(text)) requiredTools.push('consultar_status_backup_forge');
  if (/\b(servicos?|tuneis|aplicativos?)\b/.test(text)) requiredTools.push('consultar_monitor_servicos');
  if (/\b(cpu|ram|gpu|discos?|rede|cotas?|computador|pc)\b/.test(text)) requiredTools.push('consultar_dashboard_pc');
  const posts = /\bposts?\b.*\bagendad|\bagendament\w*\b.*\bposts?\b/.test(text);
  if (posts) requiredTools.push('consultar_agendamento_posts');
  if (/\bblog\b/.test(text) && (!posts || /\bmetricas|visualiza|artigos\b/.test(text))) requiredTools.push('consultar_metricas_blog');
  if (/\binstagram\b/.test(text) && (!posts || /\bmetricas|seguidores|curtidas\b/.test(text))) requiredTools.push('consultar_metricas_instagram');
  const protectedIntent = isCalendarIntent(text) ||
    /\b(crie|criar|exclua|excluir|apague|apagar|altere|alterar|salve|salvar|publique|publicar|reinicie|reiniciar|instale|instalar|execute|executar|rode|rodar|lembre|guarde|memorize|corrija|esqueca|waze|navegar|viagem|saldo|saldos|fatura|faturas|cartoes|contas a pagar|treino|gym)\b/.test(text);
  const compound = topics > 1 || (topics > 0 && /\b(?:e|tambem)\b|^(?:echo[, ]+)?(?:bom dia|boa tarde|boa noite|ola|opa|obrigado)\b/.test(text));
  const calendar = isCalendarIntent(text);
  const mixedCalendar = calendar && requiredTools.length > 0 && /\b(e|tambem|junto|compare|cruze)\b/.test(text)
    && !/^(?:echo[, ]+)?(?:marque|agende|remarque|anote|grave|crie|exclua|altere)\b/.test(text);
  return { orchestrate: Boolean(enabled && topics && !protectedIntent), compound, calendar, mixedCalendar, requiredTools };
}
module.exports = { routeConversation, isCalendarIntent };
