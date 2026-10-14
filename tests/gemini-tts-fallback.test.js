const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const server = fs.readFileSync(require.resolve('../server.js'), 'utf8');
const source = server.slice(server.indexOf('// Prazos da síntese de voz'), server.indexOf('// Endpoint de Briefing Consolidado'));
const { pcmToWav, generateGeminiSpeech, createSerialGate, retryOn429, pickGeminiVoice } = vm.runInNewContext(
  `${source}; ({ pcmToWav, generateGeminiSpeech, createSerialGate, retryOn429, pickGeminiVoice })`,
  { Buffer, AbortSignal, Number, JSON, console, setTimeout, clearTimeout, fetch: async () => { throw new Error('sem rede nos testes'); } }
);

const fakeFetch = (body, ok = true) => async () => ({ ok, json: async () => body });

test('pcmToWav gera cabeçalho WAV válido para PCM 16-bit mono', () => {
  const wav = pcmToWav(Buffer.from([1, 0, 2, 0]), 24000);
  assert.equal(wav.length, 48);
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
  assert.equal(wav.readUInt32LE(24), 24000);
  assert.equal(wav.readUInt16LE(34), 16);
  assert.equal(wav.readUInt32LE(40), 4);
});

test('Gemini TTS converte a resposta em WAV usando a taxa informada', async () => {
  const pcm = Buffer.from([1, 0, 2, 0]);
  const body = { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=16000', data: pcm.toString('base64') } }] } }] };
  const wav = await generateGeminiSpeech('oi', 'chave', fakeFetch(body));
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.readUInt32LE(24), 16000);
});

test('Gemini TTS devolve null sem chave, em erro HTTP, sem áudio ou com falha de rede', async () => {
  assert.equal(await generateGeminiSpeech('oi', '', fakeFetch({})), null);
  assert.equal(await generateGeminiSpeech('oi', 'chave', fakeFetch({}, false)), null);
  assert.equal(await generateGeminiSpeech('oi', 'chave', fakeFetch({ candidates: [] })), null);
  assert.equal(await generateGeminiSpeech('oi', 'chave', async () => { throw new Error('rede'); }), null);
});

test('Gemini TTS usa a voz e o prazo informados', async () => {
  let sent;
  const fetchImpl = async (_, options) => { sent = JSON.parse(options.body); return { ok: false }; };
  await generateGeminiSpeech('oi', 'chave', fetchImpl, { voice: 'Charon', timeoutMs: 1000 });
  assert.equal(sent.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Charon');
});

test('voz do fallback: feminina para a Luna, masculina para o Echo', () => {
  assert.equal(pickGeminiVoice('pt-BR-ThalitaNeural'), 'Kore');
  assert.equal(pickGeminiVoice('pt-BR-FranciscaNeural'), 'Kore');
  assert.equal(pickGeminiVoice('pt-BR-AntonioNeural'), 'Charon');
  assert.equal(pickGeminiVoice(undefined), 'Charon');
});

test('fila do Edge roda um pedido por vez e na ordem', async () => {
  const gate = createSerialGate(1000);
  const events = [];
  let active = 0, maxActive = 0;
  const job = name => gate(async () => {
    active++; maxActive = Math.max(maxActive, active);
    events.push(`inicio ${name}`);
    await new Promise(r => setTimeout(r, 15));
    events.push(`fim ${name}`);
    active--;
    return name;
  });
  assert.deepEqual(await Promise.all([job('a'), job('b'), job('c')]), ['a', 'b', 'c']);
  assert.equal(maxActive, 1);
  assert.deepEqual(events, ['inicio a', 'fim a', 'inicio b', 'fim b', 'inicio c', 'fim c']);
});

test('fila do Edge: quem espera demais desiste sem rodar depois, e erro não trava a fila', async () => {
  const gate = createSerialGate(20);
  let ranLate = false;
  const slow = gate(() => new Promise(r => setTimeout(() => r('lento'), 80)));
  await assert.rejects(gate(async () => { ranLate = true; }), /fila do Edge/);
  assert.equal(await slow, 'lento');
  assert.equal(ranLate, false);
  await assert.rejects(gate(async () => { throw new Error('falha'); }), /falha/);
  assert.equal(await gate(async () => 'ok'), 'ok');
});

test('429 tenta de novo uma vez; outros erros e falta de prazo não', async () => {
  const noSleep = { sleep: async () => {} };
  let calls = 0;
  const flaky = async () => { if (++calls === 1) throw new Error('Unexpected server response: 429'); return 'audio'; };
  assert.equal(await retryOn429(flaky, { remaining: () => 15000, ...noSleep }), 'audio');
  assert.equal(calls, 2);

  calls = 0;
  await assert.rejects(retryOn429(async () => { calls++; throw new Error('Unexpected server response: 403'); }, { remaining: () => 15000, ...noSleep }), /403/);
  assert.equal(calls, 1);

  calls = 0;
  await assert.rejects(retryOn429(async () => { calls++; throw new Error('Unexpected server response: 429'); }, { remaining: () => 2000, ...noSleep }), /429/);
  assert.equal(calls, 1);

  calls = 0;
  await assert.rejects(retryOn429(async () => { calls++; throw new Error('Unexpected server response: 429'); }, { remaining: () => 15000, ...noSleep }), /429/);
  assert.equal(calls, 2);
});
