#!/usr/bin/env node
/**
 * Echo Approval Hook - pedidos de permissão e perguntas do Claude Code respondidos pelo celular.
 * --kind permission (evento PermissionRequest) ou --kind question (PreToolUse do AskUserQuestion).
 * Com o modo celular desligado, sem celular conectado ou com o Echo fora do ar, o servidor
 * responde na hora e o hook sai sem saída: o terminal pergunta como sempre.
 * Nunca libera sozinho: só imprime uma decisão que veio do celular. Sempre termina com código 0.
 */

const http = require('http');

const args = process.argv.slice(2);
function getArg(flag, defaultVal = '') {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

const kind = getArg('--kind', 'permission') === 'question' ? 'question' : 'permission';
const PORT = Number(process.env.ECHO_PORT) || 4884;
const STDIN_WAIT_MS = 300;
const REQUEST_TIMEOUT_MS = 115 * 1000; // o servidor encerra a espera em 110 s
const HARD_EXIT_MS = 120 * 1000;       // abaixo do timeout de 130 s do settings.json

let inputData = '';
let processed = false;

function exitWith(output) {
  if (output) {
    process.stdout.write(JSON.stringify(output), () => process.exit(0));
  } else {
    process.exit(0);
  }
}

function hookOutput(parsed, response) {
  if (!response) return null;
  if (kind === 'permission' && (response.decision === 'allow' || response.decision === 'deny')) {
    const decision = response.decision === 'allow'
      ? { behavior: 'allow' }
      : { behavior: 'deny', message: 'Negado pelo celular (Echo).' };
    return { hookSpecificOutput: { hookEventName: 'PermissionRequest', decision } };
  }
  if (kind === 'question' && response.decision === 'answer' && response.answers && typeof response.answers === 'object') {
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        updatedInput: { ...(parsed.tool_input || {}), answers: response.answers }
      }
    };
  }
  return null;
}

function requestDecision(parsed, done) {
  const data = JSON.stringify({
    kind,
    session_id: parsed.session_id,
    cwd: parsed.cwd,
    tool_name: parsed.tool_name,
    tool_input: parsed.tool_input
  });
  let finished = false;
  const end = (response) => {
    if (finished) return;
    finished = true;
    done(response);
  };
  const req = http.request({
    hostname: '127.0.0.1',
    port: PORT,
    path: '/api/approvals/request',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    timeout: REQUEST_TIMEOUT_MS
  }, (res) => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', chunk => { body += chunk; });
    res.on('end', () => {
      if (res.statusCode !== 200) return end(null);
      try { end(JSON.parse(body)); } catch (_) { end(null); }
    });
  });
  // Echo desligado ou sem resposta: o terminal pergunta
  req.on('error', () => end(null));
  req.on('timeout', () => { req.destroy(); end(null); });
  req.write(data);
  req.end();
}

function processOnce() {
  if (processed) return;
  processed = true;
  clearTimeout(stdinTimer);

  let parsed = null;
  try { parsed = JSON.parse(inputData); } catch (_) { /* sem dados válidos */ }
  if (!parsed || typeof parsed !== 'object') return exitWith(null);
  if (kind === 'question' && parsed.tool_name !== 'AskUserQuestion') return exitWith(null);

  requestDecision(parsed, response => exitWith(hookOutput(parsed, response)));
}

// Teto de segurança: o hook nunca segura o Claude Code além do prazo
setTimeout(() => process.exit(0), HARD_EXIT_MS);

const stdinTimer = setTimeout(processOnce, STDIN_WAIT_MS);

if (process.stdin.isTTY) {
  processOnce();
} else {
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    inputData += chunk;
    try {
      JSON.parse(inputData);
      processOnce();
    } catch (_) {}
  });
  process.stdin.on('end', processOnce);
  process.stdin.on('error', processOnce);
  process.stdin.resume();
}
