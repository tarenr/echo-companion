# Localização entre Echo e Luna

Echo e Luna consultam a localização dos celulares associados a cada mascote. O compartilhamento é independente em cada lado: não concede acesso à Agenda, aprovações ou demais funções do outro mascote.

## Ativar nos celulares

1. Abra o Echo no seu celular e a Luna no outro celular, usando HTTPS e os respectivos PINs.
2. Toque no ícone de localização no rodapé (LOCAL na tela deitada).
3. Leia a explicação e toque **Compartilhar minha localização**. Autorize a localização no navegador/Android.
4. Repita no outro celular se quiser compartilhar nos dois sentidos. Não há captura antes dessa escolha.
5. Pergunte **“Echo, onde a Luna está?”** ou **“Luna, onde o Echo está?”**. O painel também oferece o botão de consulta.

O aplicativo precisa ficar aberto e visível para atualizar GPS. Ao mudar de aplicativo, fechar a página ou bloquear a tela, as atualizações param. Ao retornar, o dispositivo autorizado retoma enquanto continuar autorizado. Não há serviço Android de localização em segundo plano.

A resposta informa precisão e idade da posição. Capturas com mais de dois minutos são apresentadas como **última localização conhecida**, nunca como posição atual. Precisão depende do GPS, Wi-Fi, ambiente e permissão de localização aproximada do Android.

**Ver no mapa** abre o Google Maps somente após tocar no link. Nesse momento as coordenadas são transmitidas ao Google Maps. Isso não requer uma chave de API. O mapa descreve a posição do celular, não comprova que uma pessoa está com ele.

## Dispositivo, pausa e revogação

- Um dispositivo transmissor por mascote. A identidade é um cookie aleatório HttpOnly/SameSite, separado para Echo e Luna. Outros dispositivos com o mesmo PIN podem consultar e parar o compartilhamento, mas não publicar sem assumir explicitamente o papel de transmissor.
- **Usar este celular no lugar do outro** exige confirmação e remove a posição do aparelho anterior. Sua publicação deixa de ser aceita.
- **Parar compartilhamento** exige confirmação, interrompe GPS e apaga o registro disponível no servidor. Uma consulta iniciada antes da revogação é revalidada antes de responder.
- Negar/revogar a permissão de GPS pausa a captura; o cliente tenta também revogar no servidor. Se não houver rede, é necessário parar ao reconectar; o registro restante expira em 24 horas.
- Se o envio falhar por rede, o cliente pausa e tenta retomar a cada 30 segundos enquanto estiver visível e autorizado. A resposta continua indicando a idade da última captura.
- Posição antiga não é renovada artificialmente: horário da captura e do recebimento são distintos. Atualizações fora de ordem e coordenadas inválidas são recusadas.
- Publicação limitada: mínimo de 15 segundos no cliente, deslocamento aproximado de 30 m ou 60 segundos, e mínimo de 10 segundos no servidor. Uma leitura nova por minuto mantém posição de um celular parado enquanto visível. Nenhum histórico de percurso é guardado.

## Casa, DHL e Jayme

A proximidade é calculada localmente usando os links Waze já cadastrados em `navigation_saved_destinations`. O prefixo `h` de `/ul/h...` indica o formato e não integra o geohash. Somente links com precisão suficiente são usados. Endereços somente textuais não geram coordenadas por adivinhação.

A resposta **perto de** exige precisão GPS de até 100 m e que distância até o ponto mais a incerteza caibam em 250 m. Não afirma estar dentro de uma casa ou estabelecimento. Se não houver local conhecido próximo, oferece a posição no mapa.

## Armazenamento e configuração

`LOCATION_ENCRYPTION_KEY` no `.env` é uma chave base64 de 32 bytes, gerada localmente nesta implementação. `data/location/secure.json` guarda somente o transmissor e última posição de cada mascote, cifrados com AES-256-GCM. A pasta e `.env` ficam fora do Git. Preserve a chave; não a envie por chat nem grave no Forge. Arquivo corrompido ou chave incompatível provoca erro e é preservado.

Posições expiram logicamente em 24 horas e são removidas ao ler o estado ou pelo trabalho de limpeza a cada minuto com o servidor em execução. Com o servidor desligado, a remoção ocorre quando ele voltar. A chave é específica de localização, separada da Google Agenda. Não há migrations nem novos pacotes.

Autenticação usa o PIN correspondente, sessão por dispositivo e `X-Location-Csrf` nas operações. Respostas não são cacheadas. Coordenadas não são enviadas ao Gemini, histórico de conversas nem SSE. Qualquer pessoa que conhecer o PIN do mascote terá o acesso correspondente: mantenha os PINs privados. A revogação não retira coordenadas que alguém já recebeu anteriormente.

## Endereços opcionais pelo Google

Sem `LOCATION_GOOGLE_GEOCODING_KEY`, nenhuma API Google é chamada. A posição, o mapa e a proximidade dos destinos cadastrados funcionam sem essa chave.

Para falar rua/bairro/cidade fora dos destinos, configure uma chave restrita à **Geocoding API**, API ativada e faturamento apropriado no Google Cloud. A implementação não ativa faturamento nem configura conta Google automaticamente. Consulte [uso e cobrança](https://developers.google.com/maps/documentation/geocoding/usage-and-billing) antes de habilitar; não há promessa de gratuidade. A chave fica somente no servidor.

Com a chave configurada, as coordenadas consultadas são enviadas ao Google somente mediante pergunta/botão de consulta, quando não identificadas como local conhecido. Não há geocodificação periódica nem armazenamento dos endereços retornados. Há limite global de uma consulta por dez segundos e timeout de seis segundos; falha ou limite mantêm a posição disponível no mapa, sem inventar endereço. A tela avisa sobre esse envio; a chave configura o consentimento administrativo para o serviço opcional. Configure cotas no Google Cloud conforme seu orçamento.

## Rotas e validação

`GET /api/location/:scope/status`, onde `scope` é `echo` ou `luna`, inicia sessão autenticada e retorna estado/CSRF sem posição. POSTs `/start` (consentimento), `/update` (GPS), `/stop` (confirmação) e `/query` (localização do outro) exigem sessão/CSRF. A identidade publicada sempre deriva da rota autenticada, nunca de um campo enviado pelo modelo.

`node --test tests/location.test.js tests/location-ui.test.js tests/calendar-ui.test.js tests/calendar.test.js tests/navigation.test.js`

Os testes usam GPS, API e armazenamento simulados ou arquivos temporários. `node tests/location-browser.js` oferece fixture isolada em `http://127.0.0.1:4886` e `/luna`, com GPS simulado, sem conta real. Encerre após verificar.

A validação real depende do consentimento nos dois celulares: ativar cada lado, fazer consultas recíprocas, sair/retornar à página, conferir indicação de posição antiga e interromper compartilhamento. A validação simulada não comprova precisão do GPS físico.
