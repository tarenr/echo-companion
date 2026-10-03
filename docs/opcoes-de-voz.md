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
  headers: { 'Content-Type': 'application/json', 'x-echo-pin': '1984' },
  body: JSON.stringify({ text: 'Olá Mestre! Voz padrão ativa e respondendo com fluidez.' })
}).then(async r => {
  console.log('Status:', r.status, 'Tempo:', (Date.now() - t0) + 'ms', 'Tipo:', r.headers.get('content-type'));
});
"
```
