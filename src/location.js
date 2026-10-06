const crypto = require('node:crypto');
const express = require('express');
const { LocationStore } = require('./locationStore');
const { LocationGeocoder } = require('./connectors/locationGeocoder');
const DAY = 86400000, FRESH = 120000;
function identity(scope) { if (!['echo', 'luna'].includes(scope)) throw new Error('Mascote inválido.'); return scope; }
function distance(a, b) {
  const r = Math.PI / 180, dlat = (b.latitude - a.latitude) * r, dlon = (b.longitude - a.longitude) * r;
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(dlon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - Math.min(1, h)));
}
function geohashPoint(link) {
  let hash;
  // Nos links compartilhados /ul/h..., o primeiro h é o marcador do formato.
  // Só pontos com precisão suficiente servem para afirmar proximidade.
  try { const url = new URL(link); if (url.origin !== 'https://waze.com') return null; hash = url.pathname.match(/^\/ul\/h([0-9bcdefghjkmnpqrstuvwxyz]{8,19})$/)?.[1]; } catch (_) { return null; }
  if (!hash) return null;
  const lat = [-90, 90], lon = [-180, 180]; let longitude = true;
  for (const char of hash) { const value = '0123456789bcdefghjkmnpqrstuvwxyz'.indexOf(char);
    for (let bit = 4; bit >= 0; bit--) { const range = longitude ? lon : lat, mid = (range[0] + range[1]) / 2; range[(value & (1 << bit)) ? 0 : 1] = mid; longitude = !longitude; }
  }
  return { latitude: (lat[0] + lat[1]) / 2, longitude: (lon[0] + lon[1]) / 2 };
}
class LocationService {
  constructor({ store = new LocationStore(), geocoder = new LocationGeocoder(), memory, now = Date.now } = {}) {
    this.store = store; this.geocoder = geocoder; this.memory = memory; this.now = now;
  }
  read() {
    const data = this.store.read(); let changed = false;
    for (const scope of ['echo', 'luna']) {
      if (data[scope]?.position && this.now() - data[scope].position.capturedAt >= DAY) { delete data[scope].position; changed = true; }
    }
    if (changed) this.store.write(data);
    return data;
  }
  status(scope, device) {
    identity(scope); const entry = this.read()[scope];
    return { configured: this.store.configured, sharing: !!entry?.device, owner: entry?.device === device,
      updatedAt: entry?.position?.capturedAt || null, geocoding: this.geocoder.provider || false };
  }
  start(scope, device, replace) {
    identity(scope); const data = this.read(), entry = data[scope];
    if (entry?.device && entry.device !== device && replace !== true) throw new Error('Outro celular já compartilha por este mascote. Confirme a substituição.');
    if (entry?.device === device) return this.status(scope, device);
    data[scope] = { device, startedAt: this.now() }; this.store.write(data); return this.status(scope, device);
  }
  stop(scope, device) {
    identity(scope); const data = this.read();
    if (device && data[scope]?.device && data[scope].device !== device) throw new Error('Outro celular é o transmissor. Atualize o estado antes de interromper.');
    delete data[scope]; this.store.write(data); return { sharing: false };
  }
  update(scope, device, input) {
    identity(scope); const data = this.read(), entry = data[scope];
    if (!entry?.device || entry.device !== device) throw new Error('Este celular não é o transmissor autorizado.');
    const { latitude, longitude, accuracy, capturedAt } = input || {};
    if (![latitude, longitude, accuracy, capturedAt].every(n => typeof n === 'number' && Number.isFinite(n)) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || accuracy < 0 || accuracy > 10000 ||
      capturedAt > this.now() + 5000 || capturedAt < this.now() - FRESH) throw new Error('Posição inválida ou antiga. Aguarde uma nova leitura do GPS.');
    if (entry.position && capturedAt <= entry.position.capturedAt) return { accepted: false };
    if (entry.position && this.now() - entry.position.receivedAt < 10000) return { accepted: false };
    entry.position = { latitude, longitude, accuracy, capturedAt, receivedAt: this.now() };
    this.store.write(data); return { accepted: true };
  }
  async lookup(scope) {
    identity(scope); const name = scope === 'echo' ? 'Echo' : 'Luna', entry = this.read()[scope];
    const answer = reply => ({ ok: true, source: 'shared-location', reply });
    if (!entry?.device) return answer(`${name} não está compartilhando localização.`);
    const p = entry.position;
    if (!p) return answer(`${name} está com compartilhamento ativado, mas não há posição disponível nas últimas 24 horas.`);
    const device = entry.device, capturedAt = p.capturedAt;
    let near = null;
    if (p.accuracy <= 100 && this.memory) {
      try {
        const saved = JSON.parse(await this.memory.getPreference('navigation_saved_destinations') || '{}');
        const nearby = Object.entries({ casa: 'Casa', trabalho1: 'DHL', trabalho2: 'Jayme' }).map(([id, label]) => {
          const point = geohashPoint(saved[id]?.link); return point ? { label, meters: distance(p, point) } : null;
        }).filter(Boolean).sort((a, b) => a.meters - b.meters);
        if (nearby[0] && nearby[0].meters + p.accuracy <= 250) near = nearby[0].label;
      } catch (_) { /* Não inventa local quando o cadastro não pode ser lido. */ }
    }
    // Endereço completo também perto de um local cadastrado: "perto de Casa (Rua …, CEP …)"
    const address = await this.geocoder.address(p);
    const place = near ? (address ? `perto de ${near} (${address})` : `perto de ${near}`)
      : address ? `perto de ${address} (endereço aproximado)` : null;
    const credit = address && this.geocoder.provider === 'osm' ? ' · endereço © OpenStreetMap' : '';
    // Revogação ou nova posição durante a consulta invalida a resposta antiga.
    const latest = this.read()[scope];
    if (latest?.device !== device || latest?.position?.capturedAt !== capturedAt) return answer('O compartilhamento mudou durante a consulta. Pergunte novamente.');
    const age = Math.max(0, this.now() - capturedAt), fresh = age <= FRESH;
    const time = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(capturedAt));
    const detail = place || 'em uma posição disponível no mapa';
    const reply = `${fresh ? `${name} está` : `A última localização conhecida de ${name} era`} ${detail}. Atualizada ${age < 60000 ? 'há menos de um minuto' : `há ${Math.floor(age / 60000)} minutos`}, com precisão aproximada de ${Math.ceil(p.accuracy)} metros.`;
    return { ...answer(reply), location: { latitude: p.latitude, longitude: p.longitude, accuracy: p.accuracy, capturedAt, fresh },
      card: { badge: fresh ? 'LOCALIZAÇÃO RECENTE' : 'ÚLTIMA LOCALIZAÇÃO', title: `${name}: ${detail}`, detail1: `Atualização: ${time}`, detail2: `Precisão aproximada: ${Math.ceil(p.accuracy)} m${credit}` },
      mapUrl: `https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}` };
  }
}
function targetFromMessage(message, own) {
  const text = String(message || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (!/\bonde\b|\blocalizacao\b|\blocalizar\b/.test(text)) return null;
  if (/\bluna\b/.test(text) && /\becho\b/.test(text)) return own === 'echo' ? 'luna' : 'echo';
  if (/\bluna\b/.test(text)) return 'luna'; if (/\becho\b/.test(text)) return 'echo'; return null;
}
function createLocationRoutes({ service, requirePin, requireLunaPin }) {
  const router = express.Router(), sessions = new Map();
  router.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.use('/:scope', (req, res, next) => {
    if (!['echo', 'luna'].includes(req.params.scope)) return res.status(404).json({ ok: false });
    req.locationScope = req.params.scope;
    return (req.locationScope === 'echo' ? requirePin : requireLunaPin)(req, res, next);
  });
  function session(req, res, create = false) {
    const cookieName = `${req.locationScope}_location_device`;
    const raw = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
    let device = /^[a-f0-9]{64}$/.test(raw || '') ? raw : null;
    if (!device && create) {
      device = crypto.randomBytes(32).toString('hex');
      res.append('Set-Cookie', `${cookieName}=${device}; Path=/; HttpOnly; SameSite=Strict; Max-Age=7776000${req.secure || req.headers['cf-connecting-ip'] ? '; Secure' : ''}`);
    }
    const now = Date.now(); for (const [id, s] of sessions) if (s.expires < now) sessions.delete(id);
    const key = `${req.locationScope}:${device}`; let s = device && sessions.get(key);
    if (!s && device && create) { s = { device, csrf: crypto.randomBytes(32).toString('hex'), expires: now + DAY }; sessions.set(key, s); }
    if (s) s.expires = now + DAY;
    return s;
  }
  function csrf(req, res, next) {
    const s = session(req, res), token = req.headers['x-location-csrf'];
    if (!s || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(s.csrf))) return res.status(403).json({ ok: false, reply: 'Abra Localização neste dispositivo para iniciar a sessão.' });
    req.locationDevice = s.device; next();
  }
  const wrap = handler => async (req, res) => { try { await handler(req, res); } catch (e) { res.status(400).json({ ok: false, source: 'shared-location', reply: e.message }); } };
  router.get('/:scope/status', wrap((req, res) => {
    const s = session(req, res, true);
    const status = service.store.configured ? service.status(req.locationScope, s.device) : { configured: false, sharing: false, owner: false };
    res.json({ ok: true, ...status, csrf: s.csrf });
  }));
  router.post('/:scope/start', csrf, wrap((req, res) => {
    if (req.body?.consent !== true) throw new Error('Ative explicitamente o compartilhamento neste celular.');
    res.json({ ok: true, ...service.start(req.locationScope, req.locationDevice, req.body.replace) });
  }));
  router.post('/:scope/update', csrf, wrap((req, res) => res.json({ ok: true, ...service.update(req.locationScope, req.locationDevice, req.body) })));
  router.post('/:scope/stop', csrf, wrap((req, res) => {
    if (req.body?.confirm !== 'stop') throw new Error('Confirme a interrupção.');
    res.json({ ok: true, ...service.stop(req.locationScope, req.body.ownOnly === true ? req.locationDevice : undefined) });
  }));
  router.post('/:scope/query', csrf, wrap(async (req, res) => res.json(await service.lookup(req.locationScope === 'echo' ? 'luna' : 'echo'))));
  function converse(own) { return async (req, res, next) => {
    const target = targetFromMessage(req.body?.message, own); if (!target) return next();
    res.setHeader('Cache-Control', 'no-store');
    try { res.json(await service.lookup(target)); } catch (_) { res.status(400).json({ ok: false, source: 'shared-location', reply: 'Não foi possível consultar a localização agora.' }); }
  }; }
  return { router, converse };
}
module.exports = { LocationService, createLocationRoutes, geohashPoint, distance, targetFromMessage };
