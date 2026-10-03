# Ferramentas e Integração do Ecossistema — Echo Companion

Documentação técnica da camada de inteligência com **Gemini Function Calling**, **Memória Persistente SQLite** e **Mascote 2D Reativo** do Echo Companion.

---

## 1. Visão Geral da Arquitetura

O Echo atua como um companheiro inteligente de mesa capaz de responder perguntas por voz, monitorar a telemetria do PC em tempo real e consultar o estado de todos os projetos do ecossistema local.

```
[ Usuário (Voz / Web PWA) ]
              │
              ▼
   [ Echo Server (4884) ] ── (Edge Neural TTS: pt-BR-AntonioNeural)
              │
    ┌─────────┴───────────────────────────────┐
    ▼                                         ▼
[ Gemini 2.5 / Flash-Lite ]          [ Memória Persistente ]
  (Function Calling)                   data/echo_memory.sqlite
    │                                    - conversation_history
    │ (invoca tools)                     - user_preferences
    ▼                                    - tool_executions
[ src/tools.js & src/connectors/ ]
    ├── strategyHub.js   ──► MySQL (strategy_hub)
    ├── forge.js         ──► HTTP API (127.0.0.1:4477)
    ├── estrategiaNerd.js──► MySQL (estrategia-nerd)
    └── gymOs.js         ──► SQLite (GYM-OS/data/gym-os.sqlite)
```

---

## 2. Catálogo de Ferramentas (Gemini Function Calling)

| Ferramenta | Descrição | Origem de Dados | Acessório Visual 2D |
|---|---|---|---|
| `consultar_saldos_bancos` | Consulta o saldo consolidado e de todos os bancos cadastrados (Mercado Pago, Itaú, XP, PicPay, etc.) | Strategy Hub (MySQL) | Impressora (`printer`) |
| `consultar_cartoes_credito` | Consulta cartões ativos, limites e faturas em aberto ou vencimentos | Strategy Hub (MySQL) | Impressora (`printer`) |
| `consultar_contas_a_pagar` | Consulta despesas pendentes e contas do mês com datas de vencimento | Strategy Hub (MySQL) | Impressora (`printer`) |
| `consultar_projetos_forge` | Lista projetos catalogados no painel The Forge com progresso e status | The Forge (`/api/projects`) | Lupa (`lupa`) |
| `consultar_tarefas_forge` | Consulta tarefas filtradas por projeto (ex: Echo) e status (pendente/concluída) | The Forge (`/api/tasks`) | Lupa (`lupa`) |
| `consultar_status_backup_forge` | Consulta integridade dos backups agendados e snapshots (somente-leitura) | The Forge (`/api/backup/status`) | Lupa (`lupa`) |
| `consultar_agendamento_posts` | Consulta posts agendados no Blog e no canal do Instagram do Estratégia Nerd | Estratégia Nerd (MySQL) | Lupa (`lupa`) |
| `consultar_metricas_blog` | Consulta visualizações, total de artigos publicados, rascunhos e top posts | Estratégia Nerd (MySQL) | Lupa (`lupa`) |
| `consultar_metricas_instagram` | Consulta total de seguidores, posts publicados, agendados, curtidas e comentários | Estratégia Nerd (MySQL) | Lupa (`lupa`) |
| `consultar_treino_e_streak_gym_os` | Consulta treino do dia, missão diária, streak de treinos e nível/XP acumulado | Gym OS (SQLite) | Comemoração (`celebration`) |
| `gravar_preferencia_usuario` | Grava fatos importantes ou preferências do usuário na memória permanente | Echo SQLite (`user_preferences`) | Comemoração (`celebration`) |
| `consultar_preferencias_usuario` | Lê anotações e preferências previamente salvas | Echo SQLite (`user_preferences`) | Lupa (`lupa`) |

---

## 3. Segurança e Política de Backups

Por diretriz estrita do usuário:
- O Echo Companion **NUNCA** executa backups via API ou linha de comando.
- O conector `forge.js` consome exclusivamente a rota de leitura `GET /api/backup/status`.
- Nenhuma rota `POST /api/backup/executar` existe no catálogo do Echo.

---

## 4. Memória Persistente SQLite (`data/echo_memory.sqlite`)

O Echo possui memória local isolada em SQLite com 3 tabelas:

1. **`conversation_history`**:
   - Mantém as últimas 150 mensagens trocadas entre Mestre e Echo para fornecer continuidade no diálogo.
2. **`user_preferences`**:
   - Pares chave-valor gravados sob demanda pelo Mestre (ex.: foco da semana, apelidos, lembretes de metas).
3. **`tool_executions`**:
   - Histórico de auditoria de cada ferramenta executada com parâmetros e resumo do resultado.

---

## 5. Suíte das 5 Animações 2D do Mascote

O mascote vetorial em HTML5 Canvas possui 5 acessórios reativos sincronizados em tempo real:

1. **Lupa / Inspeção (`lupa`)**:
   - **Gatilho**: Disparada automaticamente assim que o Echo inicia uma consulta externa de dados (bancos, tarefas, status de backup ou métricas).
   - **Visual**: Lupa metálica neon cyan com lente translúcida e arco de reflexo branco, orbitando suavemente em frente aos olhos do mascote.
2. **Digitação (`typing`)**:
   - **Gatilho**: Ativada durante o raciocínio do modelo Gemini antes de sintetizar a fala.
   - **Visual**: Teclado cyber dark com teclas piscantes pulsando em cyan, enquanto as mãos do robô alternam toques verticais rápidos.
3. **Impressora (`printer`)**:
   - **Gatilho**: Ativada quando o Echo compila e apresenta resumos numéricos consolidados (saldos bancários, faturas ou despesas a pagar).
   - **Visual**: Mini impressora térmica com led verde emitindo um comprovante de papel com linhas de dados deslizando para cima.
4. **Comemoração (`celebration`)**:
   - **Gatilho**: Disparada ao detectar metas batidas (treino do Gym OS cumprido, tarefas concluídas com sucesso, streak elevado).
   - **Visual**: O mascote salta alegremente, seus olhos mudam para estrelas douradas e 28 confetes coloridos giram e caem em cascata.
5. **Xícara de Café (`coffee`)**:
   - **Gatilho**: Modo ocioso prolongado — ativado após 3 minutos (180s) sem nenhuma fala, toque na tela ou evento de IA.
   - **Visual**: O mascote segura uma caneca branca e azul com café quente, liberando fios de vapor ondulantes. Interações do usuário desativam a caneca instantaneamente.
