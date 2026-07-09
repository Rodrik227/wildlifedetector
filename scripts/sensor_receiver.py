import sys
import time
import json
import os
import socket

# Tenta importar pyserial. Se não tiver, avisa o usuário com instruções claras.
try:
    import serial
    import serial.tools.list_ports
except ImportError:
    print("-" * 60)
    print("[-] BIBLIOTECA 'pyserial' NÃO ENCONTRADA!")
    print("[!] Por favor, instale executando o seguinte comando no terminal:")
    print("    pip install pyserial")
    print("-" * 60)
    sys.exit(1)

# Tenta importar psutil para métricas de CPU e RAM
try:
    import psutil
except ImportError:
    psutil = None

# Configurações do receptor
BAUD_RATE = 9600
# Caminho para gravar os dados na raiz do projeto (uma pasta acima de scripts/)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "sensor_data.json"))

def write_json_data(status, temp=None, hum=None, cpu=0, ram=0, cam_online=False):
    payload = {
        "system_status": status,
        "cpu_usage": cpu,
        "ram_usage": ram,
        "camera_online": cam_online,
        "timestamp": int(time.time() * 1000)
    }
    if temp is not None:
        payload["temperature"] = float(temp)
    if hum is not None:
        payload["humidity"] = float(hum)
        
    try:
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
    except Exception as e:
        print(f"[!] Erro ao salvar arquivo JSON: {e}")

def get_system_stats():
    # Coleta de uso de CPU
    cpu = 0
    if psutil:
        try:
            cpu = int(psutil.cpu_percent(interval=None))
        except Exception:
            pass
            
    # Coleta de uso de RAM
    ram = 0
    if psutil:
        try:
            ram = int(psutil.virtual_memory().percent)
        except Exception:
            pass
            
    # Detecção do servidor de câmeras e contagem de câmeras ativas (porta 8080)
    cam_online = 0
    try:
        import urllib.request
        import json
        req = urllib.request.Request('http://127.0.0.1:8080/status')
        with urllib.request.urlopen(req, timeout=0.2) as response:
            data = json.loads(response.read().decode('utf-8'))
            cam_online = int(data.get("count", 0))
    except Exception:
        pass
        
    return cpu, ram, cam_online


def find_arduino_port():
    """Tenta detectar automaticamente as portas seriais disponíveis."""
    ports = list(serial.tools.list_ports.comports())
    if not ports:
        return None
    
    # Imprime todas as portas encontradas
    print("[i] Portas seriais encontradas:")
    for p in ports:
        print(f"    - {p.device}: {p.description}")
        
    # Filtra por portas comuns de Arduino no Windows e Linux
    for p in ports:
        desc = p.description.lower()
        dev = p.device.lower()
        if "arduino" in desc or "ch340" in desc or "usb-to-serial" in desc or "usb serial" in desc or "ttyacm" in dev or "ttyusb" in dev:
            print(f"[+] Porta autodetectada suspeita de Arduino: {p.device}")
            return p.device
            
    # Se não achar nada específico, retorna a primeira disponível
    print(f"[!] Nenhuma porta de Arduino clara foi detectada. Usando a primeira disponível: {ports[0].device}")
    return ports[0].device

