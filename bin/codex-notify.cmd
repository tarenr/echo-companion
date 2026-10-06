@echo off
chcp 65001 >nul
start /b "" node "C:\Users\WINDOWS\Projects\echo-companion\bin\dispatcher.js" --agent "Codex CLI" --event "Stop" --message "Turno concluído pelo Codex CLI"
