const test = require('node:test');
const assert = require('node:assert/strict');
const { createGeminiProvider } = require('../src/geminiProvider');
test('adaptador preserva IDs e assinaturas; instruções separadas e resposta final sem ferramentas', async () => {
  const content = { role: 'model', parts: [{ thoughtSignature: 'TEST_SIGNATURE', functionCall: { id: 'a', name: 'consultar_projetos_forge', args: {} } }] };
  const bodies = [];
  const provider = createGeminiProvider({ apiKey: 'TEST', models: ['fake'], fetchImpl: async (url, init) => {
    bodies.push(JSON.parse(init.body));
    return { ok: true, json: async () => ({ candidates: [{ content }] }) };
  } });
  assert.deepEqual(await provider({ contents: [], systemInstruction: 'regras', declarations: [{ name: 'tool' }], toolsAllowed: true }), content);
  await provider({ contents: [content], systemInstruction: 'regras', declarations: [], toolsAllowed: false });
  assert.equal(bodies[0].systemInstruction.parts[0].text, 'regras');
  assert.deepEqual(bodies[1].contents[0], content);
  assert.equal(bodies[1].tools, undefined);
});
test('fallback só antes da primeira resposta válida; erro não revela corpo do provedor', async () => {
  const urls = []; let fail = false;
  const provider = createGeminiProvider({ apiKey: 'TEST', models: ['first', 'second'], fetchImpl: async url => {
    urls.push(url);
    if (url.includes('/first:') || fail) return { ok: false, status: 429, text: async () => 'PRIVATE' };
    return { ok: true, json: async () => ({ candidates: [{ content: { role: 'model', parts: [{ text: 'ok' }] } }] }) };
  } });
  await provider({ contents: [], declarations: [] });
  fail = true;
  await assert.rejects(provider({ contents: [], declarations: [] }), error => !error.message.includes('PRIVATE'));
  assert.equal(urls.length, 3);
  assert.ok(urls[2].includes('/second:'));
});
