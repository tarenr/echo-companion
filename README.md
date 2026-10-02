# Echo // Estratégia Nerd Companion 🤖

> **Painel de mesa inteligente e minimalista para smartphone (local ou remoto via Cloudflare), integrado aos agentes de IA (Claude Code, Antigravity, Codex CLI) com Kaomoji expressivo, telemetria do PC, voz neural da OpenAI e proteção por PIN.**

---

## 🎯 O que é o Echo?

O **Echo** é um robô-companheiro de mesa desenvolvido para rodar no navegador de um smartphone (ex.: Android com tela OLED/AMOLED) conectado na mesma rede Wi-Fi local do PC ou remotamente através de túnel seguro.

Ele monitora em tempo real:
1. **Atividade dos Agentes de IA**: Claude Code, Google Antigravity e Codex CLI trabalhando nos seus projetos.
2. **Cores Neon Exclusivas por IA**:
   - **Claude Code:** Coral / Laranja Neon (`#ff7a45`)
   - **Antigravity:** Azul Elétrico / Ciano Neon (`#00e5ff`)
   - **Codex CLI:** Verde Matrix / Menta Neon (`#00f59b`)
   - **Aguardando Você / Alerta:** Âmbar Dourado (`#fbbf24`)
   - **Conclusão / Sucesso:** Esmeralda Neon (`#10b981`)
   - **Falha / Erro:** Vermelho / Rosa Neon (`#f43f5e`)
3. **Braços, Mãos e Poses Kaomoji**:
   - **Pesquisando (leitura):** Mãos apoiadas `c( • _ • )כ` na cor da IA ativa.
   - **Implementando (escrita):** Braços na massa `\( ò _ ó )/` na cor da IA ativa.
   - **Chamando aprovação:** Braços erguidos acenando `\( ? o ? )/` em dourado.
   - **Comemorando vitória:** Braços comemorando `*\ ( ^ _ ^ ) /*` em esmeralda.
   - **Falha / Erro:** Braços caídos `¯\_( x _ x )_/¯` em vermelho.
   - **Regra estrita da boca:** A boca varia ESTRITAMENTE entre `_` (fechada) e `o` (aberta/falando).
4. **Vida Própria no Modo Ocioso (Idle)**:
   - Em repouso, alterna a cada 20 a 30s entre poses orgânicas:
     - Dando de ombros: `¯\_( ¬ _ ¬ )_/¯`
     - Relaxando / dançando: `~( ˘ _ ˘ ~)`
     - Repouso suave: `( ^ _ ^ )` piscando naturalmente.
5. **Telemetria do PC**: Uso contínuo de CPU e memória RAM (com alarme automático quando a CPU ultrapassa 90%).
6. **Voz Neural**: Fala com a voz oficial *Echo* da OpenAI (usando a chave existente em `estrategia-nerd/.env`).

---

## 🔒 Segurança e Acesso Externo (Cloudflare Tunnel + PIN)

O Echo pode ser acessado de **dentro de casa (Wi-Fi)** ou de **qualquer lugar do mundo pelo celular (4G/5G)** com proteção total contra uso não autorizado:

- **URL Pública Oficial:** `https://echo.tfr-info.com.br`
- **PIN de Segurança:** `4884` (definido por padrão, configurável via variável de ambiente `ECHO_PIN`).
- **Como funciona:**
  - Requisições locais no próprio computador (`127.0.0.1`) são liberadas para que os agentes locais não sofram qualquer atraso.
  - Qualquer requisição vinda pela internet através do Cloudflare Tunnel exige o **PIN de Acesso**.
  - Sem o PIN correto, os endpoints `/api/stream`, `/api/speak` e `/api/events` retornam `401 Unauthorized`.
  - No celular, você só digita o PIN uma vez: o navegador salva a credencial em cookie e `localStorage`.

---

## 📱 Como Conectar o Celular

### Opção 1: Pela Internet (4G/5G ou fora de casa)
1. Abra no navegador do celular:
   ```text
   https://echo.tfr-info.com.br
   ```
2. Digite o PIN de segurança (`4884`).
3. Toque uma vez na tela para autorizar o áudio e ativar a retenção de tela acesa (WakeLock).

### Opção 2: Pela Wi-Fi de Casa
1. No PC, inicie o servidor:
   ```powershell
   npm start
   ```
2. Aponte a câmera do smartphone para o QR Code gerado no terminal (ou acesse `http://192.168.1.4:4884`).
3. Dê um toque na tela para ativar som e WakeLock.

---

## 🔌 Integração com os Agentes de IA

O Echo inclui um despachante universal ultrarrápido (`bin/dispatcher.js`) que envia eventos em menos de 50ms para a porta 4884 via HTTP, sem jamais bloquear ou atrasar a execução dos agentes.

- **Claude Code:** Configurado em `~/.claude/settings.json` nos eventos `PreToolUse` e `Stop`.
- **Antigravity:** Configurado em `~/.gemini/config/hooks.json` interceptando execuções de ferramentas e finalização.
- **Codex CLI:** Configurado em `~/.codex/config.toml` através do disparador `notify` chamando `bin/codex-notify.cmd`.

---

## 🏗️ Estrutura do Projeto

```text
echo-companion/
├── bin/
│   ├── codex-notify.cmd    # Wrapper para hook do Codex CLI
│   └── dispatcher.js       # Bridge HTTP ultrarrápido com classificação de leitura vs escrita
├── public/
│   ├── app.js              # Cliente SSE, braços/mãos Kaomoji, ciclo ocioso, boca _ e o, PIN auth
│   ├── index.html          # Interface OLED limpa com modal de PIN
│   ├── manifest.json       # Configuração PWA para tela cheia
│   └── styles.css          # Estilização Neon, temas por IA e física dos braços
├── package.json            # Dependências mínimas
├── server.js               # Hub local (SSE, webhook, telemetria, TTS, trava de PIN)
└── README.md               # Documentação técnica e guia de uso
```

---

## 📊 The Forge

Projeto registrado no painel central de projetos **The Forge**:
- **ID do Projeto:** 10
- **URL Local:** `http://localhost:4884`
- **URL Cloudflare:** `https://echo.tfr-info.com.br`
- **Categoria:** Assistente / Monitoramento
