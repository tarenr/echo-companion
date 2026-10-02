# Echo // Estratégia Nerd Companion 🤖

> **Painel de mesa inteligente e minimalista para smartphone antigo, integrado aos agentes de IA (Claude Code, Antigravity, Codex CLI) e à telemetria do PC.**

---

## 🎯 O que é o Echo?

O **Echo** é um robô-companheiro de mesa desenvolvido para rodar no navegador de um smartphone antigo (ex.: Android com tela OLED/AMOLED) conectado na mesma rede Wi-Fi local do PC.

Ele monitora em tempo real:
1. **Atividade dos Agentes de IA**: Claude Code, Google Antigravity e Codex CLI trabalhando nos seus projetos.
2. **Pedidos de Aprovação**: Alerta visual imediato e síntese de voz quando um agente precisa de confirmação no terminal para executar comandos de escrita.
3. **Telemetria do PC**: Uso contínuo de CPU e memória RAM (com alarme automático quando a CPU ultrapassa 90%).
4. **Voz Neural**: Fala com a voz oficial *Echo* da OpenAI (usando a chave existente em `estrategia-nerd/.env`).

---

## 📱 Design e Comportamento na Tela do Celular

- **Zero Botões**: O celular é puramente um display vivo, sem botões de controle, cards ou formulários.
- **Identidade Visual**:
  - Paleta OLED puro: Fundo preto profundo (`#030712`) com neon ciano elétrico (`#00E5FF`).
  - Mascote Kaomoji de 2 linhas envolto por parênteses altos:
    ```text
    (  ^   ^  )   <- Olhos (piscam naturalmente)
    (    _    )   <- Boca (articula '_' <-> 'o' durante a fala)
    ```
- **Modos de Exibição Dinâmicos**:
  - **Modo Standby / Trabalho (Full)**: O mascote fica centralizado e grande na tela.
  - **Modo Alerta / Pedido de Aprovação (Info)**: O mascote encolhe e desliza suavemente para a **esquerda**, abrindo espaço na **direita** para badges em alto contraste e métricas gigantes (ex.: `CPU: 92%` ou `APROVAR?`).
- **Wake Lock & Som**: No primeiro toque na tela, o Echo ativa a API de áudio e impede que a tela do celular apague (Wake Lock).

---

## 🚀 Como Iniciar

### 1. Iniciar o Servidor no PC
Na pasta do projeto:
```powershell
npm start
# ou
node server.js
```

O terminal exibirá:
- O IP local na Wi-Fi (ex.: `http://192.168.1.4:4884`).
- Um **QR Code ASCII** no próprio terminal.

### 2. Conectar o Celular
1. Conecte o smartphone na **mesma rede Wi-Fi** do computador.
2. Aponte a câmera do celular para o QR Code no terminal (ou digite o IP no navegador Chrome/Samsung Internet).
3. Ao carregar a tela preta com o mascote, **toque uma vez na tela** para desbloquear o áudio e ativar a retenção de tela.

---

## 🔌 Integração com os Agentes de IA

O Echo inclui um despachante universal ultrarrápido (`bin/dispatcher.js`) que envia eventos em menos de 50ms para a porta 4884 via HTTP, sem jamais bloquear ou atrasar a execução dos agentes.

### 1. Claude Code
Configurado em `~/.claude/settings.json` nos eventos de ciclo de vida (`PreToolUse`, `Stop`).

### 2. Antigravity
Configurado em `~/.gemini/config/hooks.json` interceptando execuções de ferramentas e finalização de tarefas.

### 3. Codex CLI
Configurado em `~/.codex/config.toml` através do disparador `notify` chamando `bin/codex-notify.cmd`.

---

## 🛡️ Firewall do Windows (Porta 4884)

O Node.js oficial (`C:\Program Files\nodejs\node.exe`) já possui permissão de entrada no Firewall do Windows. Caso deseje criar uma regra de porta específica dedicada:

Execute no PowerShell como Administrador:
```powershell
New-NetFirewallRule -DisplayName "Echo Companion (4884)" -Direction Inbound -LocalPort 4884 -Protocol TCP -Action Allow -Profile Private
```

---

## 🏗️ Estrutura do Projeto

```text
echo-companion/
├── bin/
│   ├── codex-notify.cmd    # Wrapper para hook de turn-ended do Codex CLI
│   └── dispatcher.js       # Bridge HTTP ultrarrápido para hooks
├── public/
│   ├── app.js              # Cliente SSE, animações de Kaomoji, WakeLock e áudio
│   ├── index.html          # Interface OLED fullscreen limpa
│   ├── manifest.json       # Configuração PWA para tela cheia
│   └── styles.css          # Estilização Neon, tipografia mono e física de mola
├── package.json            # Dependências mínimas (express, ws, dotenv, qrcode-terminal)
├── server.js               # Hub local (SSE, webhook /api/events, telemetria OS e TTS)
└── README.md               # Documentação técnica e guia de uso
```

---

## 📊 The Forge

Projeto registrado no painel central de projetos **The Forge**:
- **ID do Projeto**: 10
- **URL Local**: `http://localhost:4884`
- **Categoria**: Assistente / Automação / Hardware Companion
