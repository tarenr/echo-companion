// Para retornar ao fluxo anterior, altere enabled para false e reinicie o Echo.
module.exports = Object.freeze({
  enabled: true,
  maxRounds: 4,
  maxExecutions: 6,
  timeoutMs: 25000,
  maxContextChars: 48000,
  maxResultChars: 4000,
  models: ['gemini-flash-lite-latest', 'gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash']
});
