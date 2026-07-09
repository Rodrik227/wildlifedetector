@echo off
title WILDLENS - INICIALIZADOR DO RECEPTOR DE SENSOR (WINDOWS)
echo ============================================================
echo     WILDLENS - INICIALIZADOR DO RECEPTOR DE SENSOR (WINDOWS)
echo ============================================================

:: Verifica se Python está instalado
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [-] Erro: Python nao esta instalado no sistema ou nao esta no PATH.
    echo [!] Instale o Python pelo site oficial (https://www.python.org/) 
    echo     e marque a opcao "Add Python to PATH" durante a instalacao.
    pause
    exit /b 1
)

:: Verifica e instala as dependencias
echo [+] Verificando dependencias do Python...
python -c "import serial" >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Biblioteca 'pyserial' nao instalada. Instalando dependencias...
    python -m pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo [-] Falha ao instalar dependencias automaticamente.
        echo [!] Tente rodar manualmente: pip install -r requirements.txt
        pause
        exit /b 1
    )
)

:: Inicia o script Python
echo [+] Inicializando o sensor_receiver.py...
python scripts/sensor_receiver.py %*
pause
