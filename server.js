const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const qrcode = require('qrcode-terminal');

// Carrega variáveis do ambiente do Estratégia Nerd se existir
const estrategiaEnvPath = path.resolve('C:/Users/WINDOWS/Projects/estrategia-nerd/.env');
let OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

if (fs.existsSync(estrategiaEnvPath)) {
  try {
    const envContent = fs.readFileSync(estrategiaEnvPath, 'utf8');
    const match = envContent.match(/^OPENAI_API_KEY=(.+)$/m);
    if (match && match[1]) {
      OPENAI_API_KEY = match[1].trim().replace(/^['"]|['"]$/g, '');
      console.log('✅ OPENAI_API_KEY carregada com sucesso do Estratégia Nerd!');
    }
  } catch (err) {
    console.warn('⚠️ Não foi possível ler .env do Estratégia Nerd:', err.message);
  }
}

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4884;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Gerenciador de Clientes SSE (Server-Sent Events)
let sseClients = [];

// Estado Global Atual do Echo
let echoState = {
  mode: 'full', // 'full' (centro) ou 'info' (esquerda com dados na direita)
  state: 'idle', // 'idle', 'working', 'waiting', 'success', 'error'
  agent: 'ECHO',
  project: 'ESTRATÉGIA NERD',
  badge: 'STANDBY',
  title: 'Aguardando sessões de desenvolvimento...',
  detail: 'Nenhum agente ativo no momento',
  voiceMessage: '',
  timestamp: Date.now(),
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
app.get('/api/stream', (req, res) => {
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
  const { agent, event, project, tool, command, error, message } = req.body;
  console.log(`[EVENTO RECEBIDO] ${agent || 'Desconhecido'}: ${event || 'Ação'}`);

  echoState.timestamp = Date.now();
  echoState.agent = (agent || 'AGENTE').toUpperCase();
  echoState.project = (project || 'ESTRATÉGIA NERD').toUpperCase();

  if (event === 'SessionStart' || event === 'start') {
    echoState.mode = 'full';
    echoState.state = 'working';
    echoState.badge = 'INICIADO';
    echoState.title = `${echoState.agent} iniciou uma sessão de trabalho`;
    echoState.detail = `Projeto: ${echoState.project}`;
  } 
  else if (event === 'PreToolUse' || event === 'working' || event === 'tool_call') {
    echoState.mode = 'full';
    echoState.state = 'working';
    echoState.badge = 'TRABALHANDO';
    echoState.title = `${echoState.agent} executando ferramenta`;
    echoState.detail = command || tool || 'Lendo e modificando arquivos...';
  } 
  else if (event === 'waiting_user' || event === 'ask_permission' || event === 'approval_needed') {
    echoState.mode = 'info';
    echoState.state = 'waiting';
    echoState.badge = 'APROVAÇÃO NECESSÁRIA';
    echoState.title = `${echoState.agent} precisa de aprovação explícita`;
    echoState.detail = command || message || 'Comando aguardando autorização no terminal';
    echoState.voiceMessage = 'Mestre, preciso da sua aprovação no PC!';
  } 
  else if (event === 'Stop' || event === 'completed' || event === 'success') {
    echoState.mode = 'full';
    echoState.state = 'success';
    echoState.badge = 'CONCLUÍDO';
    echoState.title = 'Tarefa finalizada com sucesso!';
    echoState.detail = message || 'Todos os passos e verificações foram concluídos';
    echoState.voiceMessage = 'Tudo pronto e testado com sucesso!';

    // Volta ao descanso após 25 segundos
    setTimeout(() => {
      if (echoState.state === 'success') {
        echoState.state = 'idle';
        echoState.badge = 'STANDBY';
        echoState.title = 'Aguardando próxima sessão...';
        echoState.detail = 'Nenhum agente ativo';
        broadcastState();
      }
    }, 25000);
  } 
  else if (event === 'error') {
    echoState.mode = 'info';
    echoState.state = 'error';
    echoState.badge = 'ERRO';
    echoState.title = `${echoState.agent} encontrou uma falha`;
    echoState.detail = error || message || 'Erro na execução';
    echoState.voiceMessage = 'Atenção mestre, ocorreu um erro no terminal.';
  }

  broadcastState();
  res.json({ ok: true, state: echoState });
});

// Endpoint de Síntese de Voz (OpenAI TTS)
app.post('/api/speak', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Texto não fornecido' });

  if (!OPENAI_API_KEY) {
    return res.status(503).json({ error: 'OPENAI_API_KEY não configurada' });
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
        voice: 'echo', // Voz oficial Echo da OpenAI
        speed: 1.15   // Ligeiramente acelerada para ritmo dinâmico
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
    console.error('Erro ao gerar voz:', err);
    res.status(500).json({ error: err.message });
  }
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
