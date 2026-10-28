@echo off
REM Inicia um servidor local (sem cache) e abre o HELIOS IDLE no navegador.
cd /d "%~dp0"
start "" http://localhost:8765
python tools\servidor.py 8765 || npx --yes serve -l 8765 .
