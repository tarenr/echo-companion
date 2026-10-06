# Avaliação de voz local brasileira para o Echo

## Conclusão em 6 de outubro de 2026

O Chatterbox PT-BR não atingiu a meta de começar a reproduzir em até 1,5 segundo na RTX 3050 de 6 GB. Não substituir a voz atual do Echo com base nesta avaliação.

Nenhuma rota, configuração de voz ou inicialização automática do Echo foi alterada. Existem alterações anteriores no checkout do Echo; elas foram preservadas e não fazem parte deste trabalho.

## Medições

As medições foram feitas no localhost, em sequência, sem cache de síntese do Voice Studio e com o modelo local mantido carregado entre frases. O texto curto tem 30 caracteres, o médio 84 e o longo 201. Os tempos são observações, não percentis de produção.

| Texto | Echo atual: primeiro byte | PT-BR: primeira rodada | PT-BR: segunda rodada |
|---|---:|---:|---:|
| Curto | 2,65 s | 5,52 s | 6,97 s |
| Médio | 1,75 s | 7,98 s | 8,81 s |
| Longo | 2,75 s | 12,72 s | 11,72 s |

O carregamento inicial do modelo brasileiro levou 12,8–13,2 segundos, além da geração. Uma amostragem de `nvidia-smi` durante a síntese mostrou aproximadamente 5.095 MiB usados no dispositivo, incluindo outros processos; não representa o pico exclusivo do modelo.

## Geração por frases

O primeiro trecho ficou pronto em 3,63 segundos. Simulando reprodução assim que cada trecho fica pronto, surgiram lacunas de aproximadamente 1,04 e 2,32 segundos entre trechos. Portanto, o protótipo também não atingiu a meta nem continuidade sem pausas.

Essa simulação usa geração sequencial de WAVs completos. Não é streaming de tokens ou áudio. O código instalado só retorna o áudio após gerar tokens de fala e decodificar a sequência inteira. A rota atual do Echo recebe partes do provedor Edge, mas acumula todas antes de enviar a resposta ao navegador.

## Modelo e compatibilidade

- Modelo brasileiro oficial: https://huggingface.co/ResembleAI/Chatterbox-Multilingual-pt-br.
- Snapshot: `b3952f18bc2eaa72b9bd7c17d2c4653bcad4770d`.
- Download seletivo: `t3_pt_br.safetensors`, `s3gen_v3.pt` e tokenizer, aproximadamente 3,2 GB. O encoder de voz foi reutilizado do modelo existente.
- O carregamento usa validação estrita dos pesos. Dois buffers DSP do tokenizer, filtros mel e janela Hann, ausentes do checkpoint e listados como ignoráveis pelo próprio tokenizer, são obtidos do construtor existente. Nenhum peso treinado ausente é ignorado.
- Não foi necessária atualização das dependências. O modelo anterior permanece disponível.

## Reprodução

Na pasta `voice-studio`, usando o Python do ambiente principal:

```powershell
& .\backend\venv\Scripts\python.exe -m backend.benchmark_echo_tts --mode echo
& .\backend\venv\Scripts\python.exe -m backend.benchmark_echo_tts --mode chatterbox --variant pt-br
& .\backend\venv\Scripts\python.exe -m backend.benchmark_echo_tts --mode chatterbox --variant pt-br --comparison-only
```

O benchmark escreve JSON, logs e áudios em `voice-studio/backend/cache/`, fora do Git. Libere o modelo carregado no Voice Studio antes de rodar o benchmark, para evitar dois modelos simultâneos na GPU.

## Qualidade e limitações

Os testes usam a referência do Buzz já importada. Sotaque e fidelidade precisam de avaliação auditiva do usuário; geração bem-sucedida não prova semelhança. As gerações são aleatórias e não usam semente fixa. Os tempos variam com texto, aquecimento, processos concorrentes e duração produzida.

Não foi implementada integração definitiva. Se a prioridade for resposta rápida, preservar o motor atual; uma futura investigação de otimização ou outro motor exige novo escopo.
