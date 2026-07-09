import cv2
import time
import sys
from threading import Thread, Lock
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingTCPServer

# Configurações do servidor
PORT = 8080
CAM1_INDEX = 0
CAM2_INDEX = 1
FPS = 15  # Taxa limite de frames por segundo para conservar CPU

# Armazenamento compartilhado dos frames com controle de concorrência
frame_data = {
    1: {"frame": None, "lock": Lock(), "active": False},
    2: {"frame": None, "lock": Lock(), "active": False}
}

# Thread dedicada para capturar imagens da câmera
def capture_thread(cam_index, key):
    cap = cv2.VideoCapture(cam_index)
    if not cap.isOpened():
        print(f"[-] Câmera {key} (Índice {cam_index}): OFFLINE / INDISPONÍVEL")
        return
        
    print(f"[+] Câmera {key} (Índice {cam_index}): ONLINE")
    frame_data[key]["active"] = True
    
    delay = 1.0 / FPS
    try:
        while True:
            t1 = time.time()
            ret, frame = cap.read()
            if ret:
                # Redimensiona para economizar banda
                frame_resized = cv2.resize(frame, (640, 360))
                # Comprime para JPEG com qualidade balanceada
                _, jpeg_buffer = cv2.imencode('.jpg', frame_resized, [cv2.IMWRITE_JPEG_QUALITY, 70])
                jpeg_bytes = jpeg_buffer.tobytes()
                
                with frame_data[key]["lock"]:
                    frame_data[key]["frame"] = jpeg_bytes
            
            # Controla FPS
            elapsed = time.time() - t1
            sleep_time = max(0, delay - elapsed)
            time.sleep(sleep_time)
            
    except Exception as e:
        print(f"[-] Erro na captura da Câmera {key}: {e}")
    finally:
        cap.release()
        frame_data[key]["active"] = False

# Handler HTTP para streams multipart (MJPEG)
class CamStreamHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Silencia logs HTTP comuns para manter o console limpo
        return

    def do_GET(self):
        # Adiciona suporte a CORS e serve os caminhos de vídeo
        if self.path in ('/video1', '/video2'):
            key = 1 if self.path == '/video1' else 2
            
            if not frame_data[key]["active"]:
                self.send_response(404)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(b"Camera offline")
                return

            self.send_response(200)
            # CRÍTICO: CORS Header para permitir desenhar o stream no canvas sem corrompê-lo
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'multipart/x-mixed-replace; boundary=frame')
            self.end_headers()
            
            try:
                last_frame = None
                while True:
                    with frame_data[key]["lock"]:
                        curr_frame = frame_data[key]["frame"]
                    
                    if curr_frame and curr_frame != last_frame:
                        self.wfile.write(b"--frame\r\n")
                        self.wfile.write(b"Content-Type: image/jpeg\r\n")
                        self.wfile.write(f"Content-Length: {len(curr_frame)}\r\n\r\n".encode())
                        self.wfile.write(curr_frame)
                        self.wfile.write(b"\r\n")
                        last_frame = curr_frame
                        
                    time.sleep(1.0 / FPS)
            except (ConnectionResetError, BrokenPipeError):
                # Desconexão silenciosa do cliente
                pass
            except Exception as e:
                print(f"[-] Desconexão na Câmera {key}: {e}")
        elif self.path == '/status':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            count = 0
            if frame_data[1]["active"]:
                count += 1
            if frame_data[2]["active"]:
                count += 1
            import json
            res = {
                "cam1": frame_data[1]["active"],
                "cam2": frame_data[2]["active"],
                "count": count
            }
            self.wfile.write(json.dumps(res).encode('utf-8'))
        else:
            # Página inicial informativa
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            html = f"""
            <html>
                <head>
                    <title>WildLens Terminal Streamer</title>
                    <style>
                        body {{ font-family: monospace; background: #09090b; color: #10b981; padding: 30px; }}
                        h2 {{ border-bottom: 2px solid #10b981; padding-bottom: 10px; margin-bottom: 20px; }}
                        a {{ color: #06b6d4; text-decoration: none; font-weight: bold; }}
                        a:hover {{ text-decoration: underline; }}
                        .status {{ color: #f43f5e; }}
                        .online {{ color: #10b981; }}
                    </style>
                </head>
                <body>
                    <h2>WILDLENS CONSOLE // SERVIDOR DE STREAMING MJPEG</h2>
                    <p>Status Geral: <span class="online">ONLINE</span></p>
                    <p>Canal 1 (C&acirc;mera 1): <span class="{"online" if frame_data[1]["active"] else "status"}">{"ONLINE" if frame_data[1]["active"] else "OFFLINE"}</span> | Stream: <a href="/video1">/video1</a></p>
                    <p>Canal 2 (C&acirc;mera 2): <span class="{"online" if frame_data[2]["active"] else "status"}">{"ONLINE" if frame_data[2]["active"] else "OFFLINE"}</span> | Stream: <a href="/video2">/video2</a></p>
                    <br/>
                    <p>[i] Insira o IP e a porta deste computador no painel web para monitorar sem poluir o console do Next.js.</p>
                </body>
            </html>
            """
            self.wfile.write(html.encode('utf-8'))

# Servidor HTTP com suporte a concorrência por thread
class ThreadingHTTPServer(ThreadingTCPServer, HTTPServer):
    pass

def main():
    print("=" * 60)
    print("      WILDLENS CONSOLE // SERVIDOR DE STREAMING (CORS/MJPEG)")
    print("=" * 60)
    
    # Inicia as capturas em threads paralelas
    t1 = Thread(target=capture_thread, args=(CAM1_INDEX, 1), daemon=True)
    t2 = Thread(target=capture_thread, args=(CAM2_INDEX, 2), daemon=True)
    
    t1.start()
    t2.start()
    
    # Aguarda o hardware inicializar
    time.sleep(1.5)
    
    server_address = ('', PORT)
    httpd = ThreadingHTTPServer(server_address, CamStreamHandler)
    
    print("-" * 60)
    print(f"[+] Servidor HTTP MJPEG iniciado na porta: {PORT}")
    print(f"[+] Canal 1: http://localhost:{PORT}/video1")
    print(f"[+] Canal 2: http://localhost:{PORT}/video2")
    print(f"[i] Mantenha esta janela rodando para transmitir.")
    print("[i] Pressione Ctrl+C para finalizar o servidor.")
    print("-" * 60)
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[+] Servidor encerrado.")
    finally:
        httpd.server_close()
        print("[+] Hardware e sockets liberados.")

if __name__ == "__main__":
    main()
