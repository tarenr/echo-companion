# Echo // Estratégia Nerd Companion 🤖

[![GitHub Repository](https://img.shields.io/badge/GitHub-tarenr%2Fecho--companion-blue?logo=github)](https://github.com/tarenr/echo-companion)
[![License: ISC](https://img.shields.io/badge/License-ISC-green.svg)](https://opensource.org/licenses/ISC)

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
3. **Modo Multi-Agente (Execução Concorrente)**:
   - **Rastreamento Simultâneo:** Quando dois ou mais agentes (ex.: Claude Code e Google Antigravity) operam ao mesmo tempo, o backend mantém um registro cooperativo (`activeAgents` Map com TTL de 20s).
   - **Cabeçalho Composto Dinâmico:** Exibe instantaneamente no topo `X AGENTES ATIVOS // CLAUDE & ANTIGRAVITY` com borda e brilho pulsante dual neon.
   - **Tema Visual Dual Neon:** O robô adota a classe `.theme-multi-agent` com pulsação sincronizada entre o Azul Ciano (`#00e5ff`) e o Coral Neon (`#ff7a45`), representando visualmente a união dos agentes na mesma tela.
   - **Conclusão Independente:** Quando um agente finaliza sua tarefa e envia evento de parada (`Stop`), o Echo notifica que ele encerrou mantendo o foco no agente que continua em execução sem interromper o painel.
4. **Braços, Mãos e Poses Kaomoji**:
   - **Pesquisando (leitura):** Mãos apoiadas `c( • _ • )כ` na cor da IA ativa.
   - **Implementando (escrita):** Braços na massa `\( ò _ ó )/` na cor da IA ativa.
   - **Chamando aprovação:** Braços erguidos acenando `\( ? o ? )/` em dourado.
   - **Comemorando vitória:** Braços comemorando `*\ ( ^ _ ^ ) /*` em esmeralda.
   - **Falha / Erro:** Braços caídos `¯\_( x _ x )_/¯` em vermelho.
   - **Regra estrita e física da boca:** A boca varia ESTRITAMENTE entre `_` (fechada/repouso) e `o` (aberta/falando). Possui projeção esférica 3D acoplada aos eixos de rotação da face (yaw, pitch e roll), mantendo-se sempre centrada entre os olhos com perspectiva e envelope de segurança rígido que impede a boca de sair do rosto sob qualquer ângulo de visualização.
5. **Design Responsivo Híbrido (Retrato & Paisagem)**:
   - **Em pé (Retrato / Celular na mesa):** O mascote ocupa a parte superior e, ao responder consultas estruturadas de dados (Backups, Telemetria, Bancos, Cartões, Contas, Tarefas do Forge, Posts agendados do Estratégia Nerd, Treinos do Gym OS), desliza suavemente para cima e direciona o olhar para baixo (`mochi.look.y = 0.85`), abrindo o painel de cards neon na metade inferior sem espremer o texto.
   - **Deitado (Paisagem):** O mascote desliza suavemente para a esquerda e fixa o olhar para a direita (`mochi.look.x = 0.85`), mantendo o painel lateral clássico.
   - **Rotação Livre e Fluida:** O PWA opera com `orientation: any`, adaptando-se instantaneamente em tempo real quando o celular é girado. Ao finalizar a apresentação dos dados, retorna suavemente para o centro da tela (`.mode-full`).
6. **Ciclo de Ociosidade e Modo Dormindo (`sleeping`)**:
   - **Ocioso (Idle):** Em repouso, alterna a cada 20 a 30s entre poses orgânicas (`¯\_( ¬ _ ¬ )_/¯`, `~( ˘ _ ˘ ~)`, `( ^ _ ^ )`).
   - **Xícara de Café (`coffee`):** Ativado após 3 minutos sem interação.
   - **Modo Dormindo (`sleeping`):** Ativado após 6 minutos de inatividade ou por comando de voz direto ("boa noite", "vai dormir", "soneca"). Apresenta arcos serenos nos olhos `( ˘ _ ˘ )`, respiração lenta e profunda (física senoidal), partículas flutuantes lilás de `z Z z` e dimerização suave de brilho da tela (economia para telas OLED). Desperta instantaneamente com toque na tela, comando de voz ou eventos em tempo real dos agentes de IA.
7. **Telemetria do PC**: Uso contínuo de CPU e memória RAM (com alarme automático quando a CPU ultrapassa 90%).
8. **Voz Neural Oficial em Português (Edge TTS Antonio)**: Fala com voz brasileira natural, dinâmica e de alta fidelidade (`pt-BR-AntonioNeural`), transmitida em streaming direto MP3 a 24kHz com entrega instantânea (~1s), fluidez conversacional e custo zero sem necessidade de chave de API externa.
9. **Desbloqueio de Áudio e WakeLock em Toque Único**: O aviso inicial de ativação de som fecha imediatamente em qualquer toque na tela ou diretamente no toast, liberando o contexto de Web Audio e ativando o bloqueio de desligamento de tela (`WakeLock API`).

---

## 🔒 Segurança e Acesso Externo (Cloudflare Tunnel + PIN)

O Echo pode ser acessado de **dentro de casa (Wi-Fi)** ou de **qualquer lugar do mundo pelo celular (4G/5G)** com proteção total contra uso não autorizado:

- **URL Pública Oficial:** `https://echo.tfr-info.com.br`
- **PIN de Segurança:** Configurado de forma privada no arquivo `.env` local (`ECHO_PIN`). Sem PIN definido no `.env`, o acesso externo fica bloqueado.
- **Como funciona:**
  - Requisições locais no próprio computador (`127.0.0.1`) são liberadas para que os agentes locais não sofram qualquer atraso.
  - Qualquer requisição vinda pela internet através do Cloudflare Tunnel exige o **PIN de Acesso**.
  - Sem o PIN correto, os endpoints `/api/stream`, `/api/speak` e `/api/events` retornam `401 Unauthorized`.
  - No celular, você só digita o PIN uma vez: o navegador salva a credencial em cookie e `localStorage`.

---

## 📱 Como Conectar o Celular

### Opção 1: Pela Internet (4G/5G ou fora de casa)
1. Abra no navegador do celular (Chrome / Edge / Samsung Internet):
   ```text
   https://echo.tfr-info.com.br
   ```
2. Digite o seu PIN de segurança configurado no `.env` do servidor.
3. Toque uma vez na tela para autorizar o áudio e ativar a retenção de tela acesa (WakeLock).

### 📲 Instalando como Aplicativo (PWA Mobile)
O Echo é uma **Progressive Web App (PWA)** completa com Service Worker, cache de carregamento instantâneo e ícones cyberpunk nativos em alta resolução:
1. Ao abrir `https://echo.tfr-info.com.br` no Chrome do Android, toque no menu de 3 pontinhos (`⋮`) ou no banner de instalação.
2. Selecione **"Instalar aplicativo"** (ou **"Adicionar à tela inicial"**).
3. O ícone oficial do Echo com o Kaomoji ciano neon `\ ( ^ _ ^ ) /` ficará na tela inicial do seu celular, abrindo em tela cheia (Display Standalone/Fullscreen OLED) sem barras de endereço do navegador.

### Opção 2: Pela Wi-Fi de Casa
1. Abra no celular:
   ```text
   http://192.168.1.4:4884
   ```
2. Dê um toque na tela para ativar som e WakeLock.

---

## ⚡ Inicialização Nativa em Segundo Plano no Windows (Task Scheduler)

O Echo foi configurado como um serviço autônomo e permanente no **Agendador de Tarefas do Windows (Task Scheduler)** sob o nome `EchoCompanion`:

- **Gatilho de Logon (`AtLogOn`):** O servidor inicia automaticamente ao fazer login no Windows, sem necessidade de intervenção humana ou inicialização manual por agentes/IDEs.
- **Execução Oculta (`echo-daemon.vbs`):** Disparado via `wscript.exe`, rodando o processo do Node em background sem abrir nenhuma janela de prompt de comando visível.
- **Política de Auto-Recuperação (`RestartOnFailure`):** Caso o processo seja encerrado acidentalmente ou sofra uma exceção, o Agendador de Tarefas do Windows o reinicia automaticamente em 1 minuto (até 10 tentativas sucessivas).
- **Sem Limites de Tempo de Execução (`PT0S`):** Configurado sem o tempo limite padrão de 72 horas do Windows, permitindo execução ininterrupta.
- **Independência Total da IDE:** O agente de IA opera com 0 tarefas pendentes ou instâncias daemon no terminal do editor.
- **Logs de Execução:** Redirecionados para `echo.log` na raiz do projeto para auditoria e depuração rápida.

---

## 🔌 Integração com os Agentes de IA

O Echo inclui um despachante universal ultrarrápido (`bin/dispatcher.js`) que envia eventos em menos de 50ms para a porta 4884 via HTTP, sem jamais bloquear ou atrasar a execução dos agentes.

- **Claude Code:** Configurado em `~/.claude/settings.json` nos eventos `PreToolUse` e `Stop`.
- **Antigravity:** Configurado em `~/.gemini/config/hooks.json` interceptando execuções de ferramentas e finalização.
- **Codex CLI:** Configurado em `~/.codex/config.toml` através do disparador `notify` chamando `bin/codex-notify.cmd`.

---

## 🧠 Conectores e Inteligência do Ecossistema (Function Calling)

### Navegação por voz no Waze (Android)

Com o Echo aberto no Android e o microfone autorizado:

1. Cadastre o destino dizendo: **“Echo, meu endereço de trabalho é Rua das Flores, 123, Centro, Serra, ES.”** Use seu endereço real, incluindo cidade e estado, e confira o cartão. Para corrigir, repita o cadastro completo.
2. Diga: **“Echo, iniciar uma viagem até o meu trabalho.”** Também aceita “ir para o trabalho” e “abra o Waze para meu trabalho”.
3. O Echo fala a resposta e tenta abrir o Waze. Se o Android exigir um toque, use **Abrir Waze** no cartão.
4. Confira o resultado da busca e confirme a viagem dentro do Waze quando solicitado. Um endereço textual pode retornar mais de um resultado.

Sem destino salvo, o Echo pede o endereço e não abre uma rota. O cadastro exige local e cidade separados por vírgula (essa validação de formato não verifica a existência do endereço). O destino fica na chave `navigation_work_address` da tabela existente `user_preferences`; não há migration. O endereço é dado pessoal e, como as demais preferências atuais, pode integrar o contexto enviado ao Gemini em conversas posteriores.

Os comandos principais são tratados localmente sem depender do Gemini. A ferramenta `iniciar_viagem_trabalho` atende outras formulações reconhecidas pelo modelo. A ação é retornada apenas na resposta HTTP do pedido, nunca pelo SSE compartilhado com outros dispositivos. O link é construído e validado para `https://waze.com/ul`, com endereço codificado e `navigate=yes`, conforme a [documentação oficial do Waze](https://developers.google.com/waze/deeplinks).

Limites: o navegador pode bloquear a abertura automática; o Waze pode exigir escolha do resultado ou confirmação. Sem Waze instalado, o link pode abrir a página web. Não existe confirmação automática de que a navegação começou. O Echo precisa estar ativo e conectado ao servidor; não escuta comandos com garantia em segundo plano ou tela bloqueada. Não há integração com conta Waze.

O cartão com **Abrir Waze** permanece visível durante atualizações de telemetria e após o tempo normal dos cartões; um novo cartão substitui a ação anterior. Isso permite usar o botão mesmo se a tentativa automática for bloqueada.

Validação automatizada: `node --test tests/navigation.test.js`. Os testes usam memória e cliente simulados, sem alterar SQLite real ou chamar Gemini/Waze. A validação final em Android real permanece necessária, incluindo PWA, bloqueio de abertura, destino correto e confirmação da viagem. Após atualização do backend, reinicie a tarefa `EchoCompanion` (parada/início, dentro do escopo autorizado) para carregar a nova versão. O HTML atualizado sozinho não significa que o backend foi recarregado. Reabra o Echo no celular para carregar os arquivos novos.

O Echo possui raciocínio conversacional alimentado pelo Gemini e integrado diretamente aos sistemas e bancos de dados locais do ecossistema Estratégia Nerd via Function Calling:

- ⚡ **Briefing do Sistema & Verificações (`executar_briefing_sistema` / Botão `CHECK` / `POST /api/briefing`):** Dispara uma checagem integrada do ecossistema com saudação contextual pelo horário de Brasília, verificando os 24 serviços e bancos, conferindo a execução dos backups diários e agendamentos do Windows, listando as tarefas pendentes no The Forge e lendo e-mails não lidos. O Echo responde em áudio neural fluente e apresenta o card consolidado com layout espaçoso sem sobreposições.
- 🕒 **Tarefas Agendadas do Windows (`src/connectors/scheduledTasks.js`):** Consulta segura com cache de 60s via `Get-ScheduledTaskInfo` para checar os backups diários de todos os projetos, backup do blog/banco de dados e publicador do Instagram.
- 📧 **Conector Modular de E-mails (`src/connectors/email.js`):** Integração IMAP nativa sobre TLS pronta para consultar a quantidade de e-mails não lidos na Caixa de Entrada via credenciais seguras no `.env`.
- 🟢 **Monitor de Serviços em Tempo Real (`consultar_monitor_servicos`):** Conecta-se ao monitor contínuo NerdOPS (`:5000`) com fallback para o The Forge (`:4477`), checando a saúde operacional de todos os apps locais, bancos de dados (SQLite, MySQL, MariaDB, PostgreSQL), túneis Cloudflare e integrações de todos os 5 projetos em menos de 50ms.
- 💰 **Finanças Pessoais Strategy Hub (`consultar_saldos_bancos`, `consultar_cartoes_credito`, `consultar_contas_a_pagar`):** Saldos consolidados e por instituição (Mercado Pago, Itaú, XP, PicPay), limites e faturas abertas de cartões e contas a pagar do mês.
- 🔨 **Painel Central The Forge (`consultar_projetos_forge`, `consultar_tarefas_forge`, `consultar_status_backup_forge`):** Progresso e status de cada projeto, tarefas pendentes/concluídas e integridade dos backups locais.
- 📱 **Conteúdo Estratégia Nerd (`consultar_agendamento_posts`, `consultar_metricas_blog`, `consultar_metricas_instagram`):** Fila de postagens agendadas, métricas de audiência, curtidas, comentários e inscritos.
- ⚔️ **RPG & Hábitos GYM-OS (`consultar_treino_e_streak_gym_os`):** Treino planejado para o dia, streak de dias consecutivos e evolução de nível/XP no RPG da vida real.
- 🧠 **Memória de Longo Prazo (`gravar_preferencia_usuario`, `consultar_preferencias_usuario`):** Banco local SQLite que preserva preferências, hábitos e fatos ensinados pelo usuário ao Echo.

---

## 🌸 Luna // Assistente Pessoal Dedicada

Mascote companheira desenvolvida especialmente para uso pessoal com inteligência dedicada para responder perguntas do dia a dia, culinária/receitas, organização, resumos e conversação leve, operando em rota e PWA completamente isolados:

- **Rota de Acesso:** `/luna` (ex.: `https://echo.tfr-info.com.br/luna` ou `http://localhost:4884/luna`)
- **Autenticação por PIN Exclusivo:** Configurado via variável `LUNA_PIN` no `.env` (independente do PIN do Echo). Pode ser pré-carregado via URL (`/luna?pin=SEU_PIN`).
- **Modo Mãos-Livres Contínuo:** Microfone com escuta contínua ativa por padrão (`ATIVO`), detecção inteligente de final de frase e retorno automático à escuta após a fala com cooldown anti-eco de 1.2s.
- **Previsão do Tempo em Tempo Real:** Integrado com Open-Meteo para Serra/ES (temperatura, sensação térmica, umidade, vento, máxima, mínima e probabilidade de chuva), respondendo com afeto e precisão às dúvidas do dia a dia.
- **Tema Visual:** Lilás / Lavanda Neon (`#b794f4`, `#c084fc`, `#805ad5`) com fundo escuro elegante OLED (`#0a0612`).
- **Laço na Cabeça Animado:** Desenhado no topo da cabeça com física vetorial acoplada à superelipse do corpo, balançando de forma suave e orgânica ao acompanhar a respiração, fala e inclinação da mascote.
- **Voz Neural Oficial:** Microsoft Edge Neural `pt-BR-ThalitaNeural` (voz feminina jovem, dinâmica e natural em português do Brasil).
- **PWA Dedicado:** Possui manifesto próprio (`manifest-luna.json`) e ícone SVG exclusivo (`icon-luna.svg`) para instalação na tela de início do celular como aplicativo independente.
- **Backend Exclusivo:** Endpoint `/api/luna/converse` alimentado por Gemini com System Prompt acolhedor, conciso e livre de jargões técnicos ou telemetrias de PC.

---

## 🏗️ Estrutura do Projeto

```text
echo-companion/
├── bin/
│   ├── codex-notify.cmd    # Wrapper para hook do Codex CLI
│   └── dispatcher.js       # Bridge HTTP ultrarrápido com classificação de leitura vs escrita
├── public/
│   ├── app.js              # Cliente SSE, física do mascote Echo, áudio neural e PIN auth
│   ├── index.html          # Interface OLED do Echo com botões de ação e telemetria
│   ├── manifest.json       # Configuração PWA do Echo
│   ├── styles.css          # Estilização Cyberpunk Neon do Echo
│   ├── luna.html           # Interface dedicada da Luna (minimalista, sem telemetrias)
│   ├── luna.js             # Motor 2D da Luna com laço animado e voz Thalita
│   ├── luna.css            # Estilos em Lavanda/Lilás Neon da Luna
│   ├── manifest-luna.json  # Manifesto PWA da Luna
│   ├── icon-luna.svg       # Ícone vetorial da Luna com laço
│   └── sw.js               # Service Worker unificado com auto-update v4.0
├── src/
│   ├── connectors/         # Conectores com os projetos locais
│   │   ├── briefing.js     # Orquestrador de briefing e saudação diária
│   │   ├── email.js        # Leitura opcional de e-mails não lidos via IMAP TLS
│   │   ├── estrategiaNerd.js # Métricas e agendamentos do Blog/Instagram
│   │   ├── forge.js        # Projetos, tarefas e status de backups
│   │   ├── gymOs.js        # Treinos, streaks e missões RPG
│   │   ├── scheduledTasks.js # Status do Windows Task Scheduler e backups
│   │   ├── servicesMonitor.js # Monitor em tempo real de serviços, bancos e túneis (NerdOPS)
│   │   └── strategyHub.js  # Saldos bancários, cartões e contas a pagar
│   ├── memory.js           # Memória de longo prazo e preferências em SQLite
│   └── tools.js            # Definição e execução das ferramentas de Function Calling
├── package.json            # Dependências mínimas
├── server.js               # Hub local (SSE, webhook, telemetria, TTS, briefing, trava de PIN)
└── README.md               # Documentação técnica e guia de uso
```

---

## 📊 The Forge & Repositório Oficial

- **GitHub Oficial:** [https://github.com/tarenr/echo-companion](https://github.com/tarenr/echo-companion)
- **Painel The Forge:** Projeto ID 10
- **URL Local:** `http://localhost:4884`
- **URL Cloudflare:** `https://echo.tfr-info.com.br`
- **Categoria:** Assistente / Monitoramento

