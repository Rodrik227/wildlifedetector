#!/bin/bash

# Guia de inicialização fácil do sensor no Linux
echo "============================================================"
echo "    WILDLENS - INICIALIZADOR DO RECEPTOR DE SENSOR (LINUX)  "
echo "============================================================"

# Verifica se o Python 3 está instalado
echo "[+] Detectando versão do sistema..."
PYTHON_VER=$(python3 --version 2>/dev/null)

if [ -n "$PYTHON_VER" ]; then
    echo "    - Python: Encontrado ($PYTHON_VER)"
else
    echo "[-] Erro: Python 3 não está instalado ou não está no PATH."
    echo "[!] Por favor, instale o Python 3 antes de continuar."
    echo "    Exemplo: sudo apt update && sudo apt install python3 -y"
    exit 1
fi

# Verifica e configura ambiente virtual Python (venv) no Linux (PEP 668)
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

# Instala dependências se necessário
echo "[+] Testando importação dos pacotes Python no .venv..."
python3 -c "
libs = {'serial': 'pyserial', 'cv2': 'opencv-python', 'psutil': 'psutil'}
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
    echo "[!] Dependências ausentes ou incompletas detectadas no .venv. Instalando do requirements.txt..."
    pip install -r requirements.txt
    if [ $? -ne 0 ]; then
        echo "[-] Erro ao instalar dependências no ambiente virtual."
        exit 1
    fi
    echo "[+] Dependências instaladas com sucesso no .venv!"
else
    echo "[+] Todos os pacotes Python necessários estão instalados."
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
