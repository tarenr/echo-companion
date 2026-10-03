@echo off
title Echo Companion - F5-TTS Neural Voice Server (RTX 3050)
cd /d "%~dp0"
echo ==============================================================
echo  Iniciando Micro-servico Neural F5-TTS (Dublagem Baymax)
echo  Porta: 4885 | Aceleracao: NVIDIA GeForce RTX 3050 CUDA
echo ==============================================================
.\tts-env\Scripts\python.exe tts_server.py
pause
