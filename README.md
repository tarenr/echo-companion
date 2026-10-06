# Echo // Estratégia Nerd Companion 🤖

[![GitHub Repository](https://img.shields.io/badge/GitHub-tarenr%2Fecho--companion-blue?logo=github)](https://github.com/tarenr/echo-companion)
[![License: ISC](https://img.shields.io/badge/License-ISC-green.svg)](https://opensource.org/licenses/ISC)

> **Painel de mesa inteligente e minimalista para smartphone (local ou remoto via Cloudflare), integrado aos agentes de IA (Claude Code, Antigravity, Codex CLI) com Kaomoji expressivo, telemetria do PC, voz neural gratuita do Microsoft Edge (Antonio) e proteção por PIN.**

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
4. **Personagem: robô** (desde 06/10/2026, no lugar da "bolha"; motor em `public/robo-motor.js`, roupas em `public/robo-roupas.js`):
   - **Aparência:** cabeça clara arredondada, visor escuro com olhos luminosos na cor do estado, boca `_`, quadro no alto da cabeça que só aparece durante ações (pontinhos trabalhando ou pensando, `!` na aprovação; some parado, ouvindo, dormindo, no fim e na entrada), pescoço, corpo com tela `>_` no peito e brilho de flutuação no chão.
   - **Estados e cores:** os mesmos de antes (repouso, trabalhando, multiagente, pensando, aprovação, concluído, erro, ouvindo, dormindo), com os mesmos sons do Echo em cada troca de estado.
   - **Rosto como peça única:** visor, olhos, boca, bochechas e óculos saem de um só ponto e uma só escala; ao olhar para os lados, para cima, para baixo ou girar, andam juntos.
   - **Regra estrita da boca:** a boca varia ESTRITAMENTE entre `_` (fechada/repouso) e `o` (aberta/falando); dormindo, some.
   - **Mãos:** as mãos redondas aparecem ao falar e ao dançar; na entrada, uma delas acena.
   - Animações, reações ao toque, guarda-roupa, janela flutuante e sensor de movimento: ver [Personagem do Echo](#-personagem-do-echo-robô). Backup da bolha: `docs/legado/`.
5. **Design Responsivo Híbrido (Retrato & Paisagem)**:
   - **Em pé (Retrato / Celular na mesa):** O mascote ocupa a parte superior e, ao responder consultas estruturadas de dados (Backups, Telemetria, Bancos, Cartões, Contas, Tarefas do Forge, Posts agendados do Estratégia Nerd, Treinos do Gym OS), desliza suavemente para cima e direciona o olhar para baixo (`mochi.look.y = 0.85`), abrindo o painel de cards neon na metade inferior sem espremer o texto.
   - **Deitado (Paisagem):** O mascote desliza suavemente para a esquerda e fixa o olhar para a direita (`mochi.look.x = 0.85`), mantendo o painel lateral clássico.
   - **Rotação Livre e Fluida:** O PWA opera com `orientation: any`, adaptando-se instantaneamente em tempo real quando o celular é girado. Ao finalizar a apresentação dos dados, retorna suavemente para o centro da tela (`.mode-full`).
   - **Cartões compactos (`src/cards.js`):** o selo diz o assunto e o título traz o número principal (ex.: total dos saldos, `22/24 online`). Abaixo vêm linhas de rótulo e valor com uma bolinha de status (verde ok, âmbar atenção, vermelho erro): um banco, cartão, conta, serviço com problema, backup ou tarefa do Forge por linha, até 8 linhas. A barra de progresso só aparece quando o cartão tem um percentual (telemetria). Em pé, o mascote encolhe para o cartão ocupar a metade de baixo; deitado, o cartão fica entre as barras de cima e de baixo. Se passar do espaço, o cartão rola, e ele não fecha enquanto você rola ou toca nele; os eventos em tempo real dos agentes também não o fecham antes do tempo. Consulta que falhou aparece como "Indisponível" com o erro, nunca como sucesso.
6. **Ciclo de Ociosidade e Modo Dormindo (`sleeping`)**:
   - **Ocioso (Idle):** Em repouso, alterna a cada 20 a 30s entre poses orgânicas (`¯\_( ¬ _ ¬ )_/¯`, `~( ˘ _ ˘ ~)`, `( ^ _ ^ )`).
   - **Xícara de Café (`coffee`):** Ativado após 3 minutos sem interação.
   - **Modo Dormindo (`sleeping`):** Ativado após 6 minutos de inatividade ou por comando de voz direto ("boa noite", "vai dormir", "soneca"). Apresenta arcos serenos nos olhos `( ˘ _ ˘ )`, respiração lenta e profunda (física senoidal), partículas flutuantes lilás de `z Z z` e dimerização suave de brilho da tela (economia para telas OLED). Desperta instantaneamente com toque na tela, comando de voz ou eventos em tempo real dos agentes de IA.
7. **Telemetria do PC**: Uso contínuo de CPU e memória RAM (com alarme automático quando a CPU ultrapassa 90%).
8. **Voz Neural Oficial em Português (Edge TTS Antonio)**: Fala com voz brasileira natural, dinâmica e de alta fidelidade (`pt-BR-AntonioNeural`), transmitida em streaming direto MP3 a 24kHz com entrega instantânea (~1s), fluidez conversacional e custo zero sem necessidade de chave de API externa.
9. **Desbloqueio de Áudio e WakeLock em Toque Único**: O aviso inicial de ativação de som fecha imediatamente em qualquer toque na tela ou diretamente no toast, liberando o contexto de Web Audio e ativando o bloqueio de desligamento de tela (`WakeLock API`). O navegador solta esse bloqueio sempre que o app sai da frente (outro app, barra de notificações, tela bloqueada); por isso Echo, Luna e a página do robô pedem a tela acesa de novo ao voltar para a frente e a cada toque, se tiver sido perdida. Só funciona em HTTPS (endereço da Cloudflare) ou em `localhost`; pelo IP local em HTTP o navegador não permite.
10. **Sons do mascote (opcionais, só locais)**: arquivos `.wav` colocados em `data/sounds/` (pasta fora do repositório) são entregues pela rota `/api/sounds/:nome`, que exige PIN, e tocados nas trocas de estado (`work`, `think`, `approval`, `error`, `finish`, `sleep`), no toque (`slap`), nas expressões (`love`, `pop`, `proud`) e ao liberar o áudio (`greet`). Cada som toca só quando o estado muda, não a cada evento. Sem o arquivo, o Echo usa os tons sintetizados no navegador. Os sons nunca vão para `public/` nem para o git.
11. **Alertas com prioridade sobre a escuta**: com o mãos-livres ativo (padrão), pedidos de aprovação e erros aparecem na hora, com painel e pose, mesmo enquanto o microfone está ouvindo; a fala do alerta espera o fim da escuta. Os demais estados preservam a pose de "ouvindo". Enquanto o microfone espera não há balão: o botão roxo (ATIVO) e a pose de escuta indicam o microfone ligado, e o balão só aparece com o texto que o Echo entendeu da sua fala.
12. **Sem zoom por toque**: Echo e Luna bloqueiam pinça e toque duplo (`touch-action: pan-x pan-y` e cancelamento de gestos com dois dedos), evitando que a tela fique ampliada e pareça travada. Se o celular tiver "forçar ativação do zoom" ligado na acessibilidade do navegador, vale desligar.
13. **Controles legíveis em pé**: em pé, topo e rodapé têm fontes maiores e os botões do rodapé dividem a largura com 44 px de altura (o status da conexão fica numa linha acima). Se a página for montada bem mais larga que a tela de um aparelho de toque (modo "Site para computador"), aparece uma vez um aviso para desativar esse modo.
14. **Mascote proporcional e balão que não cobre o mascote**: o tamanho do Echo acompanha a área livre da tela (em pé, até 80% da largura e 380 px; deitado, até 42% da largura e 340 px) e o desenho continua nítido em qualquer tamanho. O balão de fala tem altura fixa de 3 linhas: quando o texto é maior, ele sobe acompanhando a fala (pela posição do áudio da voz neural, pela palavra dita pela voz do navegador ou, sem áudio, no ritmo de leitura); a sua fala transcrita mostra sempre as últimas palavras. Com o balão visível, o mascote fica abaixo dele e encolhe se faltar espaço; em tela deitada e baixa, o balão vai para o lado do mascote, que mantém o tamanho. Com um cartão aberto, o mascote reduzido vai para a área livre (acima do cartão em pé, à esquerda dele deitado, com o balão em cima dele); em pé, se o balão aparecer junto com o cartão, o cartão encolhe e rola para sobrar espaço entre os dois.

### 🤖 Personagem do Echo (robô)

O Echo usa o robô do motor compartilhado (`public/robo-motor.js`), o mesmo da página de testes `/robo.html`.

| Animação | Acontece quando… |
|---|---|
| Estados, cores e acessórios de trabalho | como antes: lupa ao consultar dados, teclado enquanto o Gemini pensa, impressora em resumos de valores, comemoração ao bater meta, café com 3 min parado, dormir com 6 min parado ou "boa noite" |
| Entrada (cai, amassa, quica, desliza, acena e volta) | ao abrir o Echo; ao acordar do sono (toque, voz ou evento de agente); ao voltar ao app depois de mais de 30 min fora |
| Dança (balanço, pulinhos e mãos) | comando de voz "dança", "dançar", "dance" ou "vamos dançar" (com ou sem "Echo"): 10 s, sem consultar o servidor; na comemoração: 4 s |
| Troca de roupa | quando você escolhe uma peça; no automático, ao abrir e quando vira o dia |
| Balanço das roupas | o tempo todo (pulos, inclinação, giro, toque e dança) |
| Inclinar (olha e se inclina para o lado mais baixo) | "Sensor de movimento" ligado e o celular inclinado |
| Tonto (olhos em espiral por 2 s) | celular chacoalhado, com o sensor ligado |

**Quadro da cabeça:** só aparece quando o robô está fazendo alguma ação; cresce ao aparecer e encolhe ao sumir.

| Estado | Quadro |
|---|---|
| Trabalhando, Multiagente | aparece, com pontinhos |
| Pensando | aparece, com pontinhos roxos |
| Aprovação | aparece, com `!` |
| Repouso, Ouvindo, Dormindo, Concluído, Erro | some (os olhos e a cor já mostram o estado) |
| Entrada (abrir, acordar, voltar ao app) | o robô entra sem o quadro; se houver ação, ele aparece quando a entrada acaba |

**Reações ao toque no robô:** 1 toque achata; 2 toques rápidos pulam e giram; 5 ou mais toques em 2 s deixam o robô bravo (olhos inclinados e vermelho); toque no visor = surpresa; toque na tela do peito mostra outro símbolo (♥, :), !, ?, ♪); toque no chapéu faz o chapéu pular; passar o dedo na cabeça é carinho (olhos felizes, bochechas e corações); **segurar 0,6 s abre a folha Personagem**. Com o robô dormindo, o toque acorda.

**Folha Personagem:** as 11 peças do guarda-roupa (cabeça, rosto e pescoço; uma por lugar, combináveis; tocar de novo tira), "Automático (estação)" ligado por padrão (veste pelas datas da tabela da seção do robô; escolher uma peça à mão desliga), "Tirar tudo", "Janela flutuante" (aparece só onde o navegador permite) e "Sensor de movimento" (desligado por padrão; aparece só onde o navegador tem sensor). O Echo guarda a escolha no próprio navegador (`echo_personagem`).

**Sensor de movimento:** liga e desliga na folha Personagem. O Echo lembra a escolha: ao reabrir com o sensor ligado, ele volta sozinho ou, se o navegador exigir um toque (iPhone, Chrome recente), no primeiro toque na tela. Útil fora de casa; no suporte, deixe desligado.

| Situação | Inclinar o celular | Chacoalhar |
|---|---|---|
| Normal | olha e se inclina para o lado mais baixo | fica tonto |
| Cartão aberto | só o corpo inclina; continua olhando para o cartão | fica tonto |
| Dormindo | nada | acorda (com a entrada) |

Muito inclinado (celular inclinado e tonto ao mesmo tempo), o robô recua um pouco para o quadro da cabeça não sair pelo alto. Sem leitura do sensor em 1,5 s (PC ou endereço HTTP), o botão desliga e avisa; só funciona pelo endereço HTTPS.

**Janela flutuante:** no PC (Chrome/Edge 116+), o robô vai para uma janela pequena sempre na frente, continua tocável e reagindo aos agentes, e volta ao palco quando ela fecha. No Android, vira um vídeo flutuante do robô por cima dos outros apps (só para ver).

**Fica só na página de testes:** dança pelo microfone (o Echo usa o microfone para ouvir você).

**Sons:** os sons do Echo continuam (os seus `.wav` locais ou os tons); a entrada usa sons próprios do robô, gerados no navegador.

---

## 🔒 Segurança e Acesso Externo (Cloudflare Tunnel + PIN)

O Echo pode ser acessado de **dentro de casa (Wi-Fi)** ou de **qualquer lugar do mundo pelo celular (4G/5G)** com proteção total contra uso não autorizado:

- **URL Pública Oficial:** `https://echo.tfr-info.com.br`
- **PIN de Segurança:** Configurado de forma privada no arquivo `.env` local (`ECHO_PIN`). Sem PIN definido no `.env`, o acesso externo fica bloqueado.
- **Como funciona:**
  - Requisições feitas no próprio computador (`127.0.0.1`, sem passar pelo túnel) são liberadas para que os agentes locais não sofram qualquer atraso.
  - Qualquer requisição vinda pela internet (Cloudflare Tunnel) ou pela rede de casa exige o **PIN de Acesso**, enviado por cabeçalho (`x-echo-pin`), parâmetro `?pin=` ou cookie.
  - Sem PIN, quem vem de fora só recebe o que as telas de entrada precisam: `/`, `index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.json`, os ícones, os arquivos do robô (`robo-motor.js` e `robo-roupas.js`, só desenho e código, carregados antes do PIN), os da localização e os da Luna (`/luna`, `luna.*`, `manifest-luna.json`, `icon-luna.svg`). Todo o resto de `public/` e todas as rotas `/api/` (inclusive `/api/events`, `/api/sounds`, `/api/stream`, `/api/speak`) respondem `401`.
  - **Tela de PIN nas páginas protegidas:** quem abre direto uma página protegida (ex.: `/robo.html`) sem o PIN recebe uma tela de PIN (`src/pinPage.js`) em vez do erro em texto. O PIN vai para `/api/auth/verify`, que grava o cookie, e a página recarrega liberada. Scripts, estilos e API continuam recebendo o `401` em JSON.
  - **Limite de tentativas:** 10 PINs errados diferentes em 15 minutos bloqueiam aquele IP por 15 minutos (`429` com `Retry-After`). Os contadores do Echo e da Luna são separados, enviar sem PIN não conta como erro e repetir o mesmo PIN errado (cookie antigo, reconexão) conta uma vez. Reiniciar o serviço zera os contadores. No Wi-Fi, o celular e o PC saem pelo mesmo IP na internet.
  - O IP informado pelo Cloudflare (`cf-connecting-ip`) só é aceito quando a conexão vem do próprio PC, onde roda o túnel; vindo da rede de casa, vale o endereço real.
  - No celular, você só digita o PIN uma vez: o navegador o guarda no `localStorage` e num cookie `HttpOnly` (com `Secure` quando o acesso vem pelo Cloudflare).
  - O log (`echo.log`) mostra o IP real de quem vem pelo Cloudflare e esconde o PIN que vem na URL (`pin=***`).
  - O Service Worker só guarda no celular os arquivos da tela de entrada; nada protegido por PIN fica no cache.
  - Nomes de agentes e textos que chegam do servidor são exibidos sempre como texto, nunca como HTML.

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

O Echo inclui um despachante universal (`bin/dispatcher.js`) que envia eventos para a porta 4884 via HTTP, sem jamais bloquear ou atrasar a execução dos agentes: processa cada chamada uma única vez, espera no máximo 300 ms pelos dados do agente e sempre termina com código 0 (teto de 900 ms), mesmo com o Echo desligado.

- **Claude Code:** configurado em `~/.claude/settings.json` nos eventos `UserPromptSubmit`, `PreToolUse`, `PermissionRequest`, `Notification` e `Stop`, no formato atual de hooks (cada comando dentro de `"hooks": [{ "type": "command", "command": "...", "timeout": 5 }]`). O despachante lê a ferramenta, o arquivo ou comando e a pasta do projeto: `Write`/`Edit`/`MultiEdit`/`NotebookEdit` e comandos que escrevem viram "implementando"; o resto, "pesquisando". Um pedido de permissão acende a pose de aprovação; as notificações em que o Claude espera você (`idle_prompt`, `elicitation_dialog`, `agent_needs_input`) acendem a espera; as demais são ignoradas. O Claude Code não recebe nenhuma resposta do despachante. Mudanças nos hooks só valem em sessões novas do Claude Code.
- **Antigravity:** Configurado em `~/.gemini/config/hooks.json` interceptando execuções de ferramentas e finalização. Só o Antigravity recebe a resposta `{"decision":"allow"}` no `PreToolUse`.
- **Codex CLI:** Configurado em `~/.codex/config.toml` através do disparador `notify`: o próprio Codex chama o executável dele e passa `bin/codex-notify.cmd` como `--previous-notify`. O `.cmd` muda o console para UTF-8 (`chcp 65001`) para os acentos chegarem certos.
- **Privacidade dos comandos:** o despachante nunca envia o comando inteiro. Vai só o programa e o primeiro argumento (ex.: `Bash: npm test`), com valores longos e `CHAVE=valor` escondidos (`***`), ou o nome do arquivo sem o caminho.
- **Faixa de atividade:** abaixo do agente, no topo, o Echo mostra o passo atual (ex.: `✏️ Edit server.js • echo-companion`) e os 3 anteriores mais apagados (2 em telas baixas). Ícones: 🔍 leitura, ✏️ escrita, ⌘ comando, ✋ permissão, ❓ pergunta, ✓ turno concluído. Com mais de um agente, o nome dele aparece antes do passo. O Claude Code e o Antigravity mostram cada passo (o Antigravity com os nomes internos das ferramentas); o Codex só avisa o fim do turno. A faixa some quando o Echo volta ao STANDBY.

---

## 📲 Aprovar pelo celular (modo celular)

Com o modo celular ligado, os pedidos de permissão e as perguntas (`AskUserQuestion`) do **Claude Code** aparecem num cartão no Echo, e você responde de onde estiver. Codex e Antigravity não entram: o hook deles não permite esperar uma decisão.

**Configuração (uma vez):**
1. Defina `ECHO_APPROVAL_PIN` no `.env` (um segundo PIN, diferente do `ECHO_PIN`) e registre-o no `credenciais.md`. Sem ele, o modo celular fica desativado.
2. As chaves de notificação (`ECHO_VAPID_PUBLIC_KEY`, `ECHO_VAPID_PRIVATE_KEY`, `ECHO_VAPID_SUBJECT`) ficam no `.env`. Para gerar um par novo: `npx web-push generate-vapid-keys`. Trocar as chaves invalida as inscrições, e cada celular precisa ativar as notificações de novo.
3. Reinicie a tarefa `EchoCompanion` para carregar o `.env`.

**Uso:**
- Toque em **CELULAR** no rodapé e digite o segundo PIN para ligar (o botão fica verde). No mesmo toque o Android pede permissão de notificação. Para desligar, basta tocar de novo. O modo vive só na memória do servidor e volta desligado a cada reinício.
- **PIN lembrado:** depois de ligar o modo, o segundo PIN fica lembrado **só na memória** daquele celular (nunca gravado) e é enviado sozinho em cada decisão; o campo some do cartão. Ele é esquecido ao desligar o modo, se o servidor recusar o PIN ou quando o app é fechado ou recarregado (aí o cartão pede o PIN uma vez e volta a lembrar). O servidor continua exigindo o segundo PIN em cada decisão.
- **Pedido de permissão:** o cartão mostra a ferramenta e o programa ou arquivo (nunca o comando inteiro), o projeto e a contagem regressiva. **PERMITIR** e **NEGAR** usam o segundo PIN; **Responder no terminal** devolve o pedido ao terminal na hora.
- **Pergunta do Claude:** uma pergunta por vez, com as opções como botões. Na multi-seleção, marque uma ou mais e toque em **ENVIAR**. O envio usa o segundo PIN.
- **Notificação:** com a tela bloqueada chega só "Claude Code precisa de aprovação" ou "Claude Code fez uma pergunta" e o nome do projeto. Tocar abre o Echo.

**Como funciona:**
- `bin/approval-hook.js` roda nos eventos `PermissionRequest` e `PreToolUse` (matcher `AskUserQuestion`) do `~/.claude/settings.json`, com `timeout: 130`, em paralelo ao despachante.
- O hook só espera quando o modo está ligado, o segundo PIN está configurado e o celular é alcançável: conectado agora (pela internet ou pela rede) **ou** com uma inscrição de notificação registrada, para avisar com a tela bloqueada (o Android corta a conexão do app quando a tela bloqueia). Nos outros casos, ou com o Echo desligado, ele sai na hora sem resposta e o terminal pergunta como sempre. O motivo aparece no `echo.log` (`pedido não enviado ao celular (modo_desligado | sem_celular | sem_segundo_pin)`).
- **O Claude Code só mostra o pedido no terminal depois que o hook responde.** Com o modo ligado, cada pedido espera até 110 s pelo celular antes de aparecer no terminal. Desligue o modo quando estiver no PC.
- Cada pedido tem um identificador aleatório, vale por no máximo 120 s e aceita uma única resposta. Uma resposta depois do prazo é recusada; se o hook for interrompido, o pedido é cancelado; reiniciar o servidor invalida todos.
- O hook nunca libera sozinho: só envia ao Claude Code uma decisão que veio do celular.
- **Segurança das rotas:**
  - criar pedido (`POST /api/approvals/request`) só a partir do próprio PC;
  - decidir (`POST /api/approvals/:id/decision`), ligar o modo (`POST /api/approvals/mode`) e inscrever notificações (`POST /api/push/subscribe`) exigem o PIN do Echo e a origem da página presente e igual ao endereço do Echo;
  - permitir, negar, responder e ligar o modo exigem também o segundo PIN no cabeçalho `x-echo-approval-pin`, inclusive a partir do próprio PC;
  - o segundo PIN tem limite próprio: 5 erros diferentes em 15 minutos bloqueiam aquele IP por 15 minutos.
- As inscrições de notificação ficam em `data/push/subscriptions.json` (fora do git); inscrições vencidas são removidas no envio. A variável `ECHO_PUSH_FILE` troca esse arquivo (usada pelos testes, para não mexer nas inscrições reais).

---

## 🧠 Conectores e Inteligência do Ecossistema (Function Calling)

### Google Agenda — CRUD por voz

O botão **AGENDA** conecta sua conta Google e consulta compromissos da agenda principal. O Echo também prepara criação, edição e exclusão por voz, sempre com confirmação posterior no mesmo dispositivo. Suporta eventos de dia inteiro e recorrentes, com escolha entre ocorrência e série inteira. Os destinos do Waze continuam independentes.

É necessário configurar o cliente OAuth no Google Cloud e no `.env` antes de conectar a conta. Tokens e cópias de recuperação são criptografados e ficam fora do Git, das preferências, dos prompts e dos logs. A leitura e o CRUD reais permanecem pendentes até essa autorização. Convites e administração de calendários ficam fora do escopo.

Exemplos: **“Quais compromissos tenho amanhã?”**, **“Marque dentista dia 10 de outubro, das 14h às 15h”**, **“confirmar agenda”** e **“cancelar agenda”**. Confira o [guia de configuração, uso e recuperação](docs/google-agenda.md) antes de ativar.

### Navegação por voz no Waze (Android)

Com o Echo aberto no Android e o microfone autorizado:

1. Cadastre os destinos dizendo **“meu endereço de DHL é…”**, **“meu endereço de Jayme é…”** ou **“minha casa é…”**, seguido do endereço completo com cidade/estado. Também aceita **“salve Jayme como https://waze.com/ul/…”** com um link compartilhado do Waze. Para corrigir, repita o cadastro desse destino.
2. Diga **“Echo, ir para casa”**, **“ir para DHL”** ou **“iniciar uma viagem até Jayme”**. Os cartões e respostas usam DHL e Jayme; “trabalho 1” e “trabalho 2” continuam funcionando como alternativas, inclusive no cadastro. Os links existentes são preservados. Se houver dois trabalhos e você disser apenas “trabalho”, o Echo pede que repita o comando especificando DHL ou Jayme.
3. O Echo fala a resposta e tenta abrir o Waze. Se o Android exigir um toque, use **Abrir Waze** no cartão.
4. Confira o resultado da busca e confirme a viagem dentro do Waze quando solicitado. Um endereço textual pode retornar mais de um resultado.

Para buscas livres, diga **“Echo, buscar Shopping Vitória no Waze”** ou **“pesquise uma farmácia em Serra no Waze”**. Para uma viagem sem cadastro, diga **“iniciar uma viagem até Rua X, 100, Serra, ES”**. A busca ocorre no Waze, não em um serviço de pesquisa do Echo. Buscas livres não modificam favoritos; buscas genéricas sem “no Waze” continuam no fluxo normal do assistente.

Sem destino salvo, o Echo pede o endereço e não abre uma rota. Endereços cadastrados exigem local e cidade separados por vírgula (o formato não verifica a existência do endereço); buscas livres aceitam nomes de lugares. Os três destinos ficam em `navigation_saved_destinations` da tabela `user_preferences`, sem migration. O endereço antigo em `navigation_work_address` é preservado e serve como trabalho 1 quando não há cadastro novo. Antes de substituir o conjunto existente durante o cadastro autorizado desta entrega, seu valor anterior é preservado em `navigation_previous_saved_destinations` para recuperação. Destinos são dados pessoais e, como as demais preferências atuais, podem integrar o contexto enviado ao Gemini em conversas posteriores. Os links pessoais não ficam no código ou nesta documentação.

Os comandos principais são tratados localmente sem depender do Gemini. A ferramenta `abrir_waze` atende outras formulações reconhecidas pelo modelo; `iniciar_viagem_trabalho` continua compatível. A ação é retornada apenas na resposta HTTP do pedido, nunca pelo SSE compartilhado. Links aceitam exclusivamente `https://waze.com/ul` (busca codificada) ou `/ul/…` (destino compartilhado). Viagens usam `navigate=yes`; buscas não solicitam navegação. Veja a [documentação oficial do Waze](https://developers.google.com/waze/deeplinks).

Limites: o navegador pode bloquear a abertura automática; o Waze pode exigir escolha do resultado ou confirmação. Sem Waze instalado, o link pode abrir a página web. Não existe confirmação automática de que a navegação começou. O Echo precisa estar ativo e conectado ao servidor; não escuta comandos com garantia em segundo plano ou tela bloqueada. Não há integração com conta Waze.

O cartão com **Abrir Waze** permanece visível durante atualizações de telemetria e após o tempo normal dos cartões; um novo cartão substitui a ação anterior. Isso permite usar o botão mesmo se a tentativa automática for bloqueada.

O botão recebe toques mesmo dentro do painel de informações, que é não interativo por padrão. Tanto o botão quanto a tentativa automática no Android usam a mesma aba, sem abrir popup. Se o sistema abrir a página web do Waze em vez do aplicativo, use voltar para retornar ao Echo. A abertura automática de outro aplicativo ainda depende das políticas do Android/navegador.

Validação automatizada: `node --test tests/navigation.test.js`. Os testes usam memória e cliente simulados, sem alterar SQLite real ou chamar Gemini/Waze. A validação final em Android real permanece necessária, incluindo PWA, bloqueio de abertura, destino correto e confirmação da viagem. Após atualização do backend, reinicie a tarefa `EchoCompanion` (parada/início, dentro do escopo autorizado) para carregar a nova versão. O HTML atualizado sozinho não significa que o backend foi recarregado. Reabra o Echo no celular para carregar os arquivos novos.

O Echo possui raciocínio conversacional alimentado pelo Gemini e integrado diretamente aos sistemas e bancos de dados locais do ecossistema Estratégia Nerd via Function Calling:

- ⚡ **Briefing do Sistema & Verificações (`executar_briefing_sistema` / Botão `CHECK` / `POST /api/briefing`):** Dispara uma checagem integrada do ecossistema com saudação contextual pelo horário de Brasília, verificando os 24 serviços e bancos, conferindo a execução dos backups diários e agendamentos do Windows, contando as tarefas pendentes no The Forge e lendo e-mails não lidos. O Echo responde em áudio neural e mostra um cartão compacto, uma linha por item: serviços online (até 2 com problema listados), backups e agendadas numa linha só (`3/3 OK`, com uma linha extra para cada falha), total de pendências do Forge (`26 pendentes em 4 projetos`) e as pendências de até 4 projetos, do maior para o menor (o restante vira `+N projetos`), e e-mails quando configurados. As pendências vêm da contagem de cada projeto no Forge (tarefas totais − concluídas); títulos de tarefas não aparecem no CHECK.
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

## 🤖 Robô // Laboratório do Personagem

Página separada com o mesmo robô do Echo e botões para testar cada animação, mais a dança pelo microfone (que o Echo não usa) e o giroscópio (o mesmo sensor do Echo, vindo do motor). Desde 06/10/2026 o robô é o personagem do Echo (ver [Personagem do Echo](#-personagem-do-echo-robô)).

- **Endereço:** `/robo.html` (ex.: `https://echo.tfr-info.com.br/robo.html`). Usa o PIN do Echo: se o navegador ainda não tiver o PIN, a página mostra a tela de PIN.
- **Personagem:** cabeça clara arredondada, visor escuro com olhos luminosos na cor do estado, boca `_` (falando, `o`), quadro no alto da cabeça que só aparece durante ações (pontinhos trabalhando ou pensando, `!` na aprovação; some parado, ouvindo, dormindo, no fim e na entrada), pescoço, corpo com tela `>_` no peito e brilho de flutuação no chão. As mãos são as mesmas do Echo e aparecem ao falar.
- **Rosto como peça única:** visor, olhos, boca e bochechas são desenhados a partir de um só ponto e uma só escala (`faceFrame` em `public/robo-motor.js`). Ao olhar para os lados, para cima, para baixo ou no giro de comemoração, as partes andam juntas. Na antiga bolha, as bochechas usavam outra conta e não acompanhavam a boca.
- **Botões:** estados (repouso, trabalhando, multiagente, pensando, aprovação, concluído, erro, ouvindo, dormindo), expressões (amor, surpresa, orgulho, feliz), guarda-roupa, acessórios de trabalho (lupa, teclado, impressora, comemoração, café, nenhum), animações (entrada, dançar 10 s, dançar com a música, som), ações (falar, piscar, toque, girar, pular), olhar (esquerda, direita, cima, baixo, centro, para o cartão, seguir o dedo), sensores (sensor de movimento, chacoalhar simulado) e janela flutuante.
- **Motor:** compartilhado com o Echo (`public/robo-motor.js`: robô, rosto, gestos, sensores, ritmo, laço de desenho e janela flutuante); a página (`public/robo.js`) só monta os botões e os testes de microfone e giroscópio. O motor de animação deriva do motor MIT do Coucou; o desenho, as roupas (`public/robo-roupas.js`), as reações e as animações de entrada e dança são próprios. As ideias de guarda-roupa, estações e entrada vêm do Coucou, mas os desenhos e coreografias foram feitos do zero (a aparência e as animações do Mochi são reservadas pela licença do Coucou). No console do navegador, `robo` dá acesso ao personagem para testes.

### Quando cada animação acontece

| Animação | Acontece sozinha quando… | Botão de teste |
|---|---|---|
| Entrada (cai, amassa, quica, desliza, acena e volta ao centro) | a página abre; o robô acorda do modo dormindo (toque nele ou outro estado); você volta para a página depois de mais de 30 min fora | Entrada |
| Troca de roupa (a peça antiga sobe e some, a nova cai e quica; óculos encolhem até o rosto) | você escolhe uma peça; no modo automático, ao abrir a página e quando vira o dia | peças do guarda-roupa |
| Balanço das roupas (pompom, pontas, orelhas, laço, cachecol) | o tempo todo: pulos, inclinação, giro, toque, dança e celular inclinado ou chacoalhado | — |
| Dança (balanço, pulinhos e mãos) | "Dançar com a música" ligado e o microfone ouvindo batidas; para 3 s depois da última | Dançar com a música / Dançar (10 s) |
| Inclinar (olha e se inclina para o lado mais baixo) | "Sensor de movimento" ligado e o celular inclinado | Sensor de movimento |
| Tonto (olhos em espiral por 2 s) | o celular é chacoalhado, com o sensor ligado | Chacoalhar (simulado) |

### Reações ao toque

| Gesto | Reação |
|---|---|
| 1 toque no corpo | achata e as roupas balançam |
| 2 toques rápidos | pula e gira |
| 5 ou mais toques em 2 s | fica bravo: olhos inclinados e vermelho por 2 s, chacoalha |
| toque no visor | pisca e faz cara de surpresa |
| toque na tela do peito | a tela mostra outro símbolo por 2 s (♥, :), !, ?, ♪) |
| toque no chapéu | o chapéu pula e volta |
| passar o dedo na cabeça (carinho) | olhos felizes, bochechas coradas e corações |
| segurar 0,6 s | abre o guarda-roupa (como o botão direito no Coucou) |
| tocar no robô dormindo | acorda com a animação de entrada |

### Guarda-roupa

- **Peças (11, desenhadas em código):** cabeça — chapéu de festa, gorro com pompom, coroa, chapéu de bruxa, gorro de Papai Noel, orelhas de coelho, laço, abóbora; rosto — óculos escuros, óculos redondos; pescoço — cachecol.
- **Peças só de teste (desde 06/10/2026):** a fantasia de esqueleto, em duas peças:
  - **Sorriso costurado (rosto):** curva entre as bochechas com pontos de costura; acompanha o rosto e não combina com óculos.
  - **Terno de esqueleto (pescoço):** preto listrado, camisa branca em V, gravata de morcego cujas asas balançam, e a tela `>_` do peito à mostra; não combina com o cachecol.
  - Ficam em `public/robo-roupas-teste.js`, que só esta página carrega: o Echo não mostra essas peças e o automático (estação) não as usa.
  - Desenho próprio no estilo de fantasia de Halloween, sem braços e sem copiar personagem.
- **Como usar:** tocar numa peça veste; tocar de novo tira. Uma peça por lugar (outro chapéu troca o atual) e dá para combinar os três lugares. "Tirar tudo" tira as três. Segurar o dedo no robô rola a página até o guarda-roupa. Dá para usar junto com os acessórios de trabalho (ex.: gorro e caneca de café).
- **Óculos:** ficam no mesmo referencial do rosto, então acompanham os olhos ao olhar e no giro. Chapéus ficam no alto da cabeça, à direita da etiqueta `>_`, e deslizam um pouco junto com o rosto.
- **Chapéu alto:** o robô recua aos poucos para a peça caber no quadro (até 75% com o chapéu de bruxa).
- **Automático (estação):** ligado por padrão. Escolher uma peça à mão desliga o automático; o topo da página mostra "Automático: …" ou as peças vestidas. "Data de teste" mostra o que o automático vestiria em qualquer dia.

| Período (Brasil) | Automático veste |
|---|---|
| 26/12 a 02/01 | chapéu de festa (Ano Novo) |
| semana da Páscoa (segunda a domingo de Páscoa, calculada a cada ano) | orelhas de coelho |
| 21/06 a 22/09 (inverno) | gorro e cachecol |
| 25/10 a 31/10 | chapéu de bruxa |
| 01 e 02/11 | abóbora |
| 01/12 a 25/12 | gorro de Papai Noel |
| 21/12 a 20/03 (verão), fora das datas acima | óculos escuros |
| resto do ano | nada |

- **Memória:** a página guarda no próprio navegador a roupa, o modo automático e o som (`robo_preferencias`).

### Sons, microfone, sensor e janela flutuante

- **Som:** gerado no navegador, sem arquivos (assobio na queda, "boing" no quique, tom no aceno e no pulo). Só toca com o botão "Som" ligado e depois de um toque na tela, por regra dos navegadores.
- **Dançar com a música:** pede o microfone ao tocar no botão; analisa só os graves (40–160 Hz) para achar batidas, tudo no navegador: nada é gravado nem enviado. Não sabe qual música toca (a web não lê o Spotify); um som alto e contínuo, sem batidas, não faz dançar.
- **Sensor de movimento:** o iPhone e as versões recentes do Chrome pedem permissão ao tocar no botão; nos demais, liga direto. Só funciona pelo endereço HTTPS. Sem leitura em 1,5 s (PC ou endereço HTTP), o botão desliga e avisa.
- **Janela flutuante:** no PC (Chrome/Edge 116+), o robô vai para uma janela pequena sempre na frente, onde continua tocável, e volta à página quando ela fecha. No Android (Chrome 105+), ou se a janela do PC for recusada, vira um vídeo flutuante do robô por cima dos outros apps, só para ver; enquanto isso, um relógio em segundo plano (Worker) continua desenhando. Os dois abrem só com um toque no botão.

- **Testes:** `tests/robo.test.js` confere que as partes do rosto mantêm as mesmas distâncias em qualquer olhar e giro, que o rosto não sai da cabeça, que a tela acesa é pedida de novo no Echo, na Luna e no robô, a Páscoa e a tabela de estações, a mola das roupas, o guarda-roupa e a transição, o recuo para chapéu alto, os óculos sobre os olhos, os gestos, o sensor e o detector de batidas. `tests/robo-echo.test.js` confere a troca no Echo (scripts, lista pública, cache, sons, entrada ao acordar, dança e o comando de voz) e `tests/pin-page.test.js`, a tela de PIN.

---

## 🏗️ Estrutura do Projeto

```text
echo-companion/
├── bin/
│   ├── approval-hook.js    # Hook do modo celular: espera a aprovação/resposta do celular (nunca libera sozinho)
│   ├── codex-notify.cmd    # Wrapper para hook do Codex CLI
│   └── dispatcher.js       # Bridge HTTP com classificação de leitura vs escrita e comandos resumidos
├── data/                   # Banco SQLite da memória e sons opcionais em data/sounds/ (fora do git)
├── docs/                   # Guias: Google Agenda, opções de voz e ferramentas do ecossistema; legado/ guarda a antiga bolha
├── public/
│   ├── app.js              # Cliente SSE, robô do Echo (pelo motor), folha Personagem, áudio neural e PIN auth
│   ├── index.html          # Interface OLED do Echo com botões de ação e telemetria
│   ├── manifest.json       # Configuração PWA do Echo
│   ├── styles.css          # Estilização Cyberpunk Neon do Echo
│   ├── luna.html           # Interface dedicada da Luna (minimalista, sem telemetrias)
│   ├── luna.js             # Motor 2D da Luna com laço animado e voz Thalita
│   ├── luna.css            # Estilos em Lavanda/Lilás Neon da Luna
│   ├── manifest-luna.json  # Manifesto PWA da Luna
│   ├── icon-luna.svg       # Ícone vetorial da Luna com laço
│   ├── robo.html           # Página de testes do segundo personagem (robô)
│   ├── robo-motor.js       # Motor do robô (Echo e laboratório): rosto, gestos, sensores, ritmo, laço e janela flutuante
│   ├── robo.js             # Laboratório do robô: botões, dança pelo microfone e giroscópio
│   ├── robo-roupas.js      # Guarda-roupa do robô: 11 peças, estações (com a Páscoa) e física das roupas
│   ├── robo-roupas-teste.js # Peças só da página de testes (fantasia de esqueleto), antes de irem para o Echo
│   ├── robo.css            # Estilos da página do robô
│   └── sw.js               # Service Worker (cache v5.1 só do shell público, auto-update)
├── src/
│   ├── connectors/         # Conectores com os projetos locais
│   │   ├── briefing.js     # Orquestrador de briefing e saudação diária
│   │   ├── email.js        # Leitura opcional de e-mails não lidos via IMAP TLS
│   │   ├── estrategiaNerd.js # Métricas e agendamentos do Blog/Instagram
│   │   ├── forge.js        # Projetos, tarefas e status de backups
│   │   ├── googleCalendar.js # Cliente da API do Google Agenda
│   │   ├── gymOs.js        # Treinos, streaks e missões RPG
│   │   ├── scheduledTasks.js # Status do Windows Task Scheduler e backups
│   │   ├── servicesMonitor.js # Monitor em tempo real de serviços, bancos e túneis (NerdOPS)
│   │   ├── strategyHub.js  # Saldos bancários, cartões e contas a pagar
│   │   └── weather.js      # Previsão do tempo (Open-Meteo)
│   ├── calendarAuth.js     # OAuth do Google Agenda com tokens criptografados
│   ├── calendarRoutes.js   # Rotas /api/calendar e comandos de agenda por voz
│   ├── calendarService.js  # CRUD da agenda com confirmação por dispositivo
│   ├── calendarStore.js    # Armazenamento local criptografado da agenda
│   ├── approvals.js        # Pedidos do modo celular: prazo, uso único, resumo seguro e texto da notificação
│   ├── cards.js            # Cartões de dados: título com o número principal e linhas com status
│   ├── pinPage.js          # Tela de PIN de quem abre uma página protegida sem o PIN
│   ├── memory.js           # Memória de longo prazo e preferências em SQLite
│   ├── navigation.js       # Destinos salvos e links do Waze
│   └── tools.js            # Definição e execução das ferramentas de Function Calling
├── tests/                  # Testes (node --test): cartões, agenda, navegação, robô, Echo com o robô e tela de PIN, sem banco real
├── package.json            # Dependências mínimas; `npm test` roda os testes
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


## Localização entre Echo e Luna

Compartilhamento opt-in do GPS enquanto cada aplicativo estiver aberto e visível. Pergunte onde o outro mascote está; a resposta distingue posição recente e última conhecida, informa precisão e permite abrir o mapa. Sem histórico de trajetos, com revogação e armazenamento criptografado. GPS/mapa não exigem API Google. A resposta traz o endereço completo (rua, número, bairro, cidade, UF e CEP, aproximado) pelo OpenStreetMap, gratuito e sem chave: as coordenadas vão para lá só ao consultar. Com `LOCATION_GOOGLE_GEOCODING_KEY`, usa o Google; `LOCATION_GEOCODING=off` desliga o endereço. Veja [ativação, privacidade e testes](docs/localizacao-compartilhada.md).
