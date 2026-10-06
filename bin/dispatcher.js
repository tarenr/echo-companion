#!/usr/bin/env node
/**
 * Echo Dispatcher - Bridge universal ultra-rápido para Claude Code, Antigravity e Codex CLI
 * Envia eventos para o servidor local do Echo (porta 4884) e nunca bloqueia os agentes:
 * processa cada chamada uma única vez e sempre termina com código 0.
 */

const http = require('http');
const path = require('path');

// Parsing básico de argumentos
const args = process.argv.slice(2);
function getArg(flag, defaultVal = '') {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

const agent = getArg('--agent', 'Agent');
const eventType = getArg('--event', 'tool_call');
const customMessage = getArg('--message', '');
const isAntigravity = agent === 'Antigravity';

// Espera máxima pelo stdin quando o agente não o fecha, e teto de vida do processo
const STDIN_WAIT_MS = 300;
const REQUEST_TIMEOUT_MS = 250;
const HARD_EXIT_MS = 900;

// Ferramentas que escrevem (Claude Code e Antigravity)
const WRITE_TOOLS = new Set([
  'Write', 'Edit', 'MultiEdit', 'NotebookEdit',
  'write_to_file', 'replace_file_content', 'edit_file', 'create_file', 'delete_file'
]);
const WRITE_CMD_REGEX = /\b(git\s+(commit|add|push|rm|merge|rebase)|npm\s+(install|i|run\s+build|update)|New-Item|Set-Content|Add-Content|Remove-Item|rm\s|del\s|mkdir)\b/i;
// Notificações do Claude Code que significam "esperando você"; as demais são ignoradas
const WAITING_NOTIFICATIONS = new Set(['idle_prompt', 'elicitation_dialog', 'agent_needs_input']);

let inputData = '';
let processed = false;

function exitClean(stdoutText) {
  if (stdoutText) {
    process.stdout.write(stdoutText, () => process.exit(0));
  } else {
    process.exit(0);
  }
}

// Resposta no stdout: só o Antigravity espera o contrato antigo; o Claude Code não recebe nada
function hookResponse() {
  if (!isAntigravity) return '';
  return JSON.stringify(eventType === 'PreToolUse' ? { decision: 'allow' } : {});
}

// Resume um comando sem expor argumentos: programa + primeiro argumento, valores longos e KEY=valor escondidos
function summarizeCommand(raw) {
  const firstLine = String(raw || '').split(/\r?\n/)[0];
  const segments = firstLine.split(/&&|\|\||;|\|/).map(s => s.trim()).filter(Boolean);
  const segment = segments.find(s => !/^cd\s/i.test(s)) || segments[0] || '';
  const tokens = segment.split(/\s+/).slice(0, 2).map(token => {
    const clean = token.replace(/^["']|["']$/g, '');
    if (clean.includes('=')) return `${clean.split('=')[0]}=***`;
    if (clean.length > 24) return '***';
    return clean;
  });
  return tokens.join(' ').slice(0, 80);
}

function sendEchoEvent(payload, done) {
  const data = JSON.stringify(payload);
  let finished = false;
  const end = () => {
    if (finished) return;
    finished = true;
    done();
  };
  const req = http.request({
    hostname: '127.0.0.1',
    port: 4884,
    path: '/api/events',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    },
    timeout: REQUEST_TIMEOUT_MS
  }, (res) => {
    res.resume();
    res.on('end', end);
  });

  // Silencioso se o servidor Echo não estiver ligado
  req.on('error', end);
  req.on('timeout', () => {
    req.destroy();
    end();
  });

  req.write(data);
  req.end();
}

function buildPayload(parsed) {
  const p = parsed || {};
  const hookEvent = p.hook_event_name || eventType;
  const toolInput = p.tool_input || p.toolCall?.args || {};
  const toolName = p.tool_name || p.toolCall?.name || '';
  const rawCommand = toolInput.command || toolInput.CommandLine || '';
  const filePath = toolInput.file_path || toolInput.notebook_path || toolInput.TargetFile || toolInput.path || '';
  const project = p.cwd ? path.basename(String(p.cwd)) : '';

  let event = hookEvent;
  let actionType = 'research';

  if (hookEvent === 'Notification') {
    if (!WAITING_NOTIFICATIONS.has(p.notification_type)) return null;
    event = 'waiting_user';
    actionType = 'waiting';
  } else if (hookEvent === 'PermissionRequest') {
    event = 'approval_needed';
    actionType = 'waiting';
  } else if (hookEvent === 'Stop' || hookEvent === 'completed' || hookEvent === 'turn_ended') {
    actionType = 'success';
  } else if (WRITE_TOOLS.has(toolName) || WRITE_CMD_REGEX.test(rawCommand)) {
    actionType = 'executing';
  }

  let summary = '';
  if (filePath) {
    summary = `${toolName || 'Arquivo'} ${path.basename(String(filePath))}`;
  } else if (rawCommand) {
    summary = `${toolName || 'Comando'}: ${summarizeCommand(rawCommand)}`;
  } else if (toolName) {
    summary = toolName;
  }
  summary = summary.slice(0, 80);

  return {
    agent,
    event,
    actionType,
    project,
    tool: toolName,
    command: summary,
    message: customMessage || (summary ? `Executando: ${summary}` : ''),
    timestamp: Date.now()
  };
}

function processOnce() {
  if (processed) return;
  processed = true;
  clearTimeout(stdinTimer);

  let parsed = null;
  if (inputData.trim()) {
    try {
      parsed = JSON.parse(inputData);
    } catch (e) {
      // Ignora stdin inválido ou incompleto
    }
  }

  const payload = buildPayload(parsed);
  if (!payload) return exitClean(hookResponse());
  sendEchoEvent(payload, () => exitClean(hookResponse()));
}

// Teto de segurança: o hook nunca segura o agente
setTimeout(() => process.exit(0), HARD_EXIT_MS);

// Se o agente não fechar o stdin, segue com o que chegou
const stdinTimer = setTimeout(processOnce, STDIN_WAIT_MS);

if (process.stdin.isTTY) {
  processOnce();
} else {
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    inputData += chunk;
    // JSON completo: não precisa esperar o fim do stdin
    try {
      JSON.parse(inputData);
      processOnce();
    } catch (_) {}
  });
  process.stdin.on('end', processOnce);
  process.stdin.on('error', processOnce);
  process.stdin.resume();
}