def read_serial_loop(port_name):
    print(f"[+] Tentando conectar na porta {port_name} a {BAUD_RATE} bps...")
    
    # Define status como inicializando enquanto conecta e aguarda reboot
    write_json_data("inicializando")
    
    try:
        # Abre a porta serial com timeout de 3 segundos
        ser = serial.Serial(port_name, BAUD_RATE, timeout=3)
        # Limpa o buffer de entrada do Arduino (reiniciado ao conectar)
        ser.reset_input_buffer()
        time.sleep(2)  # Aguarda o reboot do Arduino
        
        # Envia status inicial de Inicializando para o Arduino
        try:
            ser.write(b"SYS:Inicializando,0,0,0\n")
        except Exception:
            pass
            
        print(f"[+] Conexão estabelecida com sucesso na porta {port_name}!")
        print(f"[+] Gravando dados em: {OUTPUT_FILE}")
        print("[i] Aguardando leituras do DHT11...")
        
        last_temp = None
        last_humid = None
        
        while True:
            if not ser.is_open:
                raise serial.SerialException("Porta serial fechada inesperadamente.")
                
            line_bytes = ser.readline()
            
            # Coleta métricas atuais do sistema
            cpu, ram, cam_online = get_system_stats()
            
            # Envia status atualizado de volta para o Arduino via Serial
            status_str = f"SYS:Online,{cpu},{ram},{cam_online}\n"
            try:
                ser.write(status_str.encode('utf-8'))
            except Exception as e:
                print(f"[!] Erro ao enviar dados ao Arduino: {e}")
                
            if not line_bytes:
                # Timeout de leitura (2s a 3s sem dados) - atualiza JSON com status
                write_json_data("online", temp=last_temp, hum=last_humid, cpu=cpu, ram=ram, cam_online=(cam_online > 0))
                continue
                
            try:
                line = line_bytes.decode('utf-8', errors='ignore').strip()
                if not line:
                    continue
                
                # Ignora linhas que não começam com chaves (evita mensagens de erro parciais ou ruído)
                if not (line.startswith('{') and line.endswith('}')):
                    print(f"[Arduino Debug] {line}")
                    continue
                
                # Tenta decodificar o JSON recebido do Arduino
                data = json.loads(line)
                
                if "error" in data:
                    print(f"[-] Erro reportado pelo Arduino: {data['error']}")
                    write_json_data("online", temp=last_temp, hum=last_humid, cpu=cpu, ram=ram, cam_online=(cam_online > 0))
                    continue
                    
                temperature = data.get("temperature")
                humidity = data.get("humidity")
                
                if temperature is not None and humidity is not None:
                    last_temp = float(temperature)
                    last_humid = float(humidity)
                    
                    # Salva no arquivo JSON compartilhado
                    write_json_data("online", temp=last_temp, hum=last_humid, cpu=cpu, ram=ram, cam_online=(cam_online > 0))
                    print(f"[Lido] Temp: {last_temp}°C | Umid: {last_humid}% | CPU: {cpu}% | RAM: {ram}% | Salvo no JSON")
                    
            except json.JSONDecodeError:
                print(f"[!] Dados corrompidos ou incompletos na serial: {line_bytes}")
            except Exception as e:
                print(f"[!] Erro ao processar linha: {e}")
                
    except (serial.SerialException, OSError) as e:
        print(f"[-] Erro de comunicação serial: {e}")
        # Grava o erro no arquivo JSON
        write_json_data("erro", cpu=0, ram=0, cam_online=False)
        # Trata erros de permissão comuns em sistemas Linux
        if "permission denied" in str(e).lower() or isinstance(e, PermissionError):
            print("\n" + "!" * 60)
            print("[!] ERRO DE PERMISSÃO DE PORTA SERIAL DETECTADO!")
            print("[!] Para resolver no Linux, execute um dos comandos abaixo no seu terminal:")
            user = os.environ.get('USER', 'seu_usuario')
            print(f"    sudo usermod -a -G dialout {user}")
            print(f"    (Nota: você precisará deslogar e logar novamente para aplicar o usermod)")
            print("    OU libere a porta diretamente:")
            print(f"    sudo chmod a+rw {port_name}")
            print("!" * 60 + "\n")
        print("[!] Conexão perdida. Tentando reconectar em 3 segundos...")
        time.sleep(3)

def main():
    print("=" * 60)
    print("      WILDLENS CONSOLE // COMUNICAÇÃO SERIAL DO ARDUINO")
    print("=" * 60)
    
    # Permite passar a porta por argumento (ex: python sensor_receiver.py COM3)
    if len(sys.argv) > 1:
        target_port = sys.argv[1]
        print(f"[i] Porta especificada manualmente por argumento: {target_port}")
    else:
        target_port = None
        
    while True:
        port = target_port if target_port else find_arduino_port()
        
        if not port:
            print("[-] Nenhuma porta serial ativa encontrada no sistema.")
            print("[!] Conecte o Arduino Uno via USB. Nova busca em 3 segundos...")
            write_json_data("erro", cpu=0, ram=0, cam_online=False)
            time.sleep(3)
            continue
            
        read_serial_loop(port)

if __name__ == "__main__":
    main()
