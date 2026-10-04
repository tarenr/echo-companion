const crypto = require('node:crypto');
const ZONE = 'America/Sao_Paulo';
const TTL = 10 * 60 * 1000;

function day(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Informe uma data válida no formato ano-mês-dia.');
  const date = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('Data inexistente.');
  return value;
}
function dateTime(value) {
  if (typeof value !== 'string') throw new Error('Informe data e horário.');
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:\d{2})?$/);
  if (!match) throw new Error('Informe data e horário completos.');
  day(match[1]);
  if (+match[2] > 23 || +match[3] > 59 || +(match[4] || 0) > 59) throw new Error('Horário inválido.');
  const result = match[1] + 'T' + match[2] + ':' + match[3] + ':' + (match[4] || '00') + (match[5] || '-03:00');
  if (!Number.isFinite(Date.parse(result))) throw new Error('Horário inválido.');
  return result;
}
function text(value, field, max = 1000) {
  if (typeof value !== 'string' || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) throw new Error(`${field} inválido.`);
  return value.trim();
}
function eventData(input, previous = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Informe os dados do compromisso.');
  const allowed = ['summary', 'description', 'location', 'start', 'end', 'recurrence', 'reminders'];
  if (Object.keys(input).some(key => !allowed.includes(key))) throw new Error('Campo não permitido. Convites e compartilhamento não fazem parte desta integração.');
  const merged = { ...Object.fromEntries(allowed.filter(k => previous[k] !== undefined).map(k => [k, previous[k]])), ...input };
  const result = { summary: text(merged.summary, 'Título', 200) };
  if (!result.summary) throw new Error('Qual é o título do compromisso?');
  for (const key of ['description', 'location']) if (merged[key] !== undefined) result[key] = text(merged[key], key, key === 'description' ? 4000 : 500);
  if (merged.start?.date && merged.end?.date && !merged.start.dateTime && !merged.end.dateTime) {
    result.start = { date: day(merged.start.date) };
    result.end = { date: day(merged.end.date) };
    if (result.end.date <= result.start.date) throw new Error('Em dia inteiro, a data final é exclusiva e deve ser posterior à inicial.');
  } else if (merged.start?.dateTime && merged.end?.dateTime && !merged.start.date && !merged.end.date) {
    result.start = { dateTime: dateTime(merged.start.dateTime), timeZone: ZONE };
    result.end = { dateTime: dateTime(merged.end.dateTime), timeZone: ZONE };
    if (Date.parse(result.end.dateTime) <= Date.parse(result.start.dateTime)) throw new Error('O horário final deve ser posterior ao inicial.');
  } else { throw new Error('Informe data, horário inicial e final, ou as datas do evento de dia inteiro.'); }
  if (merged.recurrence !== undefined) {
    if (!Array.isArray(merged.recurrence) || merged.recurrence.length > 1) throw new Error('Use uma regra de recorrência ou uma lista vazia para removê-la.');
    result.recurrence = merged.recurrence.map(rule => {
      if (typeof rule !== 'string' || !/^RRULE:FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;[A-Z]+=[A-Z0-9,]+)*$/.test(rule)) throw new Error('Regra de recorrência inválida.');
      const pieces = rule.slice(6).split(';');
      const seen = new Set();
      for (const piece of pieces) {
        const [key, value] = piece.split('=');
        if (seen.has(key)) throw new Error('Recorrência com campos duplicados.');
        seen.add(key);
        if (key === 'FREQ') continue;
        if (['COUNT', 'INTERVAL'].includes(key) && /^\d+$/.test(value) && +value >= 1 && +value <= 730) continue;
        if (key === 'BYDAY' && /^(MO|TU|WE|TH|FR|SA|SU)(,(MO|TU|WE|TH|FR|SA|SU))*$/.test(value)) continue;
        if (key === 'BYMONTHDAY' && /^\d+$/.test(value) && +value >= 1 && +value <= 31) continue;
        if (key === 'BYMONTH' && /^\d+$/.test(value) && +value >= 1 && +value <= 12) continue;
        if (key === 'UNTIL' && /^\d{8}(T\d{6}Z)?$/.test(value)) {
          day(value.slice(0, 4) + '-' + value.slice(4, 6) + '-' + value.slice(6, 8));
          if (value.length > 8) dateTime(value.slice(0, 4) + '-' + value.slice(4, 6) + '-' + value.slice(6, 8) + 'T' + value.slice(9, 11) + ':' + value.slice(11, 13) + ':' + value.slice(13, 15) + 'Z');
          continue;
        }
        throw new Error('Campo de recorrência não suportado.');
      }
      if (seen.has('COUNT') && seen.has('UNTIL')) throw new Error('Use quantidade ou data final da recorrência, não ambas.');
      return rule;
    });
  }
  if (merged.reminders !== undefined) {
    const reminders = merged.reminders;
    if (reminders.useDefault === true) result.reminders = { useDefault: true };
    else {
      if (reminders.useDefault !== false || !Array.isArray(reminders.overrides) || reminders.overrides.length > 5) throw new Error('Lembretes inválidos.');
      result.reminders = { useDefault: false, overrides: reminders.overrides.map(item => {
        if (item.method !== 'popup' || !Number.isInteger(item.minutes) || item.minutes < 0 || item.minutes > 40320) throw new Error('Use lembretes do Google Agenda por notificação, com minutos válidos.');
        return { method: 'popup', minutes: item.minutes };
      }) };
    }
  }
  return result;
}
function when(event) {
  if (event.start?.date) return `${event.start.date} — dia inteiro (fim exclusivo: ${event.end?.date})`;
  const format = value => new Intl.DateTimeFormat('pt-BR', { timeZone: ZONE, dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  return `${format(event.start.dateTime)} até ${format(event.end.dateTime)} (Brasília)`;
}
function safeEvent(event) {
  return { id: event.id, summary: event.summary || 'Sem título', start: event.start, end: event.end,
    location: event.location || '', recurring: !!(event.recurringEventId || event.recurrence?.length) };
}
function response(reply, card, confirmation) { return { ok: true, source: 'google-calendar', reply, card, confirmation }; }
function range(args = {}) {
  const now = new Date();
  const timeMin = args.timeMin ? dateTime(args.timeMin) : now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const timeMax = args.timeMax ? dateTime(args.timeMax) : new Date(Date.parse(timeMin) + 7 * 86400000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  if (Date.parse(timeMax) <= Date.parse(timeMin) || Date.parse(timeMax) - Date.parse(timeMin) > 366 * 86400000) throw new Error('Consulte um período válido de até um ano.');
  return { timeMin, timeMax, q: args.q === undefined ? undefined : text(args.q, 'Busca', 200) };
}
class CalendarService {
  constructor({ auth, api, now = () => Date.now() }) {
    this.auth = auth; this.api = api; this.now = now;
    this.sessions = new Map(); this.queue = Promise.resolve();
  }
  session(id) {
    for (const [key, value] of this.sessions) if (value.expires < this.now()) this.sessions.delete(key);
    if (!this.sessions.has(id)) this.sessions.set(id, { expires: this.now() + TTL, events: new Map() });
    const session = this.sessions.get(id); session.expires = this.now() + TTL; return session;
  }
  connected() { if (!this.auth.status().connected) throw new Error('Conecte o Google Agenda pelo botão Agenda.'); }
  async list(sessionId, args) {
    this.connected();
    const events = await this.api.list(range(args));
    const session = this.session(sessionId);
    session.events = new Map(events.map(event => [event.id, event]));
    const visible = events.slice(0, 20);
    return response(events.length ? `Encontrei ${events.length} compromissos. Confira os detalhes na tela.` : 'Você não tem compromissos nesse período.',
      { badge: 'GOOGLE AGENDA', title: 'Compromissos', detail1: `${events.length} no período consultado`, detail2: events.length > 20 ? 'Mostrando os 20 primeiros; reduza o período para ver outros.' : 'Horário de Brasília',
        items: visible.map((event, index) => `${index + 1}. ${event.summary || 'Sem título'} — ${when(event)}${event.recurringEventId ? ' — recorrente' : ''}`) });
  }
  async prepare(sessionId, args) {
    this.connected();
    const session = this.session(sessionId);
    // Qualquer novo rascunho invalida a confirmação anterior deste dispositivo.
    delete session.pending; delete session.selection; delete session.scopeChoice;
    const action = args.action;
    if (!['create', 'update', 'delete'].includes(action)) throw new Error('Operação inválida.');
    if (action === 'update' && (!args.event || !Object.keys(args.event).length)) throw new Error('Informe o que deseja alterar no compromisso.');
    let previous;
    let event;
    if (action === 'create') event = eventData(args.event);
    else {
      let id = args.eventId;
      if (id) {
        if (!session.events.has(id)) throw new Error('Consulte primeiro o compromisso antes de alterá-lo.');
      } else {
        if (!args.q || !args.timeMin || !args.timeMax) throw new Error('Informe qual compromisso e o período para localizá-lo.');
        const matches = await this.api.list(range(args));
        if (!matches.length) throw new Error('Não encontrei esse compromisso no período informado.');
        session.events = new Map(matches.map(item => [item.id, item]));
        if (matches.length > 1) {
          session.selection = { args, ids: matches.slice(0, 20).map(item => item.id), epoch: this.auth.epoch };
          return response('Há mais de um compromisso. Diga evento seguido do número da opção, ou refine a busca.', {
            badge: 'ESCOLHA O EVENTO', title: 'Qual compromisso?', detail1: `${matches.length} resultados`, detail2: 'Exemplo: evento 2',
            items: matches.slice(0, 20).map((item, index) => `${index + 1}. ${item.summary || 'Sem título'} — ${when(item)}`) });
        }
        id = matches[0].id;
      }
      previous = await this.api.get(id);
      if (previous.status === 'cancelled') throw new Error('Esse compromisso já foi cancelado.');
      if (previous.recurringEventId || previous.recurrence?.length) {
        if (!['occurrence', 'series'].includes(args.scope)) {
          session.scopeChoice = { args: { ...args, eventId: id }, epoch: this.auth.epoch };
          return response('Quer alterar ou excluir só esta ocorrência ou a série inteira? Diga somente esta ocorrência ou série inteira.');
        }
        if (args.scope === 'series' && previous.recurringEventId) previous = await this.api.get(previous.recurringEventId);
        if (args.scope === 'occurrence' && previous.recurrence?.length) throw new Error('Escolha uma ocorrência na consulta, não o evento principal da série.');
      }
      if (previous.organizer && previous.organizer.self !== true) throw new Error('Somente eventos que você organiza podem ser alterados.');
      if (previous.attendees?.some(item => !item.self)) throw new Error('Eventos com convidados ficam fora desta integração.');
      if (!previous.etag) throw new Error('Não consegui verificar a versão do evento. Consulte novamente.');
      event = action === 'update' ? eventData(args.event, previous) : undefined;
      if (args.scope === 'occurrence' && args.event?.recurrence !== undefined) throw new Error('Para alterar a recorrência, selecione a série inteira.');
    }
    const token = crypto.randomBytes(24).toString('hex');
    const pending = { token, action, event, previous, scope: args.scope, epoch: this.auth.epoch, expires: this.now() + TTL,
      googleId: crypto.randomBytes(20).toString('hex'), state: 'pending' };
    session.pending = pending; delete session.scopeChoice;
    const preview = event || previous;
    const actionLabel = { create: 'Criar', update: 'Alterar', delete: 'Excluir' }[action];
    const items = [when(preview)];
    if (previous && action === 'update') items.unshift(`Antes: ${previous.summary || 'Sem título'} — ${when(previous)}`);
    if (preview.location) items.push(`Local: ${preview.location}`);
    if (preview.description) items.push(`Descrição: ${preview.description}`);
    if (preview.recurrence?.length) items.push(`Recorrência: ${preview.recurrence.join(', ')}`);
    if (preview.reminders) items.push(`Lembretes: ${JSON.stringify(preview.reminders)}`);
    if (args.scope) items.push(args.scope === 'series' ? 'ATENÇÃO: toda a série' : 'Somente esta ocorrência');
    return response(`${actionLabel} ${preview.summary || 'Sem título'}, ${when(preview)}${args.scope === 'series' ? ', na série inteira' : ''}? Confira os detalhes e diga confirmar agenda ou cancelar agenda.`,
      { badge: action === 'delete' ? 'CONFIRMAR EXCLUSÃO' : 'CONFIRMAR AGENDA', title: `${actionLabel}: ${preview.summary || 'Sem título'}`, detail1: 'Ainda não foi salvo no Google', detail2: 'Confirmação válida por 10 minutos neste dispositivo', items },
      { id: token, action });
  }
  async select(sessionId, index) {
    const selection = this.session(sessionId).selection;
    if (!selection || selection.epoch !== this.auth.epoch || !selection.ids[index - 1]) throw new Error('Opção inválida ou expirada. Consulte novamente.');
    return this.prepare(sessionId, { ...selection.args, eventId: selection.ids[index - 1] });
  }
  async chooseScope(sessionId, scope) {
    const selection = this.session(sessionId).scopeChoice;
    if (!selection || selection.epoch !== this.auth.epoch) throw new Error('Não há uma escolha de recorrência pendente.');
    return this.prepare(sessionId, { ...selection.args, scope });
  }
  cancel(sessionId, token) {
    const session = this.session(sessionId);
    if (!session.pending || session.pending.token !== token || session.pending.state === 'running') throw new Error('Nenhuma confirmação disponível para cancelar.');
    delete session.pending;
    return response('Operação cancelada. Sua agenda não foi alterada.');
  }
  async confirm(sessionId, token) {
    const session = this.session(sessionId);
    const pending = session.pending;
    if (!pending || pending.token !== token || pending.expires < this.now() || pending.epoch !== this.auth.epoch) throw new Error('Confirmação inválida ou expirada. Faça o pedido novamente.');
    if (pending.result) return pending.result;
    if (pending.state === 'running') throw new Error('Essa operação já está em andamento. Aguarde.');
    pending.state = 'running';
    // Serializa mutações e desconexões, além de rejeitar confirmações duplicadas.
    const execute = async () => {
      this.connected();
      if (pending.epoch !== this.auth.epoch) throw new Error('A conexão da agenda mudou. Faça o pedido novamente.');
      const store = this.auth.getStore();
      let saved;
      if (pending.action === 'create') {
        const payload = { ...pending.event, id: pending.googleId, extendedProperties: { private: { echoOperation: pending.token } } };
        try { saved = await this.api.create(payload); }
        catch (error) {
          if (error.response?.status !== 409 && error.code !== 409) throw error;
          saved = await this.api.get(pending.googleId);
          if (saved.extendedProperties?.private?.echoOperation !== pending.token) throw new Error('Conflito na criação do evento.');
        }
      } else {
        // A cópia criptografada é escrita antes de qualquer exclusão ou edição.
        store.update(data => {
          data.recovery = data.recovery || {};
          data.recovery[pending.token] = { action: pending.action, event: pending.previous, scope: pending.scope, at: new Date(this.now()).toISOString() };
        });
        if (pending.action === 'update') saved = await this.api.update(pending.previous.id, pending.event, pending.previous.etag);
        else await this.api.delete(pending.previous.id, pending.previous.etag);
      }
      const label = pending.action === 'create' ? 'Compromisso criado.' : pending.action === 'update' ? 'Compromisso atualizado.' : 'Compromisso excluído.';
      pending.result = response(label, saved ? { badge: 'GOOGLE AGENDA', title: saved.summary || pending.event.summary, detail1: when(saved), detail2: 'Salvo no Google Agenda' } : undefined);
      return pending.result;
    };
    const work = this.queue.then(execute, execute);
    this.queue = work.catch(() => {});
    try { return await work; }
    catch (error) {
      // Não faz replay cego de edição/exclusão após resposta perdida.
      if (pending.action !== 'create') delete session.pending;
      else pending.state = 'pending';
      const status = error.response?.status || error.code;
      if (status === 412) throw new Error('O evento mudou desde a confirmação. Consulte novamente antes de alterar.');
      throw new Error('Não foi possível confirmar a operação. Consulte a agenda antes de tentar novamente.');
    }
  }
  async disconnect() {
    const work = this.queue.then(async () => { const result = await this.auth.disconnect(); this.sessions.clear(); return result; });
    this.queue = work.catch(() => {}); return work;
  }
  handleTool(sessionId, name, args) {
    if (name === 'consultar_agenda_google') return this.list(sessionId, args);
    if (name === 'preparar_evento_google') return this.prepare(sessionId, args);
    throw new Error('Ferramenta de agenda desconhecida.');
  }
}
module.exports = { CalendarService, eventData, range, dateTime, safeEvent, ZONE };
