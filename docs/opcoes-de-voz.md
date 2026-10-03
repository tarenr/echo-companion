# Motores de Voz e Síntese Neural para o Echo Companion 🎙️

Este documento documenta a arquitetura de voz do Echo Companion, integrando clonagem neural local acelerada por hardware e fallbacks de alta disponibilidade.

---

## 1. Motor Primário: F5-TTS Neural Local (Voz Clonada do Baymax) 🤖

- **Tecnologia**: [F5-TTS](https://github.com/SWivid/F5-TTS) (Flow Matching Diffusion Transformer) + Vocoder [Vocos](https://github.com/gemelo-ai/vocos) em 24kHz.
- **Hardware**: Aceleração via **NVIDIA GeForce RTX 3050** (CUDA `cu126`, PyTorch 2.14).
- **Voz de Referência**: Dublagem oficial brasileira do personagem **Baymax** (*Operação Big Hero*, dublado por Márcio Araújo).
  - Áudio de referência: `data/voices/baymax_sample.wav` (24kHz mono PCM).
  - Transcrição de referência: `data/voices/baymax_sample.txt` (*"Olá, eu sou Baymax, seu agente pessoal de saúde."*).
- **Desempenho**:
  - Inferência na GPU: ~4 a 5 segundos para sintetizar frases completas de 1 a 2 sentenças.
  - Sistema de Cache Inteligente (`data/voices/cache/`): Frases e respostas repetidas respondem em menos de **1 milissegundo** (Cache HIT instantâneo).
- **Custo**: **100% gratuito e ilimitado** (execução local no PC, sem chamadas externas pagas).
- **Microserviço**:
  - Script: `tts_server.py`
  - Porta: `4885`
  - Gerenciamento: Inicializado e monitorado automaticamente pelo `server.js` na inicialização do Echo Companion.

---

## 2. Motor de Fallback: Microsoft Edge Neural TTS

- **Biblioteca**: `msedge-tts` (Node.js).
- **Voz**: `pt-BR-AntonioNeural` (ou alternável para `pt-BR-FranciscaNeural` / `pt-BR-ThalitaNeural`).
- **Comportamento**: Acionado automaticamente e sem interrupções caso o microserviço F5-TTS local esteja desligado, em manutenção ou reiniciando.
- **Custo**: 100% gratuito, streaming MP3 rápido em 24kHz.

---

## 3. Estrutura de Arquivos e Execução

```text
echo-companion/
├── data/
│   └── voices/
│       ├── baymax_sample.wav     # Amostra de áudio normalizada (24kHz mono)
│       ├── baymax_sample.txt     # Transcrição exata de referência
│       └── cache/                # Cache em disco de áudios gerados (MD5)
├── tts-env/                      # Virtual environment isolado com PyTorch CUDA
├── tts_server.py                 # API FastAPI na porta 4885
├── start-tts.bat                 # Script de inicialização avulsa para depuração
└── server.js                     # Orquestrador do Node.js com fallback automático
```

---

## 4. Testes e Validação de Voz

Para testar a síntese neural diretamente pelo terminal:

```bash
# Testar endpoint de saúde do TTS
node -e "fetch('http://127.0.0.1:4885/health').then(r=>r.json()).then(console.log)"

# Gerar fala na rota do Echo
node -e "fetch('http://127.0.0.1:4884/api/speak', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-echo-pin': '1984' }, body: JSON.stringify({ text: 'Olá Hiro. Eu sou o Baymax, seu companheiro de mesa.' }) }).then(r=>console.log(r.status, r.headers.get('x-voice-engine')))"
```
