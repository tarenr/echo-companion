# Motores de Voz e Síntese Neural para o Echo Companion 🎙️

Este documento cataloga a arquitetura de voz do Echo Companion, as alternativas avaliadas, motores em produção e aprendizados de experimentação.

---

## 1. Motor Oficial em Produção: Microsoft Edge Neural TTS ⚡

O Echo adota como motor oficial de voz o **Microsoft Edge Neural TTS**, priorizando fluidez, streaming instantâneo em tempo real e naturalidade nativa em português brasileiro:

- **Biblioteca**: `msedge-tts` (Node.js nativo).
- **Voz Padrão Oficial**: `pt-BR-AntonioNeural` (voz masculina dinâmica, natural, clara e profissional).
- **Vozes Alternativas Disponíveis**:
  - `pt-BR-FranciscaNeural`: Voz feminina acolhedora, empática e suave.
  - `pt-BR-ThalitaNeural`: Voz jovem, ágil e expressiva.
  - `pt-BR-BrendaNeural`: Alternativa dinâmica.
- **Formato**: Streaming direto MP3 em 24kHz (`AUDIO_24KHZ_48KBITRATE_MONO_MP3`).
- **Latência de Resposta**: ~1.0s a 1.4s (entrega instantânea no smartphone).
- **Custo e Limites**: **100% gratuito**, sem chaves de API, sem cota diária e sem custos recorrentes.
- **Calibração de Prosódia**:
  - `rate: '+6%'` para ritmo natural e ágil de conversa.

### Ordem dos motores em `/api/speak`

1. **Edge TTS** (primário, acima).
2. **Gemini TTS** (`gemini-2.5-flash-preview-tts`): usa a `GEMINI_API_KEY` que o servidor já carrega. A voz segue a pedida ao Edge: feminina (`Thalita`, `Francisca`, `Brenda`, usadas pela Luna) vira `Kore`; qualquer outra, inclusive a padrão do Echo (`Antonio`), vira `Charon`. A Gemini devolve PCM 16-bit mono a 24 kHz; o servidor embrulha em WAV (`pcmToWav`) e responde `audio/wav`. Se faltar chave ou falhar, passa adiante.
3. **OpenAI TTS** (só com chave e saldo).
4. **Voz nativa do aparelho** (`speechSynthesis`), no front, se o servidor não entregar áudio.

**Prazos:** a cadeia inteira tem 20 s (o celular desiste aos 22 s). Edge: até 8 s por tentativa; Gemini: até 8 s; OpenAI: até 5 s. Um estágio só começa se ainda sobrarem mais de 1,5 s.

**Fila serial, Cooldown e Circuit Breaker:** os pedidos ao Edge passam por uma fila única (`createSerialGate`) com espaçamento obrigatório de 1,8 s entre sínteses sucessivas para respeitar os limites do gateway da Microsoft (Azure Front Door). Se a Microsoft responder `429` (Too Many Requests), o servidor ativa automaticamente um **Circuit Breaker** de 45 segundos: durante essa janela, qualquer nova requisição de voz pula imediatamente o Edge e aciona os fallbacks (Gemini, OpenAI ou a voz nativa do dispositivo), garantindo que o IP local esfrie e a voz continue funcionando sem atrasos.

**Log:** cada pedido registra no `echo.log` uma linha `[VOZ] <motor> ok|falhou|sem áudio|pulado em <ms>ms`, sem o texto da fala. Erros de status HTTP na API da Gemini agora são detalhados no log para diagnóstico imediato de cotas.

### Aprendizado: o Edge TTS não é um serviço oficial

A `msedge-tts` usa a API de leitura em voz alta do Edge, que a Microsoft pode mudar ou bloquear sem aviso. Em 14/10/2026 o Echo passou a receber `403` no WebSocket com a versão 2.0.9, e a Luna ficou sem voz. Atualizar para a `2.1.0` (novo endpoint `api.msedgeservices.com`) e alinhar a versão do protocolo (`Sec-MS-GEC-Version=1-155.0.4283.45`) resolveu. O Circuit Breaker e o cooldown de fila impedem que rajadas de eventos derrubem a conexão com erro 429. Se ambos falharem, o fallback nativo no navegador do aparelho assume a fala sem interrupção.

