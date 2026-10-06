const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const memory = require('./src/memory');
const tools = require('./src/tools');
const navigation = require('./src/navigation');
const briefing = require('./src/connectors/briefing');
const cards = require('./src/cards');
const pinPage = require('./src/pinPage');

// Inicializa banco de memória persistente SQLite
memory.initMemory().then(() => {
  console.log('🧠 Memória persistente SQLite do Echo inicializada com sucesso!');
}).catch(err => {
  console.warn('⚠️ Falha ao inicializar memória SQLite:', err.message);
});

const qrcode = require('qrcode-terminal');

process.on('uncaughtException', (err, origin) => {
  fs.appendFileSync(path.resolve(__dirname, 'crash.log'), `[${new Date().toISOString()}] UncaughtException: ${err?.stack || err} (origin: ${origin})\n`);
});
process.on('unhandledRejection', (reason) => {
  fs.appendFileSync(path.resolve(__dirname, 'crash.log'), `[${new Date().toISOString()}] UnhandledRejection: ${reason?.stack || reason}\n`);
});
process.on('exit', (code) => {
  fs.appendFileSync(path.resolve(__dirname, 'crash.log'), `[${new Date().toISOString()}] Process exit with code: ${code}\n`);
});

// Carrega variáveis do ambiente do Estratégia Nerd se existir
const estrategiaEnvPath = path.resolve('C:/Users/WINDOWS/Projects/estrategia-nerd/.env');
let OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
let GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
let GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-3.8-flash';
let GEMINI_TEXT_MODEL_FALLBACK = process.env.GEMINI_TEXT_MODEL_FALLBACK || 'gemini-3.5-flash';

