@echo off
start /b "" node "C:\Users\WINDOWS\Projects\echo-companion\bin\dispatcher.js" --agent "Codex CLI" --event "Stop" --message "Turno concluído pelo Codex CLI"
"C:\Users\WINDOWS\AppData\Local\OpenAI\Codex\runtimes\cua_node\f53823cd54b14f45\bin\node_modules\@oai\sky\bin\windows\codex-computer-use.exe" %*
