const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const server = fs.readFileSync(require.resolve('../server.js'), 'utf8');
const app = fs.readFileSync(require.resolve('../public/app.js'), 'utf8');
const collectSource = server.slice(server.indexOf('function collectSpeech('), server.indexOf('async function generateOpenAISpeech('));
const collectSpeech = vm.runInNewContext(`${collectSource}; collectSpeech`, { Buffer, setTimeout, clearTimeout, OUTPUT_FORMAT: { AUDIO_24KHZ_48KBITRATE_MONO_MP3: 'mp3' } });

test('Edge preso nos metadados fecha conexão e rejeita no prazo', async () => {
  let closed = 0;
  const res = new EventEmitter();
  await assert.rejects(collectSpeech({ setMetadata: () => new Promise(() => {}), close: () => closed++ }, 'voice', 'text', res, 10), /prazo/);
  assert.equal(closed, 1);
  assert.equal(res.listenerCount('close'), 0);
});

test('Edge preso no stream, erro tardio e desconexão não duplicam conclusão', async () => {
  const stream = new EventEmitter();
  let closed = 0;
  const tts = { setMetadata: async () => {}, toStream: () => ({ audioStream: stream }), close: () => closed++ };
  await assert.rejects(collectSpeech(tts, 'voice', 'text', new EventEmitter(), 10), /prazo/);
  stream.emit('error', new Error('tardio'));
  assert.equal(closed, 1);
  const res = new EventEmitter();
  const pending = collectSpeech(tts, 'voice', 'text', res, 100);
  res.emit('close');
  assert.equal(await pending, null);
});

test('Edge completo devolve áudio; stream vazio permite alternativa', async () => {
  for (const empty of [false, true]) {
    const stream = new EventEmitter();
    const tts = { setMetadata: async () => {}, close() {}, toStream: () => {
      setTimeout(() => { if (!empty) stream.emit('data', Buffer.from('audio')); stream.emit('end'); }, 1);
      return { audioStream: stream };
    } };
    const result = collectSpeech(tts, 'voice', 'text', new EventEmitter(), 100);
    if (empty) await assert.rejects(result, /vazio/); else assert.equal((await result).toString(), 'audio');
  }
});

const requestSource = app.slice(app.indexOf('  async function requestWithTimeout('), app.indexOf('  let speechRecoveryTimer'));
test('requisição do celular aborta tanto espera dos cabeçalhos quanto do corpo', async () => {
  for (const hangBody of [false, true]) {
    const wait = signal => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
    const fetch = async (_, { signal }) => hangBody ? { json: () => wait(signal) } : wait(signal);
    const request = vm.runInNewContext(`${requestSource}; requestWithTimeout`, { fetch, AbortController, setTimeout, clearTimeout });
    await assert.rejects(request('/api/converse', {}, 10, res => res.json()), /aborted/);
  }
});

test('guardião de fala libera o mascote e retoma escuta se não houver evento final', () => {
  let callback, cancelled = 0, stopped = 0, resumed = 0, state;
  const source = app.slice(app.indexOf('  let speechRecoveryTimer'), app.indexOf('  async function speak('));
  const arm = vm.runInNewContext(`${source}; armSpeechRecovery`, {
    setTimeout: fn => { callback = fn; return 1; }, clearTimeout() {},
    stopSpeakingAnim: () => stopped++, resumeListeningIfHandsFree: () => resumed++,
    mochi: { setState: value => state = value }
  });
  arm('teste', () => cancelled++);
  callback();
  assert.equal(cancelled, 1);
  assert.equal(stopped, 1);
  assert.equal(resumed, 1);
  assert.equal(state, 'idle');
});

test('falha do servidor ou bloqueio de reprodução usa voz nativa e libera a escuta', async () => {
  for (const rejectPlayback of [false, true]) {
    let spoken = 0, resumed = 0, revoked = 0;
    const mochi = { speaking: false, state: 'thinking', setState(value) { this.state = value; } };
    const source = app.slice(app.indexOf('  function startSpeakingAnim('), app.indexOf('  function resumeListeningIfHandsFree('));
    const synth = { cancel() {}, getVoices: () => [], speak(utter) { spoken++; utter.onstart(); utter.onend(); } };
    const context = {
      mochi, speechTimer: null, currentAudio: null, pauseRecognition() {},
      resumeListeningIfHandsFree: () => resumed++, bubbleFollowAudio() {}, bubbleFollowChar() {},
      setTimeout, clearTimeout, setInterval, clearInterval, AbortController,
      console: { warn() {} }, getAuthHeaders: () => ({}),
      window: { speechSynthesis: synth }, SpeechSynthesisUtterance: function(text) { this.text = text; },
      URL: { createObjectURL: () => 'blob:test', revokeObjectURL: () => revoked++ },
      Audio: function() { this.play = async () => { throw new Error('autoplay blocked'); }; this.pause = () => {}; },
      fetch: async () => {
        if (!rejectPlayback) throw new Error('offline');
        return { ok: true, headers: { get: () => 'audio/mpeg' }, blob: async () => ({ size: 20 }) };
      }
    };
    const speak = vm.runInNewContext(`${source}; speak`, context);
    await speak('Teste de recuperação');
    assert.equal(spoken, 1);
    assert.equal(resumed, 1);
    assert.equal(mochi.speaking, false);
    assert.equal(mochi.state, 'idle');
    if (rejectPlayback) assert.equal(revoked, 1);
  }
});