if (fs.existsSync(estrategiaEnvPath)) {
  try {
    const envContent = fs.readFileSync(estrategiaEnvPath, 'utf8');
    const matchOpenAI = envContent.match(/^OPENAI_API_KEY=(.+)$/m);
    if (matchOpenAI && matchOpenAI[1]) {
      OPENAI_API_KEY = matchOpenAI[1].trim().replace(/^['"]|['"]$/g, '');
    }
    const matchGemini = envContent.match(/^GEMINI_API_KEY=(.+)$/m);
    if (matchGemini && matchGemini[1]) {
      GEMINI_API_KEY = matchGemini[1].trim().replace(/^['"]|['"]$/g, '');
      console.log('✅ GEMINI_API_KEY carregada com sucesso do Estratégia Nerd!');
    }
    const matchModel = envContent.match(/^GEMINI_TEXT_MODEL=(.+)$/m);
    if (matchModel && matchModel[1]) {
      GEMINI_TEXT_MODEL = matchModel[1].trim().replace(/^['"]|['"]$/g, '');
    }
    const matchModelFallback = envContent.match(/^GEMINI_TEXT_MODEL_FALLBACK=(.+)$/m);
    if (matchModelFallback && matchModelFallback[1]) {
      GEMINI_TEXT_MODEL_FALLBACK = matchModelFallback[1].trim().replace(/^['"]|['"]$/g, '');
    }
  } catch (err) {
    console.warn('⚠️ Não foi possível ler .env do Estratégia Nerd:', err.message);
  }
}

// Carrega PINs do .env local do echo-companion (arquivo não versionado)
const localEnvPath = path.resolve(__dirname, '.env');
if (fs.existsSync(localEnvPath)) {
  try {
    const localEnv = fs.readFileSync(localEnvPath, 'utf8');
    for (const key of ['ECHO_PIN', 'LUNA_PIN', 'ECHO_APPROVAL_PIN', 'ECHO_VAPID_PUBLIC_KEY', 'ECHO_VAPID_PRIVATE_KEY', 'ECHO_VAPID_SUBJECT', 'ECHO_PUBLIC_ORIGIN', 'GOOGLE_CALENDAR_CLIENT_ID', 'GOOGLE_CALENDAR_CLIENT_SECRET', 'GOOGLE_CALENDAR_REDIRECT_URI', 'GOOGLE_CALENDAR_ENCRYPTION_KEY', 'LOCATION_ENCRYPTION_KEY', 'LOCATION_GOOGLE_GEOCODING_KEY']) {
      const m = localEnv.match(new RegExp(`^${key}=(.*)$`, 'm'));
      if (m && m[1].trim() && !process.env[key]) {
        process.env[key] = m[1].trim().replace(/^['"]|['"]$/g, '');
      }
    }
  } catch (err) {
    console.warn('⚠️ Não foi possível ler o .env local:', err.message);
  }
}

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4884;
// Sem PIN configurado, o acesso externo fica bloqueado (não há valor padrão)
const ECHO_PIN = (process.env.ECHO_PIN || '').trim();
const LUNA_PIN = (process.env.LUNA_PIN || '').trim();
// Segundo PIN: exigido para aprovar, negar e responder pelo celular. Sem ele, o modo celular fica desativado.
const ECHO_APPROVAL_PIN = (process.env.ECHO_APPROVAL_PIN || '').trim();
if (!ECHO_PIN) console.warn('⚠️ ECHO_PIN não configurado: acesso externo ao Echo bloqueado.');
if (!LUNA_PIN) console.warn('⚠️ LUNA_PIN não configurado: acesso externo à Luna bloqueado.');
if (!ECHO_APPROVAL_PIN) console.warn('⚠️ ECHO_APPROVAL_PIN não configurado: aprovação pelo celular desativada.');

function pinMatches(candidate, expected) {
  return Boolean(expected) && candidate !== undefined && candidate !== null && String(candidate).trim() === expected;
}

function socketAddress(req) {
  return req.socket?.remoteAddress || '';
}

function isLoopbackAddress(ip) {
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

// O IP informado pelo Cloudflare só vale quando a conexão vem do cloudflared, que roda neste PC.
// Vindo da rede local, o cabeçalho é ignorado e vale o endereço real da conexão.
function clientAddress(req) {
  const peer = socketAddress(req);
  const cfIp = req.headers['cf-connecting-ip'];
  return isLoopbackAddress(peer) && cfIp ? String(cfIp) : peer;
}

function isViaCloudflare(req) {
  return isLoopbackAddress(socketAddress(req)) && Boolean(req.headers['cf-connecting-ip']);
}

app.use((req, res, next) => {
  // Códigos e state OAuth não devem aparecer em logs de requisição; o PIN na URL é mascarado.
  const loggedUrl = req.path.startsWith('/api/calendar/') ? req.path : req.originalUrl.replace(/([?&]pin=)[^&]*/gi, '$1***');
  const origin = isViaCloudflare(req) ? `${clientAddress(req)} via Cloudflare` : socketAddress(req);
  console.log(`[HTTP ${req.method}] ${loggedUrl} (${origin})`);
  next();
});

app.use(express.json());

// Helper de autenticação
function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    try {
      list[name] = decodeURIComponent(value);
    } catch (_) {
      list[name] = value;
    }
  });
  return list;
}

// Apenas conexões locais diretas (sem passar pelo Cloudflare Tunnel) são confiadas sem PIN
function isLocalDirect(req) {
  return isLoopbackAddress(socketAddress(req)) && !req.headers['cf-connecting-ip'];
}

// Limite de tentativas: 10 PINs errados diferentes em 15 min bloqueiam aquele IP por 15 min.
// Contadores separados para Echo e Luna; repetir o mesmo PIN errado (cookie antigo, reconexão) conta uma vez.
// O segundo PIN (aprovações) só vem por cabeçalho, vale até para acesso local e bloqueia após 5 erros.
const PIN_SCOPES = {
  echo: { pin: () => ECHO_PIN, header: 'x-echo-pin', cookie: 'echo_pin', query: true, localBypass: true },
  luna: { pin: () => LUNA_PIN, header: 'x-luna-pin', cookie: 'luna_pin', query: true, localBypass: true },
  approval: { pin: () => ECHO_APPROVAL_PIN, header: 'x-echo-approval-pin', cookie: null, query: false, localBypass: false, maxFailures: 5 }
};
const PIN_FAIL_WINDOW_MS = 15 * 60 * 1000;
const PIN_BLOCK_MS = 15 * 60 * 1000;
const PIN_MAX_FAILURES = 10;
const pinFailures = { echo: new Map(), luna: new Map(), approval: new Map() };

function pinBlockRemainingMs(scope, req) {
  const key = clientAddress(req);
  const entry = pinFailures[scope].get(key);
  if (!entry) return 0;
  const now = Date.now();
  if (entry.blockedUntil) {
    if (entry.blockedUntil > now) return entry.blockedUntil - now;
    pinFailures[scope].delete(key);
    return 0;
  }
  if (now - entry.first > PIN_FAIL_WINDOW_MS) pinFailures[scope].delete(key);
  return 0;
}

function registerPinFailure(scope, req, candidates) {
  const key = clientAddress(req);
  const now = Date.now();
  let entry = pinFailures[scope].get(key);
  if (!entry || now - entry.first > PIN_FAIL_WINDOW_MS) {
    entry = { first: now, wrong: new Set(), blockedUntil: 0 };
    pinFailures[scope].set(key, entry);
  }
  candidates.forEach(value => entry.wrong.add(value));
  if (entry.wrong.size >= (PIN_SCOPES[scope].maxFailures || PIN_MAX_FAILURES) && !entry.blockedUntil) {
    entry.blockedUntil = now + PIN_BLOCK_MS;
    console.warn(`[PIN] ${scope}: ${key} bloqueado por ${PIN_BLOCK_MS / 60000} min após ${entry.wrong.size} tentativas erradas`);
  }
}

function pinCandidates(req, scope) {
  const cfg = PIN_SCOPES[scope];
  const cookies = cfg.cookie ? parseCookies(req.headers.cookie) : {};
  return [req.headers[cfg.header], cfg.query ? req.query?.pin : undefined, cfg.cookie ? cookies[cfg.cookie] : undefined]
    .filter(value => value !== undefined && value !== null && String(value).trim() !== '')
    .map(value => String(value).trim());
}

// Retorna 'ok', 'missing' (nenhum PIN enviado), 'wrong' ou 'blocked'
function checkPin(req, scope, { register = true } = {}) {
  if (PIN_SCOPES[scope].localBypass && isLocalDirect(req)) return 'ok';
  if (pinBlockRemainingMs(scope, req) > 0) return 'blocked';
  const candidates = pinCandidates(req, scope);
  if (candidates.length === 0) return 'missing';
  if (candidates.some(value => pinMatches(value, PIN_SCOPES[scope].pin()))) {
    pinFailures[scope].delete(clientAddress(req));
    return 'ok';
  }
  if (!register) return 'wrong';
  registerPinFailure(scope, req, candidates);
  return pinBlockRemainingMs(scope, req) > 0 ? 'blocked' : 'wrong';
}

function sendPinError(res, req, status, scope, message) {
  if (status === 'blocked') {
    const seconds = Math.ceil(pinBlockRemainingMs(scope, req) / 1000);
    res.setHeader('Retry-After', String(seconds));
    return res.status(429).json({
      ok: false,
      error: `Muitas tentativas de PIN. Tente de novo em ${Math.ceil(seconds / 60)} min.`,
      authRequired: true,
      retryAfterSeconds: seconds
    });
  }
  return res.status(401).json({ ok: false, error: message, authRequired: true });
}

function pinCookie(req, name, value) {
  const secure = isViaCloudflare(req) ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly${secure}`;
}

function isAuthorized(req) {
  return checkPin(req, 'echo') === 'ok';
}

function isAuthorizedLuna(req) {
  return checkPin(req, 'luna') === 'ok';
}

function requirePin(req, res, next) {
  const status = checkPin(req, 'echo');
  if (status === 'ok') return next();
  return sendPinError(res, req, status, 'echo', 'Acesso bloqueado: PIN de segurança inválido ou ausente.');
}

const { CalendarAuth } = require('./src/calendarAuth');
const { GoogleCalendar } = require('./src/connectors/googleCalendar');
const { CalendarService } = require('./src/calendarService');
const { createCalendarRoutes } = require('./src/calendarRoutes');
const calendarAuth = new CalendarAuth();
const calendarService = new CalendarService({ auth: calendarAuth, api: new GoogleCalendar(calendarAuth) });
const calendarRoutes = createCalendarRoutes({ auth: calendarAuth, service: calendarService, requirePin });
app.use('/api/calendar', calendarRoutes.router);

function requireLunaPin(req, res, next) {
  const status = checkPin(req, 'luna');
  if (status === 'ok') return next();
  return sendPinError(res, req, status, 'luna', 'Acesso bloqueado: PIN da Luna inválido ou ausente.');
}

const { LocationService, createLocationRoutes } = require('./src/location');
const locationService = new LocationService({ memory });
const locationRoutes = createLocationRoutes({ service: locationService, requirePin, requireLunaPin });
app.use('/api/location', locationRoutes.router);
// Expiração física da última posição, sem histórico nem coordenadas nos logs.
setInterval(() => { if (locationService.store.configured) { try { locationService.read(); } catch (_) {} } }, 60000).unref();

function requireAnyPin(req, res, next) {
  const echo = checkPin(req, 'echo', { register: false });
  const luna = checkPin(req, 'luna', { register: false });
  if (echo === 'ok' || luna === 'ok') return next();
  // Nenhum dos dois confere: a tentativa conta nos dois contadores
  const echoStatus = echo === 'wrong' ? checkPin(req, 'echo') : echo;
  const lunaStatus = luna === 'wrong' ? checkPin(req, 'luna') : luna;
  const blockedScope = echoStatus === 'blocked' ? 'echo' : (lunaStatus === 'blocked' ? 'luna' : null);
  if (blockedScope) return sendPinError(res, req, 'blocked', blockedScope);
  return sendPinError(res, req, 'wrong', 'echo', 'Acesso bloqueado: PIN inválido ou ausente.');
}

function verifyPinRoute(scope, okMessage, wrongMessage) {
  return (req, res) => {
    if (pinBlockRemainingMs(scope, req) > 0) return sendPinError(res, req, 'blocked', scope);
    const pin = String((req.body || {}).pin ?? '').trim();
    const expected = PIN_SCOPES[scope].pin();
    if (pinMatches(pin, expected)) {
      pinFailures[scope].delete(clientAddress(req));
      res.setHeader('Set-Cookie', pinCookie(req, PIN_SCOPES[scope].cookie, expected));
      return res.json({ ok: true, message: okMessage });
    }
    if (pin) registerPinFailure(scope, req, [pin]);
    const status = pinBlockRemainingMs(scope, req) > 0 ? 'blocked' : 'wrong';
    return sendPinError(res, req, status, scope, wrongMessage);
  };
}

// Endpoint para validar PIN vindo do celular (Echo)
app.post('/api/auth/verify', verifyPinRoute('echo', 'Autenticado com sucesso', 'PIN incorreto'));

app.get('/api/auth/status', (req, res) => {
  res.json({ ok: true, authorized: isAuthorized(req) });
});

// Endpoint para validar PIN vindo do celular (Luna)
app.post('/api/luna/auth/verify', verifyPinRoute('luna', 'Autenticada com sucesso!', 'PIN incorreto.'));

app.get('/api/luna/auth/status', (req, res) => {
  res.json({ ok: true, authorized: isAuthorizedLuna(req) });
});

// Rota dedicada da Luna
app.get('/luna', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'luna.html'));
});

// Sem PIN, quem vem de fora só recebe o que as telas de entrada do Echo e da Luna precisam
const PUBLIC_STATIC_PATHS = new Set([
  '/', '/index.html', '/app.js', '/styles.css', '/sw.js', '/manifest.json',
  '/icon-192.png', '/icon-512.png', '/icon.svg',
  '/location.js', '/location.css', '/luna', '/luna.html', '/luna.js', '/luna.css', '/manifest-luna.json', '/icon-luna.svg',
  // Personagens (Echo e Luna): as telas iniciais (com a tela de PIN) já carregam o robô, as roupas e a folha
  // Personagem; só desenho e código
  '/robo-motor.js', '/robo-roupas.js', '/robo-roupas-echo.js', '/robo-roupas-luna.js',
  '/robo-personagem.js', '/robo-personagem.css'
]);

// Quem abre uma página protegida sem o PIN recebe a tela de PIN (em vez do erro em texto)
function sendPinPage(res, req, status) {
  const blocked = status === 'blocked';
  const remainingMs = blocked ? pinBlockRemainingMs('echo', req) : 0;
  if (blocked) res.setHeader('Retry-After', String(Math.ceil(remainingMs / 1000)));
  res.setHeader('Cache-Control', 'no-store');
  return res.status(blocked ? 429 : 401).type('html').send(pinPage.renderPinPage({ blocked, retryMinutes: remainingMs / 60000 }));
}

app.use((req, res, next) => {
  if (req.path.startsWith('/api/') || PUBLIC_STATIC_PATHS.has(req.path)) return next();
  const status = checkPin(req, 'echo');
  if (status === 'ok') return next();
  if (pinPage.wantsPage(req)) return sendPinPage(res, req, status);
  return sendPinError(res, req, status, 'echo', 'Acesso bloqueado: PIN de segurança inválido ou ausente.');
});

app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('sw.js') || filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Gerenciador de Clientes SSE (Server-Sent Events)
let sseClients = [];

// Tracking de Múltiplos Agentes Simultâneos
const activeAgents = new Map();

function getActiveAgentsList() {
  const now = Date.now();
  const list = [];
  for (const [name, data] of activeAgents.entries()) {
    if (now - data.lastSeen > 20000) {
      activeAgents.delete(name);
    } else {
      list.push(name);
    }
  }
  return list;
}

// Estado Global Atual do Echo
let idleWatchdog = null;
let echoState = {
  mode: 'full', // 'full' (centro) ou 'info' (esquerda com dados na direita)
  state: 'idle', // 'idle', 'working', 'waiting', 'success', 'error'
  actionType: 'idle', // 'idle', 'research', 'executing', 'waiting', 'success', 'error'
  agentTheme: 'idle', // 'idle', 'claude', 'antigravity', 'codex', 'multi-agent'
  agent: 'ECHO',
  project: 'ESTRATÉGIA NERD',
  badge: 'STANDBY',
  title: 'Aguardando sessões de desenvolvimento...',
  detail: 'Nenhum agente ativo no momento',
  voiceMessage: '',
  timestamp: Date.now(),
  isMultiAgent: false,
  activeCount: 0,
  activeAgents: [],
  telemetry: {
    cpuPercent: 0,
    ramPercent: 0,
    ramUsedGb: 0,
    ramTotalGb: 0
  }
};

// Coleta rápida de telemetria do PC
function updateTelemetry() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const ramPercent = Math.round((usedMem / totalMem) * 100);
  const ramUsedGb = (usedMem / (1024 ** 3)).toFixed(1);
  const ramTotalGb = (totalMem / (1024 ** 3)).toFixed(1);

  // CPU percent aproximado baseado em cpus()
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  cpus.forEach(cpu => {
    for (let type in cpu.times) {
      total += cpu.times[type];
    }
    idle += cpu.times.idle;
  });
  const cpuPercent = Math.min(100, Math.max(5, Math.round((1 - idle / total) * 100) || 12));

  echoState.telemetry = {
    cpuPercent,
    ramPercent,
    ramUsedGb,
    ramTotalGb
  };

  // Se a CPU estiver acima de 90%, dispara alerta automático
  if (cpuPercent >= 90 && echoState.mode === 'full') {
    broadcastEvent('telemetry_alert', {
      type: 'cpu',
      badge: 'ALERTA DE HARDWARE',
      mainText: `CPU: ${cpuPercent}%`,
      subText: `RAM: ${ramPercent}% • ${ramUsedGb} GB em uso`,
      voiceText: `Alerta: CPU do computador atingiu ${cpuPercent}%!`
    });
  }
}

setInterval(updateTelemetry, 3000);
updateTelemetry();

// Envia dados para todos os celulares conectados
function broadcastState() {
  const payload = `data: ${JSON.stringify(echoState)}\n\n`;
  sseClients.forEach(client => client.res.write(payload));
}

function broadcastEvent(eventType, eventData) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(eventData)}\n\n`;
  sseClients.forEach(client => client.res.write(payload));
}

// Endpoint SSE para o Celular
// Sons opcionais em data/sounds/ (fora do repositório); sem o arquivo, o app usa os sons sintetizados
const SOUNDS_DIR = path.join(__dirname, 'data', 'sounds');
app.get('/api/sounds/:name', requirePin, (req, res) => {
  const match = /^([a-z]+)\.wav$/.exec(req.params.name || '');
  if (!match) return res.status(404).end();
  const filePath = path.join(SOUNDS_DIR, `${match[1]}.wav`);
  if (!fs.existsSync(filePath)) return res.status(404).end();
  res.setHeader('Cache-Control', 'private, max-age=604800');
  res.type('audio/wav');
  return res.sendFile(filePath);
});

app.get('/api/stream', requirePin, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const clientId = Date.now();
  // external: celular pela internet ou pela rede (o modo celular só espera quando há um conectado)
  const newClient = { id: clientId, res, external: !isLocalDirect(req) };
  sseClients.push(newClient);

  // Envia estado atual imediatamente ao conectar
  res.write(`data: ${JSON.stringify(echoState)}\n\n`);

  // Heartbeat a cada 5 segundos
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 5000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients = sseClients.filter(c => c.id !== clientId);
  });
});

// ========================================================
// MODO CELULAR: aprovar, negar e responder ao Claude Code pelo celular (Plano 2A)
// ========================================================
const approvals = require('./src/approvals');
const approvalStore = new approvals.ApprovalStore();
const phoneMode = { enabled: false }; // só em memória: volta desligado a cada reinício
const PUBLIC_ORIGIN = (process.env.ECHO_PUBLIC_ORIGIN || 'https://echo.tfr-info.com.br').replace(/\/$/, '');

function hasExternalClient() {
  return sseClients.some(client => client.external);
}

// Rotas que mudam algo exigem a origem da página presente e igual ao endereço do próprio Echo
function requireSameOrigin(req, res, next) {
  const origin = req.headers.origin;
  if (!origin) return res.status(403).json({ ok: false, error: 'Origem ausente.' });
  let originHost;
  try { originHost = new URL(origin).host; } catch (_) { return res.status(403).json({ ok: false, error: 'Origem inválida.' }); }
  const allowed = originHost === req.headers.host || (isViaCloudflare(req) && origin === PUBLIC_ORIGIN);
  if (!allowed) return res.status(403).json({ ok: false, error: 'Origem não permitida.' });
  return next();
}

function requireApprovalPin(req, res, next) {
  if (!ECHO_APPROVAL_PIN) return res.status(503).json({ ok: false, error: 'Segundo PIN não configurado no servidor.' });
  const status = checkPin(req, 'approval');
  if (status === 'ok') return next();
  return sendPinError(res, req, status, 'approval', 'Segundo PIN inválido ou ausente.');
}

// Notificações push (VAPID no .env; inscrições em data/push/, fora do git; ECHO_PUSH_FILE troca o arquivo nos testes)
const PUSH_FILE = process.env.ECHO_PUSH_FILE || path.join(__dirname, 'data', 'push', 'subscriptions.json');
let webpush = null;
if (process.env.ECHO_VAPID_PUBLIC_KEY && process.env.ECHO_VAPID_PRIVATE_KEY) {
  try {
    webpush = require('web-push');
    webpush.setVapidDetails(process.env.ECHO_VAPID_SUBJECT || PUBLIC_ORIGIN, process.env.ECHO_VAPID_PUBLIC_KEY, process.env.ECHO_VAPID_PRIVATE_KEY);
  } catch (err) {
    console.warn('⚠️ Notificações push indisponíveis:', err.message);
    webpush = null;
  }
}

function readSubscriptions() {
  try { return JSON.parse(fs.readFileSync(PUSH_FILE, 'utf8')); } catch (_) { return []; }
}

function writeSubscriptions(list) {
  fs.mkdirSync(path.dirname(PUSH_FILE), { recursive: true });
  fs.writeFileSync(PUSH_FILE, JSON.stringify(list, null, 2));
}

async function sendPushToAll(payload) {
  if (!webpush) return;
  const subscriptions = readSubscriptions();
  const expired = new Set();
  await Promise.all(subscriptions.map(sub => webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 120, urgency: 'high' }).catch(err => {
    // Inscrição vencida ou removida no celular: sai da lista
    if (err.statusCode === 404 || err.statusCode === 410) expired.add(sub.endpoint);
    else console.warn('[PUSH] falha ao enviar:', err.statusCode || err.message);
  })));
  if (expired.size) writeSubscriptions(readSubscriptions().filter(sub => !expired.has(sub.endpoint)));
}

function showApprovalState(item) {
  const question = item.kind === 'question';
  echoState.mode = 'info';
  echoState.state = 'waiting';
  echoState.actionType = 'waiting';
  echoState.badge = question ? 'PERGUNTA DO CLAUDE' : 'APROVAÇÃO NECESSÁRIA';
  echoState.title = question ? 'Claude Code fez uma pergunta' : 'Claude Code precisa de aprovação';
  echoState.detail = item.project ? `${item.summary} • ${item.project}` : item.summary;
  echoState.timestamp = Date.now();
  broadcastState();
}

function clearApprovalState(outcome) {
  if (echoState.state !== 'waiting') return;
  echoState.mode = 'full';
  echoState.state = 'working';
  echoState.actionType = 'research';
  echoState.badge = 'EXECUTANDO';
  echoState.title = outcome === 'deny' ? 'Pedido negado pelo celular' : 'Claude Code continua o trabalho';
  echoState.detail = outcome === 'expired' || outcome === 'terminal' ? 'Resposta pelo terminal' : 'Resposta enviada pelo celular';
  echoState.timestamp = Date.now();
  broadcastState();
}

// O celular alcança o pedido se estiver conectado agora ou se puder ser avisado por notificação (tela bloqueada)
function phoneReachable() {
  return hasExternalClient() || (Boolean(webpush) && readSubscriptions().length > 0);
}

// Pedido do hook (só do próprio PC). Sem modo celular, segundo PIN ou celular alcançável, responde na hora
app.post('/api/approvals/request', async (req, res) => {
  if (!isLocalDirect(req)) return res.status(403).json({ ok: false, error: 'Somente o hook local cria pedidos.' });
  const { kind, session_id: sessionId, cwd, tool_name: toolName, tool_input: toolInput } = req.body || {};
  const skip = (reason) => {
    console.log(`[APROVAÇÃO] pedido não enviado ao celular (${reason}): o terminal pergunta`);
    return res.json({ decision: null, reason });
  };
  if (!ECHO_APPROVAL_PIN) return skip('sem_segundo_pin');
  if (!phoneMode.enabled) return skip('modo_desligado');
  if (!phoneReachable()) return skip('sem_celular');

  const isQuestion = kind === 'question';
  const questions = isQuestion ? approvals.normalizeQuestions(toolInput) : [];
  if (isQuestion && !questions.length) return skip('pergunta_invalida');

  const item = approvalStore.create({
    kind: isQuestion ? 'question' : 'permission',
    sessionId,
    project: approvals.projectName(cwd),
    summary: isQuestion ? (questions[0].header || 'Pergunta') : approvals.summarizeTool(toolName, toolInput),
    questions
  });
  console.log(`[APROVAÇÃO] pedido de ${item.kind} criado: ${item.summary}`);
  // O hook desistiu antes da resposta (sessão interrompida): pedido cancelado
  res.on('close', () => { if (!res.writableEnded) approvalStore.cancel(item.id); });

  showApprovalState(item);
  broadcastEvent('approval_request', approvalStore.publicView(item));
  sendPushToAll(approvals.buildPushPayload(item)).catch(() => {});

  const result = await approvalStore.wait(item.id, approvals.WAIT_MS);
  console.log(`[APROVAÇÃO] pedido de ${item.kind} encerrado: ${result.outcome}`);
  broadcastEvent('approval_resolved', { id: item.id, outcome: result.outcome });
  clearApprovalState(result.outcome);
  if (res.writableEnded || res.destroyed) return undefined;
  const decision = ['allow', 'deny', 'answer'].includes(result.outcome) ? result.outcome : null;
  return res.json({ decision, ...(result.answers ? { answers: result.answers } : {}) });
});

app.get('/api/approvals', requirePin, (req, res) => {
  res.json({
    ok: true,
    configured: Boolean(ECHO_APPROVAL_PIN),
    push: Boolean(webpush),
    mode: { enabled: phoneMode.enabled },
    pending: approvalStore.list()
  });
});

// Ligar o modo celular pede os dois PINs; desligar, só o do Echo
app.post('/api/approvals/mode', requirePin, requireSameOrigin, (req, res) => {
  const turnOff = () => {
    phoneMode.enabled = false;
    console.log('[APROVAÇÃO] modo celular desligado');
    broadcastEvent('approval_mode', { enabled: false });
    return res.json({ ok: true, enabled: false });
  };
  if (!req.body?.enabled) return turnOff();
  return requireApprovalPin(req, res, () => {
    phoneMode.enabled = true;
    console.log('[APROVAÇÃO] modo celular ligado');
    broadcastEvent('approval_mode', { enabled: true });
    return res.json({ ok: true, enabled: true });
  });
});

// Permitir, negar e responder pedem o segundo PIN; devolver ao terminal não comanda nada no PC
app.post('/api/approvals/:id/decision', requirePin, requireSameOrigin, (req, res) => {
  const action = String(req.body?.action || '');
  const apply = () => {
    const result = approvalStore.resolve(req.params.id, { action, answers: req.body?.answers });
    if (!result.ok) {
      const error = result.reason === 'not_pending' ? 'Este pedido não está mais pendente.' : 'Resposta inválida.';
      return res.status(409).json({ ok: false, error, reason: result.reason });
    }
    return res.json({ ok: true });
  };
  if (action === 'terminal') return apply();
  return requireApprovalPin(req, res, apply);
});

app.get('/api/push/key', requirePin, (req, res) => {
  res.json({ ok: Boolean(webpush), publicKey: webpush ? process.env.ECHO_VAPID_PUBLIC_KEY : null });
});

app.post('/api/push/subscribe', requirePin, requireSameOrigin, (req, res) => {
  if (!webpush) return res.status(503).json({ ok: false, error: 'Notificações não configuradas no servidor.' });
  const sub = req.body?.subscription;
  if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) {
    return res.status(400).json({ ok: false, error: 'Inscrição inválida.' });
  }
  const list = readSubscriptions().filter(s => s.endpoint !== sub.endpoint);
  list.push({ endpoint: sub.endpoint, keys: { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) }, createdAt: new Date().toISOString() });
  writeSubscriptions(list.slice(-10));
  return res.json({ ok: true });
});

// Endpoint Webhook para receber eventos dos Agentes de IA
// Os agentes enviam do próprio PC (acesso local direto); de fora, só com PIN
app.post('/api/events', requirePin, (req, res) => {
  const { agent, event, actionType, project, tool, command, error, message } = req.body;
  console.log(`[EVENTO RECEBIDO] ${agent || 'Desconhecido'} (${actionType || event}): ${command || tool || message || 'Ação'}`);

  const agentKey = (agent || 'AGENTE').toUpperCase();
  const projectKey = (project || 'ESTRATÉGIA NERD').toUpperCase();

  // Atualiza ou encerra o registro do agente no Map de agentes ativos
  if (event === 'Stop' || event === 'completed' || event === 'success') {
    activeAgents.delete(agentKey);
  } else {
    activeAgents.set(agentKey, {
      name: agentKey,
      project: projectKey,
      lastSeen: Date.now(),
      actionType: actionType || 'research',
      event: event
    });
  }

  const currentActiveAgents = getActiveAgentsList();
  const isMulti = currentActiveAgents.length > 1;

  echoState.timestamp = Date.now();
  echoState.isMultiAgent = isMulti;
  echoState.activeCount = currentActiveAgents.length;
  echoState.activeAgents = currentActiveAgents;
  echoState.agent = isMulti ? currentActiveAgents.join(' + ') : agentKey;
  echoState.project = projectKey;

  // Identificação do Tema da IA
  const rawAgent = (agent || '').toLowerCase();
  if (isMulti) {
    echoState.agentTheme = 'multi-agent';
  } else if (rawAgent.includes('claude')) {
    echoState.agentTheme = 'claude';
  } else if (rawAgent.includes('antigravity') || rawAgent.includes('gemini')) {
    echoState.agentTheme = 'antigravity';
  } else if (rawAgent.includes('codex')) {
    echoState.agentTheme = 'codex';
  } else {
    echoState.agentTheme = 'idle';
  }

  // Limpa watchdog anterior
  if (idleWatchdog) {
    clearTimeout(idleWatchdog);
    idleWatchdog = null;
  }

  if (event === 'SessionStart' || event === 'start') {
    echoState.mode = 'full';
    echoState.state = 'working';
    echoState.actionType = 'research';
    echoState.badge = isMulti ? `${currentActiveAgents.length} AGENTES` : 'INICIADO';
    echoState.title = isMulti ? `${echoState.agent} ativos em paralelo` : `${echoState.agent} iniciou uma sessão de trabalho`;
    echoState.detail = `Projeto: ${echoState.project}`;
  } 
  else if (event === 'PreToolUse' || event === 'working' || event === 'tool_call' || event === 'UserPromptSubmit') {
    echoState.mode = 'full';
    echoState.state = 'working';
    
    // Diferencial: Pesquisando (leitura) vs Implementando (escrita)
    if (actionType === 'executing') {
      echoState.actionType = 'executing';
      echoState.badge = isMulti ? 'MULTI: ESCREVENDO' : 'IMPLEMENTANDO';
      echoState.title = isMulti ? `${echoState.agent} executando em paralelo` : `${echoState.agent} implementando...`;
    } else {
      echoState.actionType = 'research';
      echoState.badge = isMulti ? 'MULTI: PESQUISA' : 'PESQUISANDO';
      echoState.title = isMulti ? `${echoState.agent} pesquisando em paralelo` : `${echoState.agent} pesquisando...`;
    }
    
    echoState.detail = command || tool || message || 'Lendo e analisando código...';

    // Watchdog cooperativo: se não receber novos eventos em 20s, reavalia agentes ativos
    idleWatchdog = setTimeout(() => {
      const remaining = getActiveAgentsList();
      if (remaining.length === 0) {
        echoState.state = 'idle';
        echoState.actionType = 'idle';
        echoState.agentTheme = 'idle';
        echoState.badge = 'STANDBY';
        echoState.title = 'Aguardando próxima sessão...';
        echoState.detail = 'Nenhum agente ativo';
        echoState.isMultiAgent = false;
        echoState.activeCount = 0;
        echoState.activeAgents = [];
        broadcastState();
      } else {
        echoState.activeCount = remaining.length;
        echoState.activeAgents = remaining;
        echoState.isMultiAgent = remaining.length > 1;
        if (echoState.isMultiAgent) {
          echoState.agent = remaining.join(' + ');
          echoState.agentTheme = 'multi-agent';
          echoState.badge = `${remaining.length} AGENTES`;
          echoState.title = `${echoState.agent} em execução paralela`;
        } else {
          const single = remaining[0];
          echoState.agent = single;
          const raw = single.toLowerCase();
          echoState.agentTheme = raw.includes('claude') ? 'claude' : (raw.includes('antigravity') || raw.includes('gemini') ? 'antigravity' : (raw.includes('codex') ? 'codex' : 'idle'));
          echoState.badge = 'EXECUTANDO';
          echoState.title = `${echoState.agent} em execução...`;
        }
        broadcastState();
      }
    }, 20000);
  } 
  else if (event === 'waiting_user' || event === 'ask_permission' || event === 'approval_needed') {
    echoState.mode = 'info';
    echoState.state = 'waiting';
    echoState.actionType = 'waiting';
    echoState.badge = 'APROVAÇÃO NECESSÁRIA';
    echoState.title = `${agentKey} precisa de aprovação explícita`;
    echoState.detail = command || message || 'Comando aguardando autorização no terminal';
    echoState.voiceMessage = 'Mestre, preciso da sua aprovação no PC!';
  } 
  else if (event === 'Stop' || event === 'completed' || event === 'success') {
    const remaining = getActiveAgentsList();
    if (remaining.length > 0) {
      echoState.activeCount = remaining.length;
      echoState.activeAgents = remaining;
      echoState.isMultiAgent = remaining.length > 1;
      if (echoState.isMultiAgent) {
        echoState.agent = remaining.join(' + ');
        echoState.agentTheme = 'multi-agent';
        echoState.badge = `${remaining.length} AGENTES`;
        echoState.title = `${agentKey} finalizou; outros agentes continuam`;
      } else {
        const single = remaining[0];
        echoState.agent = single;
        const raw = single.toLowerCase();
        echoState.agentTheme = raw.includes('claude') ? 'claude' : (raw.includes('antigravity') || raw.includes('gemini') ? 'antigravity' : (raw.includes('codex') ? 'codex' : 'idle'));
        echoState.badge = 'EXECUTANDO';
        echoState.title = `${agentKey} finalizou; ${single} continua`;
      }
      echoState.detail = message || 'Sessão paralela ativa';
    } else {
      echoState.mode = 'full';
      echoState.state = 'success';
      echoState.actionType = 'success';
      echoState.badge = 'CONCLUÍDO';
      echoState.title = 'Tarefa finalizada com sucesso!';
      echoState.detail = message || 'Todos os passos e verificações foram concluídos';
      echoState.voiceMessage = 'Tudo pronto e testado com sucesso!';
      echoState.isMultiAgent = false;
      echoState.activeCount = 0;
      echoState.activeAgents = [];

      // Volta ao descanso após 20 segundos
      idleWatchdog = setTimeout(() => {
        if (echoState.state === 'success') {
          echoState.state = 'idle';
          echoState.actionType = 'idle';
          echoState.agentTheme = 'idle';
          echoState.badge = 'STANDBY';
          echoState.title = 'Aguardando próxima sessão...';
          echoState.detail = 'Nenhum agente ativo';
          broadcastState();
        }
      }, 20000);
    }
  } 
  else if (event === 'error') {
    echoState.mode = 'info';
    echoState.state = 'error';
    echoState.actionType = 'error';
    echoState.badge = 'ERRO';
    echoState.title = `${agentKey} encontrou uma falha`;
    echoState.detail = error || message || 'Erro na execução';
    echoState.voiceMessage = 'Atenção mestre, ocorreu um erro no terminal.';
  }

  broadcastState();
  res.json({ ok: true, state: echoState });
});

// Endpoint de Síntese de Voz (Motor Primário: Microsoft Edge Neural TTS com suporte a vozes)
app.post('/api/speak', requireAnyPin, async (req, res) => {
  const { text, voice } = req.body || {};
  if (!text) return res.status(400).json({ error: 'Texto não fornecido' });

  const voiceName = voice || 'pt-BR-AntonioNeural';

  // 1. Motor Primário: Microsoft Edge Neural TTS em streaming
  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text, { rate: '+6%' });

    const chunks = [];
    audioStream.on('data', chunk => chunks.push(chunk));
    audioStream.on('end', () => {
      try { tts.close(); } catch (e) {}
      const audioBuffer = Buffer.concat(chunks);
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length,
        'Cache-Control': 'no-cache'
      });
      res.send(audioBuffer);
    });
    audioStream.on('error', (err) => {
      console.warn('Erro no stream Edge TTS:', err.message);
      try { tts.close(); } catch (e) {}
      generateOpenAISpeech(text, res);
    });
    return;
  } catch (err) {
    console.warn('Falha ao instanciar Edge TTS, tentando OpenAI fallback:', err.message);
  }

  // 3. Fallback 2: OpenAI TTS (se houver chave e créditos)
  generateOpenAISpeech(text, res);
});

