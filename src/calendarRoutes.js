const crypto = require('node:crypto');
const express = require('express');

function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(piece => piece.trim().split('=')).filter(([key, value]) => key && value));
}
function publicError(error) {
  if (error.response || error.config || error.name === 'GaxiosError') return 'Não foi possível acessar o Google Agenda. Verifique a conexão e a autorização da conta.';
  return error.message || 'Não foi possível concluir o pedido da agenda.';
}
function createCalendarRoutes({ auth, service, requirePin }) {
  const router = express.Router();
  const sessions = new Map();
  function getSession(req, res, create = false) {
    const now = Date.now();
    for (const [id, session] of sessions) if (session.expires < now) sessions.delete(id);
    let id = cookies(req).echo_calendar_session;
    let session = sessions.get(id);
    if (!session && create) {
      id = crypto.randomBytes(32).toString('hex');
      session = { id, csrf: crypto.randomBytes(32).toString('hex'), expires: now + 12 * 3600000 };
      sessions.set(id, session);
      const secure = req.secure || !!req.headers['cf-connecting-ip'];
      res.append('Set-Cookie', `echo_calendar_session=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200${secure ? '; Secure' : ''}`);
    }
    if (session) session.expires = now + 12 * 3600000;
    return session;
  }
  function validSession(req, res, next) {
    const session = getSession(req, res);
    const candidate = req.headers['x-agenda-csrf'];
    if (!session || typeof candidate !== 'string' || !/^[a-f0-9]{64}$/.test(candidate) ||
      !crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(session.csrf))) {
      return res.status(403).json({ ok: false, source: 'google-calendar', reply: 'Abra o botão Agenda para iniciar uma sessão neste dispositivo.' });
    }
    req.calendarSession = session;
    return next();
  }
  function wrap(handler) {
    return async (req, res) => {
      try { await handler(req, res); }
      catch (error) {
        const pending = service.sessions.get(req.calendarSession?.id)?.pending;
        const retry = req.path === '/confirm' && pending?.action === 'create' && pending.state === 'pending' && pending.expires > service.now() && pending.epoch === auth.epoch;
        res.status(400).json({ ok: false, source: 'google-calendar', reply: publicError(error),
          confirmation: retry ? { id: pending.token, action: 'create' } : undefined });
      }
    };
  }
  router.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.get('/oauth/callback', async (req, res) => {
    res.setHeader('Referrer-Policy', 'no-referrer');
    const session = getSession(req, res);
    try {
      if (!session) throw new Error();
      const work = service.queue.then(() => auth.callback(session.id, req.query));
      service.queue = work.catch(() => {});
      await work;
      service.sessions.clear();
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
      res.send('<!doctype html><meta charset="utf-8"><title>Google Agenda conectado</title><h1>Google Agenda conectado</h1><p>Volte ao Echo para consultar seus compromissos.</p><a href="/">Voltar ao Echo</a>');
    } catch (_) {
      res.status(400).type('html').send('<!doctype html><meta charset="utf-8"><h1>Não foi possível conectar</h1><p>Volte ao Echo e inicie a conexão novamente. Confira o cliente OAuth, o endereço de retorno e a autorização.</p><a href="/">Voltar ao Echo</a>');
    }
  });
  router.use(requirePin);
  router.get('/status', wrap(async (req, res) => {
    const session = getSession(req, res, true);
    res.json({ ok: true, ...auth.status(), csrf: session.csrf });
  }));
  router.post('/oauth/start', validSession, wrap(async (req, res) => {
    res.json({ ok: true, url: await auth.start(req.calendarSession.id) });
  }));
  router.post('/disconnect', validSession, wrap(async (req, res) => {
    if (req.body?.confirm !== 'disconnect') throw new Error('Confirme a desconexão.');
    const result = await service.disconnect();
    res.json({ ok: true, reply: result.revoked ? 'Google Agenda desconectado.' : 'Acesso local removido. Revogue também o aplicativo nas permissões da sua conta Google.' });
  }));
  router.post('/list', validSession, wrap(async (req, res) => res.json(await service.list(req.calendarSession.id, req.body))));
  router.post('/draft', validSession, wrap(async (req, res) => res.json(await service.prepare(req.calendarSession.id, req.body))));
  router.post('/confirm', validSession, wrap(async (req, res) => res.json(await service.confirm(req.calendarSession.id, req.body?.id))));
  router.post('/cancel', validSession, wrap(async (req, res) => res.json(service.cancel(req.calendarSession.id, req.body?.id))));

  async function converse(req, res, next) {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^echo[, ]+/, '') : '';
    const confirm = /^(confirmar agenda|confirmo agenda|confirmar|confirmo)$/.test(message);
    const cancel = /^(cancelar agenda|cancelo agenda|cancelar|cancelo)$/.test(message);
    const choice = message.match(/^evento\s+(\d+)$/);
    const scope = /^(somente esta ocorrencia|so esta ocorrencia|serie inteira)$/.test(message);
    const consultation = /^(?:qual|quais|como|consultar|consulte|ver|veja|mostrar|mostre|listar|liste|tenho|o que).*(?:agenda|compromissos?)/.test(message);
    const agendaIntent = /\b(agenda|compromisso|compromissos|reuniao|evento|dentista)\b|^(marque|marcar|agende|agendar|remarque)\b/.test(message);
    if (!confirm && !cancel && !choice && !scope && !consultation && !agendaIntent) return next();
    return validSession(req, res, async () => {
      try {
        const id = req.calendarSession.id;
        if (confirm || cancel) return res.json(confirm ? await service.confirm(id, req.body.calendarConfirmation) : service.cancel(id, req.body.calendarConfirmation));
        if (choice) return res.json(await service.select(id, +choice[1]));
        if (scope) return res.json(await service.chooseScope(id, message === 'serie inteira' ? 'series' : 'occurrence'));
        if (!auth.status().connected) return res.json({ ok: true, source: 'google-calendar', reply: 'Conecte o Google Agenda pelo botão Agenda para usar seus compromissos.', card: { badge: 'GOOGLE AGENDA', title: 'Conexão pendente', detail1: '', detail2: 'Abra Agenda para conectar ou verificar a configuração.' } });
        // Somente hoje/amanhã são resolvidos aqui. Outros períodos seguem para o modelo.
        if (consultation && /\b(hoje|amanha)\b/.test(message)) {
          const current = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
          const start = new Date(current + 'T00:00:00-03:00');
          if (message.includes('amanha')) start.setUTCDate(start.getUTCDate() + 1);
          const end = new Date(start.getTime() + 86400000);
          return res.json(await service.list(id, { timeMin: start.toISOString().replace('.000Z', 'Z'), timeMax: end.toISOString().replace('.000Z', 'Z') }));
        }
        return next();
      } catch (error) { return res.status(400).json({ ok: false, source: 'google-calendar', reply: publicError(error) }); }
    });
  }
  async function handleTool(req, res, name, args) {
    return validSession(req, res, async () => {
      try { res.json(await service.handleTool(req.calendarSession.id, name, args)); }
      catch (error) { res.status(400).json({ ok: false, source: 'google-calendar', reply: publicError(error) }); }
    });
  }
  return { router, converse, handleTool };
}
module.exports = { createCalendarRoutes, publicError };
