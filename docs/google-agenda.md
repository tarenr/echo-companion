# Google Agenda no Echo

O Echo consulta, cria, edita e exclui eventos da agenda principal (`primary`) da conta autorizada. Usa OAuth com acesso offline e a biblioteca oficial `google-auth-library`. Não usa senha Google, conta de serviço, aplicativo Android nativo ou uma conexão do Google Drive no desktop.

## Preparar a conta (necessário para ativar)

1. No [Google Cloud Console](https://console.cloud.google.com/), selecione ou crie um projeto próprio para o Echo.
2. Ative **Google Calendar API**.
3. Em **Google Auth Platform**, configure o aplicativo e o público. Para uso pessoal em teste, inclua sua conta entre os usuários de teste. Se a conta for Google Workspace, a organização poderá exigir aprovação administrativa.
4. Crie um cliente OAuth do tipo **Aplicativo da Web**.
5. Cadastre exatamente este URI de redirecionamento autorizado:

   `https://echo.tfr-info.com.br/api/calendar/oauth/callback`

6. No `.env` local do Echo, preencha `GOOGLE_CALENDAR_CLIENT_ID` e `GOOGLE_CALENDAR_CLIENT_SECRET`. Não cole o secret em chats, screenshots, Forge ou commits.
7. Mantenha `GOOGLE_CALENDAR_REDIRECT_URI` idêntico ao URI registrado. A chave `GOOGLE_CALENDAR_ENCRYPTION_KEY` é base64 de 32 bytes e já foi gerada localmente durante esta implementação. Preserve-a: trocar a chave sem preservar o arquivo anterior impede abrir tokens e cópias de recuperação.
8. Reinicie a tarefa `EchoCompanion` após configurar o `.env`, dentro do escopo autorizado para o reinício.
9. Reabra o Echo no Android, toque **AGENDA**, depois **Conectar Google Agenda**, e autorize sua conta no Google. O retorno apresenta uma página para voltar ao Echo.

O escopo solicitado é `https://www.googleapis.com/auth/calendar.events.owned`, para eventos de calendários pertencentes à conta. Embora a permissão Google cubra calendários próprios, o conector do Echo fixa todas as chamadas em `primary`. Não solicita administração de calendários ou compartilhamento. Veja [escopos da Calendar API](https://developers.google.com/workspace/calendar/api/auth) e [OAuth para aplicações web](https://developers.google.com/identity/protocols/oauth2/web-server).

Aplicativos externos em status **Testing** podem ter refresh tokens com validade de sete dias para esses escopos. Para não depender de reconexão semanal, configure o estado de publicação apropriado ao uso pessoal conforme as orientações do Google; não ignore avisos de segurança. A distribuição pública pode exigir verificação adicional. Veja [expiração de tokens OAuth](https://developers.google.com/identity/protocols/oauth2#expiration).

## Comandos e confirmação

Cards de consulta e conexão fecham automaticamente após o tempo de leitura (no mínimo 20 segundos; textos e listas maiores permanecem mais tempo). Tocar ou rolar o card adia o fechamento. Propostas com confirmação pendente permanecem abertas para confirmar ou cancelar.

No rodapé, Celular, Agenda, Check e Ativo/Ouvir exibem somente ícones com a tela em pé. Com a tela deitada, os mesmos ícones aparecem junto dos textos. Os nomes acessíveis continuam disponíveis em ambas as orientações. Check preserva o raio e Ativo/Ouvir preserva o microfone.

- “Quais compromissos tenho hoje?” ou “O que tenho na agenda amanhã?”
- “Quais compromissos tenho entre 10 e 15 de outubro?”
- “Marque dentista em 10 de outubro de 2026, das 14h às 15h.”
- “Mude o dentista de 10 de outubro para as 16h, terminando às 17h.”
- “Exclua o dentista de 10 de outubro.”

Hoje/amanhã e controles de confirmação são tratados localmente. Demais formulações usam Gemini para propor os campos estruturados: data, título e duração não devem ser inventados. O modelo recebe o comando e contexto de data; os resultados da agenda e suas credenciais não são devolvidos ao modelo nem gravados no histórico comum.

Uma criação, edição ou exclusão produz um **rascunho**, nunca uma alteração imediata. Confira título, datas, horário de Brasília, local, descrição, lembretes e alcance. Depois toque **Confirmar**/**Confirmar exclusão**, ou diga **“confirmar agenda”**. Para desistir, toque **Cancelar** ou diga **“cancelar agenda”**. A confirmação vale dez minutos, somente no navegador/dispositivo que recebeu a proposta. Não há ferramenta do modelo capaz de confirmar.

Com resultados semelhantes, diga **“evento 2”** para selecionar a opção. Para eventos recorrentes, especifique **“somente esta ocorrência”** ou **“série inteira”** antes da proposta final. Não suporta “esta e as seguintes” (divisão de série). Uma série suporta regras diárias, semanais, mensais ou anuais e os campos documentados de RRULE; regras mais complexas devem ser gerenciadas no Google Agenda.

Eventos de dia inteiro usam datas, com término **exclusivo**: um evento só no dia 10 começa em `2026-10-10` e termina em `2026-10-11`. Eventos com horário usam `America/Sao_Paulo`. Alterações de horário precisam informar início e fim coerentes.

Convites, envio de e-mails a convidados e eventos organizados por outras pessoas ficam fora desta integração. Consultas podem exibi-los, mas escrita é bloqueada quando há convidados ou o organizador não é a própria conta. Lembretes permitem configurações padrão ou notificações popup do Google Agenda; não notificam pela PWA do Echo com a tela fechada.

## Segurança, concorrência e recuperação

- Rotas exigem o PIN do Echo (com a exceção local já existente). Luna não ganha acesso à agenda.
- Sessão independente em cookie HttpOnly/SameSite, proteção CSRF nas operações e OAuth com state de uso único e PKCE. Tokens nunca vão para o navegador, preferências, prompts ou logs.
- `data/calendar/secure.json` contém tokens e cópias de recuperação cifrados com AES-256-GCM. A pasta inteira e `.env` ficam fora do Git. Restrinja o acesso à conta Windows que executa o Echo. Guarde backups do arquivo e da chave separadamente em local protegido.
- Edição e exclusão usam `If-Match`/ETag: se o evento mudar desde a proposta, o Echo exige nova consulta.
- Confirmações simultâneas são bloqueadas. Criação usa um ID Google estável por proposta, permitindo reconhecer um sucesso cuja resposta foi perdida. Edição/exclusão não são repetidas automaticamente após falha de rede: consulte o estado real antes de fazer novo pedido.
- Ao reiniciar o serviço, propostas e sessões anteriores expiram. Reabra o Echo. Se houve falha durante uma escrita, confira a agenda antes de preparar outra operação; não há garantia de deduplicação entre propostas novas.
- Antes de editar/excluir, o evento original e o alcance são copiados para `recovery` no armazenamento cifrado. As cópias não são apagadas automaticamente.

**Exclusão é potencialmente destrutiva**, especialmente para série inteira. Não há restauração automática. Para recuperar, uma sessão autorizada de manutenção pode abrir a cópia com `CalendarStore` e a chave local, inspecionar os campos e preparar uma nova criação para sua confirmação. Não imprima o arquivo completo ou tokens. Recriar não garante o mesmo ID, exceções de recorrência, integrações ou histórico. Para séries, recuperar exceções pode exigir trabalho manual no Google Agenda.

**Desconectar** remove o uso local e tenta revogar o refresh token no Google, preservando eventos e cópias de recuperação. Se a revogação remota falhar, remova a permissão do Echo nos aplicativos autorizados da sua conta Google. **Reconectar** permite renovar a autorização ou trocar a conta; propostas anteriores ficam inválidas.

## Rotas

`GET /api/calendar/status` inicia a sessão autenticada e retorna estado/CSRF (sem tokens Google). As demais operações POST usam `X-Agenda-Csrf` da mesma sessão:

- `POST /api/calendar/oauth/start`: inicia autorização.
- `GET /api/calendar/oauth/callback`: valida state, sessão e código OAuth.
- `POST /api/calendar/list`: consulta por `timeMin`, `timeMax`, `q` opcionais.
- `POST /api/calendar/draft`: prepara `create`, `update` ou `delete`.
- `POST /api/calendar/confirm` e `/cancel`: usam o ID da proposta exibida.
- `POST /api/calendar/disconnect`: requer `confirm: "disconnect"`.

Consultar por ID antes de editar é obrigatório; alternativamente use título e período. Todas as respostas da agenda pertencem somente ao requisitante, sem distribuição por SSE.

## Validação

`node --test tests/calendar.test.js tests/navigation.test.js`

Os testes usam eventos, clientes OAuth e API simulados, um arquivo cifrado temporário e uma porta HTTP local temporária. Não consultam nem modificam a conta Google real. A fixture `node tests/calendar-browser.js` permite verificar os controles no navegador em `http://127.0.0.1:4885`: o botão de consulta simula uma proposta, e confirmar escreve apenas em memória. Encerre a fixture após o teste.

Para validação real, primeiro configure OAuth e conecte a conta. Consulte eventos existentes. Só depois de autorizar um evento de teste específico, teste criação, edição e exclusão com as confirmações do Echo. Não declare a integração conectada ou o CRUD real validado antes dessas etapas.
