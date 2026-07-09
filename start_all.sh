#!/bin/bash

# Clean exit on Ctrl+C
trap cleanup INT

cleanup() {
  echo -e "\n\n[+] Encerrando todos os serviços..."
  kill "$WEB_PID" "$SENSOR_PID" $CAM1_PID $CAM2_PID 2>/dev/null
  exit 0
}

echo "============================================================"
echo "    WILDLENS - INICIALIZADOR COMPLETO (LINUX + MJPEG)       "
echo "============================================================"
echo ""

# 1. Verificar dependências básicas
echo "[+] Detectando versões do sistema..."
NODE_VER=$(node -v 2>/dev/null)
PYTHON_VER=$(python3 --version 2>/dev/null)

if [ -n "$NODE_VER" ]; then
    echo "    - Node.js: Encontrado ($NODE_VER)"
else
    echo "[-] Erro: Node.js não está instalado ou não está no PATH."
    echo "[!] Por favor, instale o Node.js antes de continuar."
    exit 1
fi

if [ -n "$PYTHON_VER" ]; then
    echo "    - Python: Encontrado ($PYTHON_VER)"
else
    echo "[-] Erro: Python 3 não está instalado ou não está no PATH."
    echo "[!] Por favor, instale o Python 3 antes de continuar."
    exit 1
fi

if command -v mjpg_streamer &> /dev/null; then
    echo "    - mjpg-streamer: Encontrado ($(command -v mjpg_streamer))"
else
    echo "[-] Erro: mjpg-streamer não está instalado."
    echo "[!] Por favor, instale o mjpg-streamer para economizar CPU."
    echo "    Instale-o com: sudo apt update && sudo apt install mjpg-streamer -y"
    exit 1
fi

# Exportar caminhos comuns de bibliotecas para plugins do mjpg-streamer
export LD_LIBRARY_PATH="/usr/lib/mjpg-streamer:/usr/local/lib/mjpg-streamer:/usr/lib/x86_64-linux-gnu/mjpg-streamer:$LD_LIBRARY_PATH"

# 2. Instalar dependências do Node se necessário
if [ ! -d "node_modules" ]; then
    echo "[+] Pasta 'node_modules' não encontrada. Instalando dependências do Node.js..."
    npm install
else
    echo "[+] Pasta 'node_modules' detectada. Dependências do Node.js já instaladas."
fi

# 3. Configurar ambiente virtual Python (venv) no Linux (PEP 668)
if [ ! -d ".venv" ]; then
    echo "[+] Criando ambiente virtual Python (.venv)..."
    python3 -m venv .venv
    if [ $? -ne 0 ]; then
        echo "[-] Erro ao criar o ambiente virtual."
        echo "[!] Certifique-se de que o pacote 'python3-venv' está instalado."
        echo "    Instale-o com: sudo apt update && sudo apt install python3-venv -y"
        exit 1
    fi
    echo "[+] Ambiente virtual .venv criado com sucesso."
else
    echo "[+] Ambiente virtual .venv já existente."
fi

# Ativa o ambiente virtual (.venv)
echo "[+] Ativando ambiente virtual (.venv)..."
source .venv/bin/activate

# Instalar dependências do Python se necessário (apenas pyserial e psutil)
echo "[+] Testando importação dos pacotes Python no .venv..."
python3 -c "
libs = {'serial': 'pyserial', 'psutil': 'psutil'}
missing = False
for lib, pkg in libs.items():
    try:
        __import__(lib)
        print(f'    - Pacote {lib} ({pkg}): INSTALADO')
    except ImportError:
        print(f'    - Pacote {lib} ({pkg}): AUSENTE')
        missing = True
if missing:
    exit(1)
"
if [ $? -ne 0 ]; then
    echo "[!] Dependências do sensor ausentes ou incompletas detectadas no .venv. Instalando..."
    # Instala apenas pyserial e psutil para evitar o peso do opencv no processador antigo
    pip install pyserial psutil
    if [ $? -ne 0 ]; then
        echo "[-] Erro ao instalar dependências no ambiente virtual."
        exit 1
    fi
    echo "[+] Dependências instaladas com sucesso no .venv!"
else
    echo "[+] Todos os pacotes Python necessários para o sensor estão instalados."
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

# Detecção de câmeras
echo "[+] Detectando câmeras conectadas..."
CAMERAS=()
for dev in /dev/video*; do
    if [ -c "$dev" ]; then
        syspath="/sys/class/video4linux/$(basename $dev)/index"
        if [ -f "$syspath" ] && [ "$(cat $syspath)" -eq 0 ]; then
            CAMERAS+=("$dev")
        fi
    fi
done

NUM_CAMS=${#CAMERAS[@]}
echo "    - Câmeras físicas de captura encontradas: $NUM_CAMS"
for i in "${!CAMERAS[@]}"; do
    echo "      * Câmera $i: ${CAMERAS[$i]}"
done

echo ""
echo "[+] Inicializando os serviços em segundo plano..."
echo ""

# [1/3] Iniciando Servidor Web (Next.js)
echo "[1/3] Iniciando Servidor Web (Next.js - Porta 3000)..."
npm run build && npm run start &
WEB_PID=$!

# Aguarda um momento antes de rodar os scripts de vídeo
sleep 2

# [2/3] Iniciando Transmissão da Câmera (mjpg-streamer)
CAM1_PID=""
CAM2_PID=""

if [ $NUM_CAMS -eq 0 ]; then
    echo "[-] Aviso: Nenhuma câmera física encontrada em /dev/video* para transmissão."
else
    # Câmera 1 (Porta 8080)
    echo "[2/3] Iniciando mjpg-streamer para Câmera 1 (${CAMERAS[0]}) na Porta 8080..."
    mjpg_streamer -i "input_uvc.so -d ${CAMERAS[0]} -r 640x480 -f 15 -y" -o "output_http.so -p 8080 -l 0.0.0.0" &> mjpg_streamer1.log &
    CAM1_PID=$!
    
    # Câmera 2 (Porta 8081) se disponível
    if [ $NUM_CAMS -gt 1 ]; then
        echo "[2/3] Iniciando mjpg-streamer para Câmera 2 (${CAMERAS[1]}) na Porta 8081..."
        mjpg_streamer -i "input_uvc.so -d ${CAMERAS[1]} -r 640x480 -f 15 -y" -o "output_http.so -p 8081 -l 0.0.0.0" &> mjpg_streamer2.log &
        CAM2_PID=$!
    fi
fi

# [3/3] Iniciando Receptor dos Sensores
echo "[3/3] Iniciando Receptor do Sensor (Arduino)..."
python3 scripts/sensor_receiver.py &
SENSOR_PID=$!

echo ""
echo "============================================================"
echo "[!] Todos os serviços foram iniciados!"
echo "    - Servidor Web PID: $WEB_PID (Porta 3000)"
if [ -n "$CAM1_PID" ]; then
    echo "    - mjpg-streamer Câmera 1 PID: $CAM1_PID (Porta 8080)"
fi
if [ -n "$CAM2_PID" ]; then
    echo "    - mjpg-streamer Câmera 2 PID: $CAM2_PID (Porta 8081)"
fi
echo "    - Sensor Receiver PID: $SENSOR_PID"
echo ""
echo "[i] Pressione Ctrl+C a qualquer momento para encerrar TODOS os serviços."
echo "============================================================"

# Espera os processos filhos terminarem
wait
