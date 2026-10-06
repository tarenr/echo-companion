/**
 * Pedidos de aprovação e perguntas do Claude Code respondidos pelo celular (modo celular).
 * Tudo em memória: cada pedido tem id aleatório, expira e aceita uma única resposta.
 * Reiniciar o servidor invalida todos os pedidos.
 */
const crypto = require('node:crypto');
const path = require('node:path');

const WAIT_MS = 110 * 1000; // quanto o hook espera pela resposta
const TTL_MS = 120 * 1000;  // validade máxima de um pedido

const PERMISSION_ACTIONS = new Set(['allow', 'deny', 'terminal']);
const QUESTION_ACTIONS = new Set(['answer', 'terminal']);

function text(value, max) {
  const str = value === null || value === undefined ? '' : String(value).trim();
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

// Programa + primeiro argumento, com valores longos e CHAVE=valor escondidos (mesma regra do dispatcher)
function summarizeCommand(raw) {
  const firstLine = String(raw || '').split(/\r?\n/)[0];
  const segments = firstLine.split(/&&|\|\||;|\|/).map(s => s.trim()).filter(Boolean);
  const segment = segments.find(s => !/^cd\s/i.test(s)) || segments[0] || '';
  return segment.split(/\s+/).slice(0, 2).map(token => {
    const clean = token.replace(/^["']|["']$/g, '');
    if (clean.includes('=')) return `${clean.split('=')[0]}=***`;
    if (clean.length > 24) return '***';
    return clean;
  }).join(' ');
}

// Resumo seguro para tela e notificação: nunca o comando inteiro nem o caminho completo
function summarizeTool(toolName, toolInput = {}) {
  const filePath = toolInput.file_path || toolInput.notebook_path || toolInput.path || '';
  if (filePath) return text(`${toolName || 'Arquivo'} ${path.basename(String(filePath))}`, 80);
  if (toolInput.command) return text(`${toolName || 'Comando'}: ${summarizeCommand(toolInput.command)}`, 80);
  if (toolInput.url) {
    try { return text(`${toolName || 'Acesso'}: ${new URL(String(toolInput.url)).host}`, 80); } catch (_) { /* segue */ }
  }
  return text(toolName || 'Ferramenta', 80);
}

function projectName(cwd) {
  return cwd ? text(path.basename(String(cwd)), 40) : '';
}

// Perguntas do AskUserQuestion: até 4, cada uma com até 6 opções { label, description }
function normalizeQuestions(toolInput = {}) {
  const list = Array.isArray(toolInput.questions) ? toolInput.questions.slice(0, 4) : [];
  return list.map(q => {
    const options = (Array.isArray(q?.options) ? q.options : []).slice(0, 6).map(o =>
      typeof o === 'string' ? { label: text(o, 80), description: '' } : { label: text(o?.label, 80), description: text(o?.description, 140) }
    ).filter(o => o.label);
    return {
      question: text(q?.question ?? q?.prompt, 300),
      header: text(q?.header, 24),
      multiSelect: Boolean(q?.multiSelect),
      options
    };
  }).filter(q => q.question && q.options.length);
}

// Respostas só com opções existentes: { "<pergunta>": "<rótulo>" } ou lista de rótulos na multi-seleção
function validateAnswers(questions, answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return null;
  const result = {};
  for (const q of questions) {
    const labels = new Set(q.options.map(o => o.label));
    const value = answers[q.question];
    if (q.multiSelect) {
      const picked = (Array.isArray(value) ? value : []).filter(v => labels.has(v));
      if (!picked.length) return null;
      result[q.question] = [...new Set(picked)];
    } else {
      if (typeof value !== 'string' || !labels.has(value)) return null;
      result[q.question] = value;
    }
  }
  return result;
}

class ApprovalStore {
  constructor({ now = Date.now, ttlMs = TTL_MS, randomId = () => crypto.randomUUID() } = {}) {
    this.now = now;
    this.ttlMs = ttlMs;
    this.randomId = randomId;
    this.items = new Map();
  }

  create({ kind, sessionId, project, summary, questions = [] }) {
    const createdAt = this.now();
    const item = {
      id: this.randomId(),
      kind: kind === 'question' ? 'question' : 'permission',
      sessionId: sessionId ? String(sessionId) : '',
      project: project || '',
      summary: summary || '',
      questions,
      createdAt,
      expiresAt: createdAt + this.ttlMs,
      status: 'pending',
      waiters: []
    };
    this.items.set(item.id, item);
    return item;
  }

  isPending(item) {
    return Boolean(item) && item.status === 'pending' && this.now() <= item.expiresAt;
  }

  finish(item, status, result) {
    item.status = status;
    item.waiters.splice(0).forEach(resolve => resolve(result));
    // Mantém o registro por um tempo para recusar respostas atrasadas como "não pendente"
    const cleanup = setTimeout(() => this.items.delete(item.id), this.ttlMs);
    if (cleanup.unref) cleanup.unref();
  }

  // Espera a resposta; no prazo, o pedido expira e respostas atrasadas são recusadas
  wait(id, timeoutMs = WAIT_MS) {
    const item = this.items.get(id);
    if (!this.isPending(item)) return Promise.resolve({ outcome: 'expired' });
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        if (item.status === 'pending') this.finish(item, 'expired', { outcome: 'expired' });
      }, Math.min(timeoutMs, Math.max(0, item.expiresAt - this.now())));
      if (timer.unref) timer.unref();
      item.waiters.push(result => { clearTimeout(timer); resolve(result); });
    });
  }

  // Resposta do celular: uma única vez, só enquanto pendente
  resolve(id, { action, answers } = {}) {
    const item = this.items.get(id);
    if (!this.isPending(item)) return { ok: false, reason: 'not_pending' };
    const allowed = item.kind === 'question' ? QUESTION_ACTIONS : PERMISSION_ACTIONS;
    if (!allowed.has(action)) return { ok: false, reason: 'invalid_action' };
    let validAnswers;
    if (action === 'answer') {
      validAnswers = validateAnswers(item.questions, answers);
      if (!validAnswers) return { ok: false, reason: 'invalid_answers' };
    }
    this.finish(item, action, { outcome: action, ...(validAnswers ? { answers: validAnswers } : {}) });
    return { ok: true, item };
  }

  // O hook desistiu (conexão fechada): pedido cancelado
  cancel(id) {
    const item = this.items.get(id);
    if (item && item.status === 'pending') this.finish(item, 'cancelled', { outcome: 'cancelled' });
  }

  publicView(item) {
    return {
      id: item.id,
      kind: item.kind,
      project: item.project,
      summary: item.summary,
      questions: item.questions,
      expiresAt: item.expiresAt
    };
  }

  list() {
    return [...this.items.values()].filter(item => this.isPending(item)).map(item => this.publicView(item));
  }
}

// Notificação: sem comando nem caminho, só o tipo de pedido e o projeto
function buildPushPayload(item) {
  const question = item.kind === 'question';
  return {
    title: question ? 'Claude Code fez uma pergunta' : 'Claude Code precisa de aprovação',
    body: item.project ? `Projeto: ${item.project}` : 'Abra o Echo para responder',
    tag: `echo-${item.id}`,
    url: '/'
  };
}

module.exports = {
  ApprovalStore,
  WAIT_MS,
  TTL_MS,
  summarizeTool,
  projectName,
  normalizeQuestions,
  validateAnswers,
  buildPushPayload
};
