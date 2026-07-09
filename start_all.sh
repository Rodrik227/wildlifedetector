#!/bin/bash

# Clean exit on Ctrl+C
trap cleanup INT

cleanup() {
  echo -e "\n\n[+] Encerrando todos os serviços..."
  kill "$WEB_PID" "$CAM_PID" "$SENSOR_PID" 2>/dev/null
  exit 0
}

echo "============================================================"
echo "    WILDLENS - INICIALIZADOR COMPLETO (LINUX)               "
echo "============================================================"
echo ""

# 1. Verificar dependências básicas
if ! command -v node &> /dev/null; then
    echo "[-] Erro: Node.js não está instalado ou não está no PATH."
    echo "[!] Por favor, instale o Node.js antes de continuar."
    exit 1
fi

if ! command -v python3 &> /dev/null; then
    echo "[-] Erro: Python 3 não está instalado ou não está no PATH."
    echo "[!] Por favor, instale o Python 3 antes de continuar."
    exit 1
fi

# 2. Instalar dependências do Node se necessário
if [ ! -d "node_modules" ]; then
    echo "[+] Instalando dependências do Node.js..."
    npm install
fi

# 3. Instalar dependências do Python se necessário
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
        echo "[!] Instale o pip ou instale as dependências listadas no requirements.txt manualmente."
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

echo ""
echo "[+] Inicializando os serviços em segundo plano..."
echo ""

# [1/3] Iniciando Servidor Web (Next.js)
echo "[1/3] Iniciando Servidor Web (Next.js - Porta 3000)..."
npm run build && npm run start &
WEB_PID=$!

# Aguarda um momento antes de rodar os scripts de Python para evitar conflito de logs iniciais
sleep 2

# [2/3] Iniciando Transmissão da Câmera
echo "[2/3] Iniciando Transmissão da Câmera (Porta 8080)..."
python3 scripts/camera_sender.py &
CAM_PID=$!

# [3/3] Iniciando Receptor dos Sensores
echo "[3/3] Iniciando Receptor do Sensor (Arduino)..."
python3 scripts/sensor_receiver.py &
SENSOR_PID=$!

echo ""
echo "============================================================"
echo "[!] Todos os serviços foram iniciados em segundo plano!"
echo "    - Servidor Web PID: $WEB_PID (Porta 3000)"
echo "    - Câmera Stream PID: $CAM_PID (Porta 8080)"
echo "    - Sensor Receiver PID: $SENSOR_PID"
echo ""
echo "[i] Pressione Ctrl+C a qualquer momento para encerrar TODOS os serviços."
echo "============================================================"

# Espera os processos filhos terminarem
wait
