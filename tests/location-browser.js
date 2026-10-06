// Fixture totalmente isolada: GPS e contas simulados, sem dados reais nem Google.
const express = require('express');
const fs = require('fs');
const path = require('path');
const { LocationService, createLocationRoutes, geohashPoint } = require('../src/location');
const app = express(); app.use(express.json()); let state = {};
const service = new LocationService({ store: { configured: true, read: () => structuredClone(state), write: s => { state = structuredClone(s); } }, geocoder: { address: async () => null }, memory: { getPreference: async () => JSON.stringify({ casa: { link: 'https://waze.com/ul/h7h7mmdcj9' } }) } });
const routes = createLocationRoutes({ service, requirePin: (req, res, next) => next(), requireLunaPin: (req, res, next) => next() });
app.use('/api/location', routes.router);
for (const [url, scope] of [['/', 'echo'], ['/luna', 'luna']]) app.get(url, (req, res) => {
  const point = geohashPoint('https://waze.com/ul/h7h7mmdcj9');
  const mock = `<script>const mockPoint=${JSON.stringify(point)};const mockFix=()=>({coords:{...mockPoint,accuracy:10},timestamp:Date.now()});Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition:ok=>setTimeout(()=>ok(mockFix()),0),watchPosition:ok=>{setTimeout(()=>ok(mockFix()),0);return 1;},clearWatch:()=>{}}});</script>`;
  const html = fs.readFileSync(path.join(__dirname, '../public', scope === 'echo' ? 'index.html' : 'luna.html'), 'utf8');
  res.type('html').send(html.replace('<script src="/location.js', mock + '<script src="/location.js'));
});
app.get(['/api/auth/status', '/api/luna/auth/status'], (req, res) => res.json({ ok: true, authorized: true }));
app.get('/api/stream', (req, res) => { res.setHeader('Content-Type', 'text/event-stream'); res.write('data: '+JSON.stringify({ mode: 'full', state: 'idle', project: 'GPS SIMULADO', badge: 'TESTE LOCAL' })+'\n\n'); });
app.post('/api/converse', routes.converse('echo'), (req, res) => res.json({ ok: true, reply: 'Teste isolado.' }));
app.post('/api/luna/converse', routes.converse('luna'), (req, res) => res.json({ ok: true, reply: 'Teste isolado.' }));
app.get('/api/calendar/status', (req, res) => res.json({ ok: true, configured: false, connected: false, csrf: '' }));
app.use('/api', (req, res) => res.status(503).json({ ok: false }));
app.use(express.static(path.join(__dirname, '../public')));
if (require.main === module) app.listen(4886, '127.0.0.1', () => console.log('Localização simulada em 4886. Não captura GPS real.'));
module.exports = app;
