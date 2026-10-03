# Opções de Vozes e Motores de Áudio para o Echo

Este documento cataloga as alternativas avaliadas para a evolução acústica e expressiva do Echo Companion.

---

## 1. Motores Gratuitos em Produção

### Microsoft Edge Neural TTS (Ativo no Echo)
- **Biblioteca**: `msedge-tts` (Node.js)
- **Custo**: 100% gratuito, sem limite de caracteres e sem necessidade de API key.
- **Formato**: Streaming MP3 em 24kHz diretamente do servidor local para o celular.
- **Vozes brasileiras disponíveis**:
  - `pt-BR-AntonioNeural`: Voz masculina dinâmica, clara e natural (atual).
  - `pt-BR-FranciscaNeural`: Voz feminina acolhedora, empática e suave.
  - `pt-BR-BrendaNeural`: Voz feminina jovem e rápida.
  - `pt-BR-NicolauNeural`: Voz masculina alternativa.
- **Ajustes de Prosódia (SSML)**:
  - `rate: '+6%'` ou `'+10%'` (aceleração para ritmo de conversa informal).
  - `pitch: '+2st'` ou `'-2st'` (tonalidade mais jovem ou mais grave).

---

## 2. Motores Avançados de Estúdio (Roadmap / Futuro)

### ElevenLabs
- **Destaque**: Padrão ouro da indústria em realismo humano, respiração e entonação cinematográfica (inclusive clones idênticos do J.A.R.V.I.S. e dubladores profissionais na *Voice Library*).
- **Integração**: API REST (`api.elevenlabs.io/v1/text-to-speech/{voice_id}`).
- **Plano Gratuito**: 10.000 caracteres/mês (~15 a 20 minutos de áudio falado por mês).
- **Ideal para**: Quando quisermos uma voz icônica e hiper-realista.

### Kokoro-82M (Open-Source Local)
- **Destaque**: Modelo neural ultra-leve (apenas 82M parâmetros), open-source sob licença permissiva.
- **Execução**: Roda 100% no processador (CPU) da máquina local em tempo real, sem GPU dedicada e sem custos de nuvem.
- **Idiomas**: Suporte inicial para inglês e expansão para múltiplos idiomas com checkpoints da comunidade.

### Coqui XTTS-v2 (Clonagem Local)
- **Destaque**: Clona qualquer voz a partir de um arquivo WAV de 10 a 30 segundos (ex.: dublador do Jarvis, voz personalizada).
- **Execução**: Roda em Python localmente com PyTorch.
- **Custo**: 100% gratuito e offline.

---

## 3. Síntese Nativa do Navegador (Fallback Zero-Network)
- **API**: `window.speechSynthesis` (Web Speech API).
- **Vantagem**: Funciona mesmo com o servidor offline ou sem internet.
- **Comportamento**: Utiliza as vozes do sistema operacional do celular (Google TTS no Android, Siri/AVSpeech no iOS).
