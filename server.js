const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const memory = require('./src/memory');
const tools = require('./src/tools');
const briefing = require('./src/connectors/briefing');

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
    for (const key of ['ECHO_PIN', 'LUNA_PIN']) {
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
if (!ECHO_PIN) console.warn('⚠️ ECHO_PIN não configurado: acesso externo ao Echo bloqueado.');
if (!LUNA_PIN) console.warn('⚠️ LUNA_PIN não configurado: acesso externo à Luna bloqueado.');

function pinMatches(candidate, expected) {
  return Boolean(expected) && candidate !== undefined && candidate !== null && String(candidate).trim() === expected;
}

app.use((req, res, next) => {
  console.log(`[HTTP ${req.method}] ${req.url} (${req.ip})`);
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
    list[name] = decodeURIComponent(value);
  });
  return list;
}

function isAuthorized(req) {
  const cfIp = req.headers['cf-connecting-ip'];
  const isFromCloudflare = Boolean(cfIp);

  // Apenas conexões locais diretas (sem passar pelo Cloudflare Tunnel) são confiadas
  const ip = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || '';
  const isLocalDirect = !isFromCloudflare && (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1');

  if (isLocalDirect) {
    return true;
  }

  // Requisições externas (via Cloudflare ou rede): EXIGEM PIN obrigatório
  const pinHeader = req.headers['x-echo-pin'];
  const pinQuery = req.query?.pin;
  const cookies = parseCookies(req.headers.cookie);
  const pinCookie = cookies['echo_pin'];

  return (
    pinMatches(pinHeader, ECHO_PIN) ||
    pinMatches(pinQuery, ECHO_PIN) ||
    pinMatches(pinCookie, ECHO_PIN)
  );
}

function isAuthorizedLuna(req) {
  const cfIp = req.headers['cf-connecting-ip'];
  const isFromCloudflare = Boolean(cfIp);
  const ip = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || '';
  const isLocalDirect = !isFromCloudflare && (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1');

  if (isLocalDirect) {
    return true;
  }

  const pinHeader = req.headers['x-luna-pin'];
  const pinQuery = req.query?.pin;
  const cookies = parseCookies(req.headers.cookie);
  const pinCookie = cookies['luna_pin'];

  return (
    pinMatches(pinHeader, LUNA_PIN) ||
    pinMatches(pinQuery, LUNA_PIN) ||
    pinMatches(pinCookie, LUNA_PIN)
  );
}

function requirePin(req, res, next) {
  if (isAuthorized(req)) {
    return next();
  }
  return res.status(401).json({
    ok: false,
    error: 'Acesso bloqueado: PIN de segurança inválido ou ausente.',
    authRequired: true
  });
}

function requireLunaPin(req, res, next) {
  if (isAuthorizedLuna(req)) {
    return next();
  }
  return res.status(401).json({
    ok: false,
    error: 'Acesso bloqueado: PIN da Luna inválido ou ausente.',
    authRequired: true
  });
}

function requireAnyPin(req, res, next) {
  if (isAuthorized(req) || isAuthorizedLuna(req)) {
    return next();
  }
  return res.status(401).json({
    ok: false,
    error: 'Acesso bloqueado: PIN inválido ou ausente.',
    authRequired: true
  });
}

// Endpoint para validar PIN vindo do celular (Echo)
app.post('/api/auth/verify', (req, res) => {
  const { pin } = req.body || {};
  if (pinMatches(pin, ECHO_PIN)) {
    res.setHeader('Set-Cookie', `echo_pin=${ECHO_PIN}; Path=/; Max-Age=31536000; SameSite=Lax`);
    return res.json({ ok: true, message: 'Autenticado com sucesso' });
  }
  return res.status(401).json({ ok: false, error: 'PIN incorreto' });
});

app.get('/api/auth/status', (req, res) => {
  res.json({ ok: true, authorized: isAuthorized(req) });
});

// Endpoint para validar PIN vindo do celular (Luna)
app.post('/api/luna/auth/verify', (req, res) => {
  const { pin } = req.body || {};
  if (pinMatches(pin, LUNA_PIN)) {
    res.setHeader('Set-Cookie', `luna_pin=${LUNA_PIN}; Path=/; Max-Age=31536000; SameSite=Lax`);
    return res.json({ ok: true, message: 'Autenticada com sucesso!' });
  }
  return res.status(401).json({ ok: false, error: 'PIN incorreto.' });
});

app.get('/api/luna/auth/status', (req, res) => {
  res.json({ ok: true, authorized: isAuthorizedLuna(req) });
});

// Rota dedicada da Luna
app.get('/luna', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'luna.html'));
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
app.get('/api/stream', requirePin, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const clientId = Date.now();
  const newClient = { id: clientId, res };
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

// Endpoint Webhook para receber eventos dos Agentes de IA
app.post('/api/events', (req, res) => {
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
app.post('/api/converse', requirePin, async (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'Mensagem vazia' });

  const textLower = message.toLowerCase().trim();

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
      detail1: `RAM: ${echoState.telemetry.ramPercent}% em uso`,
      detail2: 'Hardware monitorado'
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
                maxOutputTokens: 150,
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
            console.log(`[ECHO TOOLS] Executando tool: ${fc.name}`, fc.args);

            // Animação de Lupa/Inspeção no Mascote enquanto a ferramenta é consultada
            broadcastEvent('mascot_state', { accessory: 'lupa', text: `Consultando ${fc.name}...` });

            const toolResult = await tools.executeTool(fc.name, fc.args || {});

            // Define acessório temático e cartão estruturado baseado na ferramenta
            if (['consultar_saldos_bancos', 'consultar_cartoes_credito', 'consultar_contas_a_pagar'].includes(fc.name)) {
              finalAccessory = 'printer';
            } else if (['consultar_treino_e_streak_gym_os', 'gravar_preferencia_usuario'].includes(fc.name)) {
              finalAccessory = 'celebration';
            } else {
              finalAccessory = 'lupa';
            }

            if (fc.name === 'consultar_status_backup_forge') {
              finalCard = {
                badge: 'BACKUP ECOSSISTEMA',
                title: toolResult?.tarefa_agendada?.ultimo_resultado || 'Backup Verificado',
                detail1: `Última: ${toolResult?.tarefa_agendada?.ultima_execucao ? toolResult.tarefa_agendada.ultima_execucao.replace('T', ' ') : 'Ontem'}`,
                detail2: `Próxima: ${toolResult?.tarefa_agendada?.proxima_execucao ? toolResult.tarefa_agendada.proxima_execucao.replace('T', ' ') : 'Hoje 20h'}`
              };
            } else if (fc.name === 'consultar_saldos_bancos') {
              finalCard = {
                badge: 'FINANÇAS STRATEGY HUB',
                title: 'Saldos Bancários',
                detail1: toolResult?.saldo_total_formatado ? `Total: ${toolResult.saldo_total_formatado}` : 'Contas consultadas',
                detail2: `${toolResult?.total_bancos || 'Todos'} bancos cadastrados`
              };
            } else if (fc.name === 'consultar_cartoes_credito') {
              finalCard = {
                badge: 'CARTÕES DE CRÉDITO',
                title: 'Faturas & Limites',
                detail1: 'Consulta de faturas do mês',
                detail2: 'Strategy Hub'
              };
            } else if (fc.name === 'consultar_contas_a_pagar') {
              finalCard = {
                badge: 'CONTAS A PAGAR',
                title: 'Despesas & Contas',
                detail1: toolResult?.total_pendente ? `Total: ${toolResult.total_pendente}` : 'Contas consultadas',
                detail2: 'Strategy Hub'
              };
            } else if (fc.name === 'executar_briefing_sistema') {
              finalCard = toolResult?.card || {
                badge: 'BRIEFING DO SISTEMA',
                title: 'Tudo Operacional',
                detail1: 'Serviços, Backups e The Forge',
                detail2: 'Relatório diário consolidado'
              };
            } else if (fc.name === 'consultar_projetos_forge' || fc.name === 'consultar_tarefas_forge') {
              finalCard = {
                badge: 'THE FORGE',
                title: 'Projetos & Tarefas',
                detail1: toolResult?.total_encontradas ? `${toolResult.total_encontradas} tarefas encontradas` : 'Painel central',
                detail2: 'Status atualizado'
              };
            } else if (fc.name === 'consultar_monitor_servicos') {
              finalCard = {
                badge: 'MONITOR DE SERVIÇOS',
                title: toolResult?.todos_online ? 'Todos os Serviços Online' : `${toolResult?.online}/${toolResult?.total_servicos} Online`,
                detail1: toolResult?.resumo || 'Serviços verificados',
                detail2: 'NerdOPS / The Forge'
              };
            } else if (fc.name === 'consultar_agendamento_posts') {
              finalCard = {
                badge: 'POSTS AGENDADOS',
                title: 'Estratégia Nerd',
                detail1: `Instagram: ${toolResult?.total_instagram_agendados || 0} agendados`,
                detail2: `Blog: ${toolResult?.total_blog_agendados || 0} agendados`
              };
            } else if (fc.name === 'consultar_metricas_blog' || fc.name === 'consultar_metricas_instagram') {
              finalCard = {
                badge: 'MÉTRICAS DO CANAL',
                title: toolResult?.canal || 'Estratégia Nerd',
                detail1: toolResult?.total_visualizacoes ? `${toolResult.total_visualizacoes} views` : (toolResult?.seguidores ? `${toolResult.seguidores} seguidores` : 'Métricas consolidadas'),
                detail2: 'Canal oficial ativo'
              };
            } else if (fc.name === 'consultar_treino_e_streak_gym_os') {
              finalCard = {
                badge: 'GYM OS RPG',
                title: toolResult?.treino_hoje ? `Treino: ${toolResult.treino_hoje}` : 'Treino do Dia',
                detail1: toolResult?.streak_dias ? `🔥 Streak: ${toolResult.streak_dias} dias` : 'Missão diária',
                detail2: toolResult?.nivel ? `Nível ${toolResult.nivel}` : 'Bata sua meta!'
              };
            }

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

  // Fallback amigável
  const fallback = "Entendido, Mestre! Processando aqui no Estratégia Nerd.";
  echoState.voiceOrigin = 'converse';
  echoState.voiceMessage = fallback;
  broadcastState();
  broadcastEvent('mascot_state', { accessory: 'none', text: fallback });
  return res.json({ ok: true, reply: fallback, accessory: 'none', source: 'fallback' });
});

// Endpoint exclusivo de Conversação da Luna (Assistente pessoal inteligente, carinhosa e dedicada)
app.post('/api/luna/converse', requireLunaPin, async (req, res) => {
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

  // 2. Consulta inteligente via Google Gemini
  if (GEMINI_API_KEY) {
    try {
      const systemPrompt = `Você é a Luna, uma mascote e assistente pessoal amigável, inteligente, carinhosa, gentil e muito prestativa.
Você foi criada com muito carinho para ser a companheira e ajudante do dia a dia dela.
Seu papel é responder dúvidas práticas, curiosidades, dicas de culinária e receitas, organização de rotina, resumos, bem-estar ou simplesmente bater um papo leve e acolhedor.
REGRAS OBRIGATÓRIAS:
- Responda SEMPRE em português do Brasil com simpatia, doçura e clareza.
- Seja concisa e direta (no máximo 2 a 3 frases curtas e completas), pois sua resposta será sintetizada diretamente por voz neural.
- Não use jargões técnicos de computador, programação, códigos ou coisas do mundo hacker/nerd.
- Não use emojis, asteriscos, markdown (#, *, _), listas com hifens ou tabelas, pois o texto será falado em voz alta.
- Mantenha sempre um tom alegre, educado, empático e prestativo.`;

      const contents = [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\nPergunta dela: "${message}"` }]
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

  // Fallback amigável
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
