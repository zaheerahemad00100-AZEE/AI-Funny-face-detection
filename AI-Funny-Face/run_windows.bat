@echo off
title AI Funny Face Commentator Launcher
cls
echo =========================================================
echo       AI FUNNY FACE COMMENTATOR - WINDOWS LAUNCHER
echo =========================================================
echo.

IF NOT EXIST ".venv" (
    echo [*] Creating virtual environment (.venv)...
    python -m venv .venv
    echo [*] Installing dependencies...
    call .venv\Scripts\activate.bat
    pip install -r requirements.txt
) ELSE (
    call .venv\Scripts\activate.bat
)

echo [*] Starting AI Funny Face Commentator...
echo [*] Press Q or ESC in the camera window to exit.
echo.
python main.py

pause
