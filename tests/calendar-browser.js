// Fixture de navegador: somente memória e API simulada; nunca conecta ao Google.
const express = require('express');
const path = require('node:path');
const { CalendarService } = require('../src/calendarService');
const { createCalendarRoutes } = require('../src/calendarRoutes');
const sample = { summary: 'Teste local da confirmação', start: { dateTime: '2026-10-10T14:00:00-03:00' }, end: { dateTime: '2026-10-10T15:00:00-03:00' } };
let storeData = {};
const auth = { epoch: 0, status: () => ({ configured: true, connected: true }), getStore: () => ({ read: () => storeData, update: change => change(storeData) }), disconnect: async () => ({ revoked: true }) };
const service = new CalendarService({ auth, api: { create: async event => { console.log('MOCK_CREATE_CONFIRMED'); return event; } } });
// O botão de consulta retorna uma proposta simulada para exercitar a mesma UI.
service.list = sessionId => service.prepare(sessionId, { action: 'create', event: sample });
const routes = createCalendarRoutes({ auth, service, requirePin: (req, res, next) => next() });
const app = express(); app.use(express.json());
app.use('/api/calendar', routes.router);
app.get('/api/auth/status', (req, res) => res.json({ authorized: true }));
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.write('data: ' + JSON.stringify({ mode: 'full', state: 'idle', badge: 'TESTE LOCAL', project: 'TESTE DE AGENDA', telemetry: {} }) + '\n\n');
});
app.post('/api/speak', (req, res) => res.status(503).json({ ok: false }));
app.use(express.static(path.join(__dirname, '../public')));
if (require.main === module) app.listen(4885, '127.0.0.1', () => console.log('Fixture de agenda pronta em 4885. Não usa dados reais.'));
module.exports = { app };
