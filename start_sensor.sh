#!/bin/bash

# Guia de inicialização fácil do sensor no Linux
echo "============================================================"
echo "    WILDLENS - INICIALIZADOR DO RECEPTOR DE SENSOR (LINUX)  "
echo "============================================================"

# Verifica se o Python 3 está instalado
if ! command -v python3 &> /dev/null; then
    echo "[-] Erro: Python 3 não está instalado."
    echo "[!] Por favor, instale o Python 3 antes de prosseguir."
    echo "    Exemplo: sudo apt update && sudo apt install python3 python3-pip -y"
    exit 1
fi

# Verifica e instala as dependências se necessário
echo "[+] Verificando dependências do Python..."
python3 -c "import serial" &> /dev/null
if [ $? -ne 0 ]; then
    echo "[!] Biblioteca 'pyserial' não instalada. Instalando dependências..."
    if command -v pip3 &> /dev/null; then
        pip3 install -r requirements.txt
    elif command -v pip &> /dev/null; then
        pip install -r requirements.txt
    else
        echo "[-] Erro: Nem pip nem pip3 foram encontrados no sistema."
        echo "[!] Instale o pip com: sudo apt install python3-pip"
        exit 1
    fi
fi

# Dica de permissões para portas USB serial no Linux
echo "[+] Verificando permissões de grupo dialout..."
if ! groups | grep -q "dialout"; then
    echo "[i] Nota: Se você encontrar erro de 'Permission Denied' ao conectar ao Arduino,"
    echo "    seu usuário pode precisar pertencer ao grupo 'dialout'."
    echo "    Execute este comando para adicionar seu usuário: "
    echo "    sudo usermod -a -G dialout \$USER"
    echo "    (Lembre-se de reiniciar sua sessão/computador após rodar o usermod)"
fi

# Inicia o script Python receptor
echo "[+] Inicializando o sensor_receiver.py..."
python3 scripts/sensor_receiver.py "$@"
