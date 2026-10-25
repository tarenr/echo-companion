const test = require('node:test');
const assert = require('node:assert/strict');
const { createToolPolicy } = require('../src/toolPolicy');
const declarations = [
  { name: 'consultar_tarefas_forge', parameters: { type: 'OBJECT', properties: { projeto: { type: 'STRING' }, status: { type: 'STRING', enum: ['pendente', 'concluida', 'todas'] } } } },
  { name: 'consultar_dashboard_pc', parameters: { type: 'OBJECT', properties: { secao: { type: 'STRING', enum: ['cpu', 'gpu'] } }, required: ['secao'] } },
  { name: 'gravar_preferencia_usuario', parameters: { type: 'OBJECT', properties: {} } }
];
test('catálogo só permite leituras aprovadas e valida tipos, enum e campos desconhecidos', () => {
  const policy = createToolPolicy(declarations);
  assert.equal(policy.declarations.length, 2);
  for (const name of ['gravar_preferencia_usuario', 'consultar_agenda_google', 'abrir_waze', 'constructor', '__proto__']) {
    assert.equal(policy.validate(name, {}).ok, false);
  }
  for (const args of [null, [], { secao: 'financeiro' }, {}, { secao: 1 }, { secao: 'cpu', extra: true }]) {
    assert.equal(policy.validate('consultar_dashboard_pc', args).ok, false);
  }
  assert.equal(policy.validate('consultar_dashboard_pc', { secao: 'cpu' }).ok, true);
});
test('chave de deduplicação normaliza ordem sem confundir valores', () => {
  const policy = createToolPolicy(declarations);
  const a = policy.validate('consultar_tarefas_forge', { projeto: 'Echo', status: 'pendente' });
  const b = policy.validate('consultar_tarefas_forge', { status: 'pendente', projeto: 'Echo' });
  assert.equal(a.key, b.key);
  assert.notEqual(a.key, policy.validate('consultar_tarefas_forge', { projeto: 'Forge', status: 'pendente' }).key);
  assert.equal(policy.validate('consultar_tarefas_forge', { projeto: 'x'.repeat(501) }).ok, false);
});
