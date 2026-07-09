#include <DHT.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// --- CONFIGURAÇÃO DO SENSOR DHT ---
#define DHTPIN 7         // Pino digital conectado ao DHT11
#define DHTTYPE DHT11    // Define o tipo como DHT11
DHT dht(DHTPIN, DHTTYPE);

// --- CONFIGURAÇÃO DO LCD ---
// Endereço I2C comum: 0x27 ou 0x3F. Se a tela não acender, tente alterar o endereço.
// Display de 16 colunas e 2 linhas.
LiquidCrystal_I2C lcd(0x27, 16, 2); 

// Tempo de espera entre as leituras (em milissegundos)
const unsigned long intervaloLeitura = 2000; 
unsigned long tempoAnterior = 0;

// Watchdog de conexão com o PC (se não receber dados por 8 segundos, assume desconexão)
unsigned long ultimaAtualizacaoPC = 0;
const unsigned long TIMEOUT_CONEXAO = 8000;
bool pcOnline = false;

void setup() {
  // Inicializa comunicação serial a 9600 bps para falar com o servidor Python
  Serial.begin(9600);
  
  // Inicializa o sensor DHT
  dht.begin();
  
  // Inicializa o LCD
  lcd.init();
  lcd.backlight();
  lcd.clear();
  
  // Tela inicial de boot / inicialização
  lcd.setCursor(0, 0);
  lcd.print(" WildLens Sensor");
  lcd.setCursor(0, 1);
  lcd.print(" Inicializando...");
  delay(1500);
  lcd.clear();
  
  ultimaAtualizacaoPC = millis();
}

void loop() {
  unsigned long tempoAtual = millis();
  
  // ----------------------------------------------------
  // TAREFA 1: Ler sensor DHT e enviar dados JSON ao PC
  // ----------------------------------------------------
  if (tempoAtual - tempoAnterior >= intervaloLeitura) {
    tempoAnterior = tempoAtual;
    
    // Efetua as leituras de umidade e temperatura (Celsius)
    float umidade = dht.readHumidity();
    float temperatura = dht.readTemperature();
    
    // Verifica se a leitura falhou
    if (isnan(umidade) || isnan(temperatura)) {
      // Envia erro estruturado via Serial
      Serial.println("{\"error\": \"Falha ao ler o sensor DHT11\"}");
    } else {
      // Envia os dados em formato JSON em uma única linha
      Serial.print("{\"temperature\": ");
      Serial.print(temperatura, 1);
      Serial.print(", \"humidity\": ");
      Serial.print(umidade, 1);
      Serial.println("}");
    }
  }
  
  // ----------------------------------------------------
  // TAREFA 2: Receber status e métricas do PC via Serial
  // ----------------------------------------------------
  if (Serial.available() > 0) {
    // Lê a linha enviada pelo Python
    String linha = Serial.readStringUntil('\n');
    linha.trim();
    
    // Verifica se a linha possui o prefixo de sistema "SYS:"
    if (linha.startsWith("SYS:")) {
      ultimaAtualizacaoPC = tempoAtual; // Reinicia o watchdog
      
      // Formato esperado: SYS:<status>,<cpu>,<ram>,<camera_online>
      // Exemplo: SYS:Online,12,45,1
      String payload = linha.substring(4);
      
      int primeiroIndiceVirgula = payload.indexOf(',');
      int segundoIndiceVirgula = payload.indexOf(',', primeiroIndiceVirgula + 1);
      int terceiroIndiceVirgula = payload.indexOf(',', segundoIndiceVirgula + 1);
      
      if (primeiroIndiceVirgula != -1 && segundoIndiceVirgula != -1 && terceiroIndiceVirgula != -1) {
        String statusSistema = payload.substring(0, primeiroIndiceVirgula);
        String usoCPU = payload.substring(primeiroIndiceVirgula + 1, segundoIndiceVirgula);
        String usoRAM = payload.substring(segundoIndiceVirgula + 1, terceiroIndiceVirgula);
        String cameraOnline = payload.substring(terceiroIndiceVirgula + 1);
        
        String statusCam = (cameraOnline == "1") ? "CAM:ON" : "CAM:OFF";
        pcOnline = true;
        
        // --- EXIBIÇÃO NO LCD ---
        lcd.setCursor(0, 0);
        lcd.print("Sys: ");
        lcd.print(statusSistema);
        lcd.print("         "); // Limpa caracteres sobressalentes
        
        lcd.setCursor(0, 1);
        lcd.print("C:");
        lcd.print(usoCPU);
        lcd.print("% R:");
        lcd.print(usoRAM);
        lcd.print("% ");
        lcd.print(statusCam);
        lcd.print("   "); // Limpa caracteres sobressalentes
      }
    }
  }
  
  // ----------------------------------------------------
  // TAREFA 3: Watchdog de Segurança (Queda de Conexão)
  // ----------------------------------------------------
  if (tempoAtual - ultimaAtualizacaoPC > TIMEOUT_CONEXAO) {
    if (pcOnline) {
      pcOnline = false;
      lcd.clear();
    }
    lcd.setCursor(0, 0);
    lcd.print("Sys: Desconectado");
    lcd.setCursor(0, 1);
    lcd.print("Sem Comunicacao ");
  }
}
