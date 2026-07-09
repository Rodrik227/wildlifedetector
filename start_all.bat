@echo off
title WILDLENS - INICIALIZADOR COMPLETO
color 0A
echo ============================================================
echo     WILDLENS - INICIALIZADOR COMPLETO (WEB + CAMERA + SENSOR)
echo ============================================================
echo.

:: Verifica se node e npm estão instalados
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [-] Erro: Node.js/npm nao esta instalado ou nao esta no PATH.
    echo [!] Por favor, instale o Node.js antes de continuar.
    pause
    exit /b 1
)

:: Verifica se Python está instalado
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [-] Erro: Python nao esta instalado ou nao esta no PATH.
    echo [!] Por favor, instale o Python antes de continuar.
    pause
    exit /b 1
)

echo [+] Verificando dependencias do Python...
python -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [-] Erro ao instalar dependencias do Python.
)

echo.
echo [+] Inicializando os servicos em janelas separadas...
echo.
echo [1/3] Iniciando Servidor Web (Next.js - Build & Run)...
start "WildLens - Next.js Server" cmd /k "npm run build && npm run start"

echo [2/3] Iniciando Transmissao da Camera...
start "WildLens - Camera Stream" cmd /k "python scripts/camera_sender.py"

echo [3/3] Iniciando Receptor dos Sensores...
start "WildLens - Sensor Receiver" cmd /k "python scripts/sensor_receiver.py"

echo.
echo ============================================================
echo [!] Todos os servicos foram iniciados em novas janelas!
echo     - Janela 1: Next.js Server (Porta 3000)
echo     - Janela 2: Camera Stream (Porta 8080)
echo     - Janela 3: Sensor Receiver (Arduino COM Port)
echo.
echo [i] Mantenha as janelas abertas para o sistema funcionar.
echo     Pressione qualquer tecla para encerrar este menu.
echo ============================================================
pause
