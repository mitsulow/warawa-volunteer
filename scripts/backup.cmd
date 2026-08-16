@echo off
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
cd /d C:\Users\waras\warawa-volunteer
"C:\Users\waras\AppData\Local\Programs\Python\Python312-arm64\python.exe" scripts\backup.py >> C:\Users\waras\warawa-volunteer\scripts\backup_run.log 2>&1
