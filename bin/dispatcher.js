#!/usr/bin/env node
/**
 * Echo Dispatcher - Bridge universal ultra-rápido para Claude Code, Antigravity e Codex CLI
 * Envia eventos para o servidor local do Echo (porta 4884) com timeout baixíssimo (150ms)
 * e nunca bloqueia os agentes.
 */

const http = require('http');

// Parsing básico de argumentos
const args = process.argv.slice(2);
function getArg(flag, defaultVal = '') {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

const agent = getArg('--agent', 'Agent');
const eventType = getArg('--event', 'tool_call');
const customMessage = getArg('--message', '');

// Leitura de stdin com timeout curto para não travar caso não haja stdin
let inputData = '';

function sendEchoEvent(payload) {
  const data = JSON.stringify(payload);
  const req = http.request({
    hostname: '127.0.0.1',
    port: 4884,
    path: '/api/events',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    },
    timeout: 200
  }, (res) => {
    res.resume();
  });

  req.on('error', () => {
    // Silencioso se o servidor Echo não estiver ligado
  });

  req.on('timeout', () => {
    req.destroy();
  });

  req.write(data);
  req.end();
}

function processAndExit() {
  let parsedStdin = null;
  if (inputData.trim()) {
    try {
      parsedStdin = JSON.parse(inputData);
    } catch (e) {
      // Ignora erro de parse de stdin
    }
  }

  let toolName = '';
  let commandStr = customMessage;

  if (parsedStdin) {
    if (parsedStdin.toolCall) {
      toolName = parsedStdin.toolCall.name || '';
      if (parsedStdin.toolCall.args && parsedStdin.toolCall.args.CommandLine) {
        commandStr = parsedStdin.toolCall.args.CommandLine;
      }
    }
  }

  // Prepara payload para o Echo
  const payload = {
    agent: agent,
    event: eventType,
    tool: toolName,
    command: commandStr,
    message: customMessage || (toolName ? `Executando: ${toolName}` : ''),
    timestamp: Date.now()
  };

  sendEchoEvent(payload);

  // Resposta padrão no stdout para contratos de hooks do Antigravity
  if (eventType === 'PreToolUse') {
    process.stdout.write(JSON.stringify({ decision: 'allow' }));
  } else {
    process.stdout.write(JSON.stringify({}));
  }

  // Aguarda 40ms para envio e encerra com código 0
  setTimeout(() => {
    process.exit(0);
  }, 40);
}

// Timeout de segurança para caso não receba EOF no stdin
const stdinTimeout = setTimeout(() => {
  processAndExit();
}, 80);

if (process.stdin.isTTY) {
  clearTimeout(stdinTimeout);
  processAndExit();
} else {
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    inputData += chunk;
  });
  process.stdin.on('end', () => {
    clearTimeout(stdinTimeout);
    processAndExit();
  });
  process.stdin.resume();
}
