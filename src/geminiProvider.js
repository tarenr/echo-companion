const config = require('./conversationConfig');

// Uma instância por pedido: depois de uma resposta válida, mantém o modelo
// que produziu as assinaturas de raciocínio presentes no histórico.
function createGeminiProvider({ apiKey, models = config.models, fetchImpl = fetch, requestTimeoutMs = 8000, onMetric = () => {} }) {
  let selected;
  return async ({ contents, systemInstruction = '', declarations = [], toolsAllowed = true, signal }) => {
    for (const model of selected ? [selected] : models) {
      if (signal?.aborted) throw signal.reason;
      const started = Date.now();
      const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(requestTimeoutMs)]) : AbortSignal.timeout(requestTimeoutMs);
      let status = 'error';
      try {
        const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST', signal: requestSignal,
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] }, contents,
            ...(toolsAllowed && declarations.length ? { tools: [{ functionDeclarations: declarations }] } : {}),
            generationConfig: { maxOutputTokens: 1024, temperature: 0.2 }
          })
        });
        if (!response.ok) throw new Error('provider_unavailable');
        const data = await response.json();
        const content = data.candidates?.[0]?.content;
        if (!Array.isArray(content?.parts) || !content.parts.length) throw new Error('empty_response');
        selected = model;
        status = 'ok';
        return content;
      } catch (_) {
        if (signal?.aborted) throw signal.reason;
        if (selected) break;
      } finally {
        onMetric({ type: 'provider', model, durationMs: Date.now() - started, status });
      }
    }
    throw new Error('Não foi possível consultar o provedor de IA.');
  };
}
module.exports = { createGeminiProvider };