---

## 2. Experimento Aposentado: Clonagem Neural Local F5-TTS (RTX 3050) 🧪

Durante o ciclo de testes de clonagem de voz, foi implementada e avaliada uma solução local de síntese com o modelo [F5-TTS](https://github.com/SWivid/F5-TTS) e vocoder Vocos 24kHz rodando na placa dedicada **NVIDIA GeForce RTX 3050**:

- **Objetivo do Teste**: Clonar localmente a voz da dublagem brasileira do personagem Baymax (*Operação Big Hero*, dublado por Márcio Araújo) a partir de uma amostra limpa de áudio (`baymax_sample.wav`).
- **Status Atual**: **APOSENTADO / DESATIVADO**.
- **Motivos Técnicos da Aposentadoria**:
  1. **Sotaque e Dicção Sintetizada**: O modelo base do F5-TTS, embora capture o timbre acústico, introduz forte sotaque anglófono/robótico e pronúncia truncada de fonemas em português do Brasil (`pt-BR`), soando artificial e desagradável para uso diário.
  2. **Latência Inviável para Conversação**: O tempo de inferência na GPU variou entre **4 e 6 segundos por frase**, provocando travamentos na experiência de uso interativo no celular.
  3. **Complexidade de Infraestrutura**: Exigia microserviço Python FastAPI residente na porta 4885, consumindo memória e monitoramento contínuo.
- **Conclusão**: O ganho de personalização não compensou a perda drástica de clareza, fluidez e velocidade. A solução foi desligada e mantida apenas como histórico de pesquisa técnica.

---

## 3. Síntese Nativa do Navegador (Fallback Zero-Network) 🌐

- **API**: `window.speechSynthesis` (Web Speech API).
- **Finalidade**: Acionado no celular apenas se a conexão de rede local com o servidor Node for perdida.
- **Comportamento**: Utiliza as vozes do sistema operacional (Google TTS no Android / Siri no iOS).

---

## 4. Testes e Validação da Rota de Voz

Para verificar a velocidade e entrega de áudio da voz oficial:

```bash
node -e "
const t0 = Date.now();
fetch('http://127.0.0.1:4884/api/speak', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-echo-pin': 'SEU_PIN' },
  body: JSON.stringify({ text: 'Olá Mestre! Voz padrão ativa e respondendo com fluidez.' })
}).then(async r => {
  console.log('Status:', r.status, 'Tempo:', (Date.now() - t0) + 'ms', 'Tipo:', r.headers.get('content-type'));
});
"
```

---

## 5. Avaliação do Kokoro-82M (Nativo & ONNX em GPU RTX 3050) ⚡🚀

Em outubro de 2026, foi realizado o primeiro benchmark formal e teste de voz de longa duração do modelo **Kokoro-82M** em Português do Brasil (`pt-br`):

- **Modelo**: `hexgrad/Kokoro-82M` (82 milhões de parâmetros, arquitetura StyleTTS2 / iSTFTNet).
- **Vozes Testadas**:
  - `pm_alex`: Voz masculina nativa brasileira (articulada, tom profissional e alinhada ao estilo do Echo).
  - `pf_dora`: Voz feminina nativa brasileira alternativa.
- **Resultados de Desempenho (NVIDIA GeForce RTX 3050)**:
  - **Carregamento da Pipeline**: 1.43s a 1.54s.
  - **Demonstração Longa (30,52s de fala / 537 caracteres)**: Inferência em apenas **1,55 segundos** (`pm_alex`), RTF: **0.051x** (geração 20x mais rápida que o tempo real).
  - **Frase Média (4,50s de fala)**: Inferência em **0,19 segundos**, RTF: **0.042x** (praticamente instantâneo).
- **Arquivos de Amostra Gerados**:
  - `voice-studio/backend/cache/echo_apresentacao_30s_pm_alex.wav` (30,52s)
  - `voice-studio/backend/cache/echo_apresentacao_30s_pf_dora.wav` (30,45s)
- **Conclusão**: O Kokoro-82M provou ser o motor local mais rápido e eficiente já testado no hardware da máquina, sendo um candidato viável para integração direta ao Echo.

