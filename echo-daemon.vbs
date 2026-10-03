Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\WINDOWS\Projects\echo-companion"
WshShell.Run "cmd /c set PYTHONUNBUFFERED=1 && .\tts-env\Scripts\python.exe tts_server.py > tts.log 2>&1", 0, False
WshShell.Run "cmd /c node server.js > echo.log 2>&1", 0, True