async function generateOpenAISpeech(text, res) {
  if (!OPENAI_API_KEY) {
    return res.status(503).json({ error: 'Nenhum motor de TTS disponível' });
  }
  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: 'echo',
        speed: 1.15
      })
    });
    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: 'Erro OpenAI TTS', details: errText });
    }
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length
    });
    res.send(audioBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Endpoint de Briefing Consolidado do Sistema (Serviços, Backups, Forge e Emails)
app.post('/api/briefing', requirePin, async (req, res) => {
  try {
    const report = await briefing.getDailyBriefing();
    const reply = report.fala_sugerida;
    const card = report.card;
    const accessory = 'lupa';

    try {
      await memory.addMessage('user', 'Executar briefing e verificações do sistema');
      await memory.addMessage('model', reply);
    } catch (_) {}

    echoState.voiceOrigin = 'converse';
    echoState.voiceMessage = reply;
    broadcastState();
    broadcastEvent('mascot_state', { accessory, text: reply });

    return res.json({
      ok: true,
      reply,
      accessory,
      card,
      dados: report.dados,
      source: 'briefing-engine'
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Endpoint de Conversação / Resposta Inteligente do Echo com Gemini Function Calling & Memória
app.post('/api/converse', requirePin, locationRoutes.converse('echo'), calendarRoutes.converse, navigation.createNavigationMiddleware(memory), async (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'Mensagem vazia' });

  const textLower = message.toLowerCase().trim();
  const calendarIntent = /\b(agenda|compromisso|reuni[aã]o|evento|dentista)\b|^(?:echo[, ]+)?(?:marque|agende|remarque)\b/i.test(message);

  // 1. Respostas instantâneas para saudações, sono e telemetria básica
  let quickReply = null;
  let quickAccessory = 'none';
  let quickState = null;
  let quickCard = null;

  if (/^(boa noite|vai dormir|dormir|hora de dormir|modo soneca|soneca|descanse)/i.test(textLower)) {
    quickReply = "Boa noite, Mestre! Entrando em modo soneca... Bons sonhos!";
    quickState = 'sleeping';
    quickCard = {
      badge: 'MODO SONECA',
      title: 'Dormindo... zZz',
      detail1: 'Toque na tela para acordar',
      detail2: 'Repouso da CPU e Tela'
    };
  } else if (/^(bom dia|olá|ola|e aí|e ai|fala echo|opa)/i.test(textLower)) {
    quickReply = "Bom dia, Mestre! Estratégia Nerd online e todos os sistemas operando!";
  } else if (/^(boa tarde)/i.test(textLower)) {
    quickReply = "Boa tarde, Mestre! Monitorando tudo por aqui.";
  } else if (/como est[aá] o (computador|pc)|status do pc|telemetria|\b(cpu|ram)\b/i.test(textLower)) {
    quickReply = `O computador está com ${echoState.telemetry.cpuPercent}% de CPU e ${echoState.telemetry.ramPercent}% de memória RAM em uso.`;
    quickAccessory = 'lupa';
    quickCard = {
      badge: 'TELEMETRIA PC',
      title: `CPU: ${echoState.telemetry.cpuPercent}%`,
      progress: Number(echoState.telemetry.cpuPercent),
      rows: [
        { label: 'CPU', value: `${echoState.telemetry.cpuPercent}%`, status: Number(echoState.telemetry.cpuPercent) >= 90 ? 'error' : 'ok' },
        { label: 'RAM', value: `${echoState.telemetry.ramPercent}% em uso`, status: Number(echoState.telemetry.ramPercent) >= 90 ? 'warn' : 'ok' }
      ]
    };
  } else if (/est[aá] me ouvindo|me ouve|teste de voz/i.test(textLower)) {
    quickReply = "Estou te ouvindo perfeitamente, Mestre!";
  } else if (/briefing|verificar sistema|verificações|verificacoes|check-in|status do dia|relat[oó]rio geral/i.test(textLower)) {
    const report = await briefing.getDailyBriefing();
    quickReply = report.fala_sugerida;
    quickAccessory = 'lupa';
    quickCard = report.card;
  } else if (/obrigado|valeu|show|perfeito/i.test(textLower)) {
    quickReply = "Sempre às ordens, Mestre!";
    quickAccessory = 'celebration';
  }

  if (quickReply) {
    try {
      await memory.addMessage('user', message);
      await memory.addMessage('model', quickReply);
    } catch (_) {}

    echoState.voiceOrigin = 'converse';
    echoState.voiceMessage = quickReply;
    if (quickState === 'sleeping') {
      echoState.state = 'sleeping';
    }
    broadcastState();
    broadcastEvent('mascot_state', { accessory: quickAccessory, text: quickReply, state: quickState });
    return res.json({
      ok: true,
      reply: quickReply,
      accessory: quickAccessory,
      card: quickCard,
      state: quickState,
      source: 'fast-local'
    });
  }

  // Notifica o mascote para animação de digitação/pensamento
  broadcastEvent('mascot_state', { accessory: 'typing', text: 'Processando...' });

  // 2. Consulta inteligente via Google Gemini com Function Calling e Memória Persistente
  if (GEMINI_API_KEY) {
    try {
      // Carrega histórico recente e preferências da memória
      let history = [];
      let prefs = {};
      try {
        history = await memory.getRecentHistory(6);
        prefs = await memory.getAllPreferences();
      } catch (_) {}

      const prefsStr = Object.keys(prefs).length > 0
        ? `Preferências salvas do Mestre: ${JSON.stringify(prefs)}.`
        : 'Nenhuma preferência específica gravada ainda.';

      const systemPrompt = `Você é o Echo, o mascote físico e companheiro de mesa do ecossistema Estratégia Nerd.
Você é leal, bem-humorado, geek, prestativo e carismático. Chama o usuário respeitosamente de 'Mestre'.
INFORMAÇÕES EM TEMPO REAL:
- Hardware do computador: CPU em ${echoState.telemetry.cpuPercent}%, RAM em ${echoState.telemetry.ramPercent}%.
- Projeto ativo na tela: ${echoState.project}.
- ${prefsStr}
SUAS FERRAMENTAS DISPONÍVEIS (Function Calling):
- consultar_agenda_google: consultar eventos da agenda principal. Hoje é ${new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())}; use datas absolutas e horário de Brasília.
- preparar_evento_google: preparar criação, edição ou exclusão, SEM salvar ainda. Peça título, datas e horários que faltarem, não invente duração ou data. Para edição/exclusão, busque por título e período. Para recorrência, pergunte ocorrência ou série. Nunca confirme operações por ferramenta; a confirmação vem de um novo comando do usuário ou botão.
- executar_briefing_sistema: para executar um relatório geral com saudação, status de todos os 24 serviços e bancos, backups/tarefas que rodaram e tarefas pendentes no The Forge.
- consultar_saldos_bancos: para saldos de todos os bancos do Strategy Hub (Mercado Pago, Itaú, XP, PicPay, etc.) e total consolidado.
- consultar_cartoes_credito: para faturas abertas, limites e vencimentos de cartões.
- consultar_contas_a_pagar: para despesas pendentes do mês.
- consultar_projetos_forge: para lista de projetos e progresso no The Forge.
- consultar_tarefas_forge: para tarefas pendentes ou concluídas de projetos no The Forge.
- consultar_status_backup_forge: para checar integridade dos backups (estritamente somente-leitura).
- consultar_monitor_servicos: para checar em tempo real se os apps, bancos de dados, túneis Cloudflare e integrações dos projetos estão online.
- consultar_agendamento_posts: para posts agendados do Blog e Instagram do Estratégia Nerd.
- consultar_metricas_blog: para visualizações, artigos e categorias do blog.
- consultar_metricas_instagram: para posts, curtidas, comentários e seguidores do Instagram.
- consultar_treino_e_streak_gym_os: para treino do dia, missão, streak de treinos e nível/XP no Gym OS.
- gravar_preferencia_usuario: para guardar na memória de longo prazo fatos ditos pelo Mestre.
REGRAS OBRIGATÓRIAS:
- Responda SEMPRE em português do Brasil de forma concisa e natural para ser falada em áudio (no MÁXIMO 1 a 2 frases curtas).
- Não use emojis, asteriscos, markdown, tabelas ou formatações pesadas (o texto será sintetizado por voz diretamente).
- Sempre que a pergunta exigir dados dos sistemas locais, USE as ferramentas correspondentes.
- No briefing do sistema, mencione SEMPRE em voz alta os serviços online, as tarefas agendadas/backups que rodaram e a contagem de tarefas pendentes no Forge.`;

      // Monta histórico de mensagens para a chamada
      const contents = [];
      for (const h of history) {
        contents.push({
          role: h.role === 'model' ? 'model' : 'user',
          parts: [{ text: h.content }]
        });
      }
      contents.push({
        role: 'user',
        parts: [{ text: `${systemPrompt}\n\nMensagem do Mestre: "${message}"` }]
      });

      const geminiTools = [
        {
          functionDeclarations: tools.functionDeclarations
        }
      ];

      const models = ['gemini-flash-lite-latest', 'gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
      let finalReply = null;
      let finalAccessory = 'none';
      let finalCard = null;

      for (const model of models) {
        try {
          const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
          const response = await fetch(geminiEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': GEMINI_API_KEY
            },
            body: JSON.stringify({
              contents,
              tools: geminiTools,
              generationConfig: {
                // Propostas da agenda incluem datas e campos estruturados.
                maxOutputTokens: 1024,
                temperature: 0.6
              }
            })
          });

          if (!response.ok) {
            continue;
          }

          const data = await response.json();
          const candidateParts = data.candidates?.[0]?.content?.parts || [];
          const functionCallPart = candidateParts.find(p => p.functionCall);

          if (functionCallPart) {
            const fc = functionCallPart.functionCall;
            if (['consultar_agenda_google', 'preparar_evento_google'].includes(fc.name)) {
              // Resultados da agenda não vão para SSE, histórico ou uma segunda chamada ao modelo.
              return calendarRoutes.handleTool(req, res, fc.name, fc.args || {});
            }
            console.log(`[ECHO TOOLS] Executando tool: ${fc.name}`, fc.args);

            // Animação de Lupa/Inspeção no Mascote enquanto a ferramenta é consultada
            broadcastEvent('mascot_state', { accessory: 'lupa', text: `Consultando ${fc.name}...` });

            const toolResult = await tools.executeTool(fc.name, fc.args || {});
            // Ações pertencem somente à resposta HTTP deste pedido, nunca ao SSE.
            if (['iniciar_viagem_trabalho', 'abrir_waze'].includes(fc.name)) {
              return res.json(toolResult);
            }

            // Define acessório temático e cartão estruturado baseado na ferramenta
            if (['consultar_saldos_bancos', 'consultar_cartoes_credito', 'consultar_contas_a_pagar'].includes(fc.name)) {
              finalAccessory = 'printer';
            } else if (['consultar_treino_e_streak_gym_os', 'gravar_preferencia_usuario'].includes(fc.name)) {
              finalAccessory = 'celebration';
            } else {
              finalAccessory = 'lupa';
            }

            // Cartão com os dados que a ferramenta devolveu (src/cards.js)
            finalCard = cards.buildToolCard(fc.name, toolResult) || finalCard;

            // Segunda rodada: devolve o resultado da tool para o Gemini sintetizar a fala
            contents.push({ role: 'model', parts: candidateParts });
            contents.push({
              role: 'user',
              parts: [
                {
                  functionResponse: {
                    name: fc.name,
                    response: {
                      name: fc.name,
                      content: toolResult
                    }
                  }
                }
              ]
            });

            const followUpRes = await fetch(geminiEndpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': GEMINI_API_KEY
              },
              body: JSON.stringify({
                contents,
                tools: geminiTools,
                generationConfig: {
                  maxOutputTokens: 150,
                  temperature: 0.6
                }
              })
            });

            if (followUpRes.ok) {
              const followUpData = await followUpRes.json();
              const text = followUpData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
              if (text) {
                finalReply = text.replace(/[*#_`]/g, '');
                break;
              }
            }
          } else {
            // Resposta conversacional direta sem ferramentas
            const text = candidateParts[0]?.text?.trim();
            if (text) {
              if (calendarIntent) {
                const clarification = text.includes('?') && !/\b(?:agendad|marcad|criad|alterad|exclu[ií]d|cancelad|salv|atualizad)/i.test(text);
                return res.json({ ok: true, source: 'google-calendar', reply: clarification ? text.replace(/[*#_`]/g, '') : 'Sua agenda ainda não foi alterada ou consultada. Informe o compromisso, a data e o horário para preparar o pedido.' });
              }
              finalReply = text.replace(/[*#_`]/g, '');
              break;
            }
          }
        } catch (e) {
          console.warn(`Erro no modelo Gemini ${model}:`, e.message);
        }
      }

      if (finalReply) {
        // Grava histórico na memória SQLite
        try {
          await memory.addMessage('user', message);
          await memory.addMessage('model', finalReply);
        } catch (_) {}

        echoState.voiceOrigin = 'converse';
        echoState.voiceMessage = finalReply;
        broadcastState();
        broadcastEvent('mascot_state', { accessory: finalAccessory, text: finalReply, card: finalCard });
        return res.json({
          ok: true,
          reply: finalReply,
          accessory: finalAccessory,
          card: finalCard,
          source: 'gemini-tools'
        });
      }
    } catch (err) {
      console.warn('Erro ao processar conversa no Gemini:', err.message);
    }
  }

  if (calendarIntent) return res.json({ ok: true, source: 'google-calendar', reply: 'Não consegui interpretar o pedido da agenda. Diga o compromisso e as datas ou use o botão Agenda para consultar.' });
  // Fallback amigável
  const fallback = "Entendido, Mestre! Processando aqui no Estratégia Nerd.";
  echoState.voiceOrigin = 'converse';
  echoState.voiceMessage = fallback;
  broadcastState();
  broadcastEvent('mascot_state', { accessory: 'none', text: fallback });
  return res.json({ ok: true, reply: fallback, accessory: 'none', source: 'fallback' });
});

// Endpoint exclusivo de Conversação da Luna (Assistente pessoal inteligente, carinhosa e dedicada)
app.post('/api/luna/converse', requireLunaPin, locationRoutes.converse('luna'), async (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'Mensagem vazia' });

  const textLower = message.toLowerCase().trim();

  // 1. Respostas rápidas para saudações e descanso
  let quickReply = null;
  let quickState = null;

  if (/^(boa noite|vai dormir|dormir|hora de dormir|modo soneca|soneca|descanse)/i.test(textLower)) {
    quickReply = "Boa noite! Vou descansar um pouquinho. Bons sonhos e até amanhã!";
    quickState = 'sleeping';
  } else if (/^(bom dia)/i.test(textLower)) {
    quickReply = "Bom dia! Que seu dia seja maravilhoso e muito produtivo!";
  } else if (/^(boa tarde)/i.test(textLower)) {
    quickReply = "Boa tarde! Como está sendo o seu dia até agora?";
  } else if (/^(ol[aá]|oi|e a[ií]|opa)/i.test(textLower)) {
    quickReply = "Oi! Como posso te ajudar hoje?";
  } else if (/obrigad[ao]|valeu|show|perfeito/i.test(textLower)) {
    quickReply = "De nada! É sempre um prazer enorme poder ajudar!";
  } else if (/est[aá] me ouvindo|me ouve|teste de voz/i.test(textLower)) {
    quickReply = "Estou te ouvindo perfeitamente! Pode falar.";
  } else if (/quem [eé] voc[eê]|seu nome/i.test(textLower)) {
    quickReply = "Eu sou a Luna, sua assistente pessoal! Estou aqui para te ajudar com dúvidas, ideias e o que você precisar.";
  }

  if (quickReply) {
    return res.json({
      ok: true,
      reply: quickReply,
      state: quickState,
      voice: 'pt-BR-ThalitaNeural',
      source: 'fast-local'
    });
  }

  // 2. Consulta de clima em tempo real se a pergunta for sobre tempo/clima/chuva/temperatura
  const isWeatherQuestion = /clima|tempo|previs[aã]o|chuva|temperatura|vai chover|chovendo|calor|frio|guarda[- ]chuva/i.test(textLower);
  let weatherData = null;
  let weatherContext = '';

  if (isWeatherQuestion) {
    try {
      const weather = require('./src/connectors/weather');
      weatherData = await weather.getWeather();
      if (weatherData && weatherData.ok) {
        weatherContext = `\n[INFORMAÇÃO EM TEMPO REAL SOBRE O CLIMA]: Em ${weatherData.cidade}, a temperatura agora é de ${weatherData.temperatura}°C (sensação térmica de ${weatherData.sensacao}°C), umidade de ${weatherData.umidade}%, vento ${weatherData.vento} e o tempo está ${weatherData.condicao.toLowerCase()}. Hoje a máxima chega a ${weatherData.maxima}°C e a mínima a ${weatherData.minima}°C, com probabilidade de chuva de ${weatherData.probabilidade_chuva}%. Responda à pergunta dela de forma super carinhosa, clara e direta usando esses dados exatos.`;
      }
    } catch (e) {
      console.warn('[LUNA] Erro ao obter dados do clima:', e.message);
    }
  }

  // 3. Consulta inteligente via Google Gemini
  if (GEMINI_API_KEY) {
    try {
      const systemPrompt = `Você é a Luna, uma mascote e assistente pessoal amigável, inteligente, carinhosa, gentil e muito prestativa.
Você foi criada com muito carinho para ser a companheira e ajudante do dia a dia dela.
Seu papel é responder dúvidas práticas, curiosidades, clima e previsão do tempo, dicas de culinária e receitas, organização de rotina, resumos, bem-estar ou simplesmente bater um papo leve e acolhedor.
REGRAS OBRIGATÓRIAS:
- Responda SEMPRE em português do Brasil com simpatia, doçura e clareza.
- Seja concisa e direta (no máximo 2 a 3 frases curtas e completas), pois sua resposta será sintetizada diretamente por voz neural.
- Não use jargões técnicos de computador, programação, códigos ou coisas do mundo hacker/nerd.
- Não use emojis, asteriscos, markdown (#, *, _), listas com hifens ou tabelas, pois o texto será falado em voz alta.
- Mantenha sempre um tom alegre, educado, empático e prestativo.`;

      const userMessage = weatherContext ? `${message}\n${weatherContext}` : message;
      const contents = [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\nPergunta dela: "${userMessage}"` }]
        }
      ];

      const models = ['gemini-flash-lite-latest', 'gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
      let finalReply = null;

      for (const model of models) {
        try {
          const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
          const response = await fetch(geminiEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': GEMINI_API_KEY
            },
            body: JSON.stringify({
              contents,
              generationConfig: {
                maxOutputTokens: 140,
                temperature: 0.7
              }
            })
          });

          if (!response.ok) continue;

          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text) {
            finalReply = text.replace(/[*#_`]/g, '');
            break;
          }
        } catch (e) {
          console.warn(`[LUNA] Erro no modelo ${model}:`, e.message);
        }
      }

      if (finalReply) {
        return res.json({
          ok: true,
          reply: finalReply,
          voice: 'pt-BR-ThalitaNeural',
          source: 'gemini'
        });
      }
    } catch (err) {
      console.warn('[LUNA] Erro ao processar conversa no Gemini:', err.message);
    }
  }

  // Fallback amigável (se for clima e a API de clima respondeu, usa o resumo dela)
  if (isWeatherQuestion && weatherData && weatherData.ok) {
    return res.json({
      ok: true,
      reply: weatherData.resumo_fala,
      voice: 'pt-BR-ThalitaNeural',
      source: 'weather-direct'
    });
  }

  const fallback = "Não consegui processar a resposta agora, mas estou aqui com você! Pode perguntar de novo?";
  return res.json({
    ok: true,
    reply: fallback,
    voice: 'pt-BR-ThalitaNeural',
    source: 'fallback'
  });
});

// Obtém o IP da rede Wi-Fi local para o QR Code
function getLocalWifiIp() {
  const interfaces = os.networkInterfaces();
  for (let iface in interfaces) {
    for (let alias of interfaces[iface]) {
      if (alias.family === 'IPv4' && !alias.internal && (alias.address.startsWith('192.168.') || alias.address.startsWith('10.'))) {
        return alias.address;
      }
    }
  }
  return 'localhost';
}

const localIp = getLocalWifiIp();
const accessUrl = `http://${localIp}:${PORT}`;

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n======================================================');
  console.log('🤖 ECHO // ESTRATÉGIA NERD COMPANION ONLINE!');
  console.log(`📡 Servidor Local ativo na porta: ${PORT}`);
  console.log(`🌐 Acesso no Celular (mesma Wi-Fi): ${accessUrl}`);
  console.log('======================================================\n');
  console.log('Abra no navegador do celular apontando a câmera para o QR Code abaixo:');
  qrcode.generate(accessUrl, { small: true });
});
