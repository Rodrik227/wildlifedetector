import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Helper para salvar o histórico de temperatura e umidade a cada 30 minutos
function logSensorData(temp: number, humid: number) {
  if (temp === undefined || humid === undefined || isNaN(temp) || isNaN(humid)) return;
  
  const historyPath = path.join(process.cwd(), 'sensor_history.json');
  const now = Date.now();
  let history: { timestamp: number; temperature: number; humidity: number }[] = [];

  try {
    if (fs.existsSync(historyPath)) {
      const data = fs.readFileSync(historyPath, 'utf-8');
      if (data.trim()) {
        history = JSON.parse(data);
      }
    }
  } catch (err) {
    console.error("[Sensor History] Error reading history file:", err);
  }

  // Se o histórico estiver vazio, gera dados de simulação retroativa das últimas 24 horas (48 pontos)
  if (history.length === 0) {
    for (let i = 47; i >= 0; i--) {
      const timestamp = now - i * 30 * 60 * 1000;
      const dateObj = new Date(timestamp);
      const hour = dateObj.getHours() + dateObj.getMinutes() / 60;
      const tempCycle = Math.sin((hour - 9) * Math.PI / 12);
      const mockTemp = parseFloat((22.5 + tempCycle * 4 + Math.random() * 0.5).toFixed(1));
      const mockHumid = parseFloat((65.0 - tempCycle * 15 + Math.random() * 1.5).toFixed(1));
      history.push({ timestamp, temperature: mockTemp, humidity: mockHumid });
    }
    try {
      fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf-8');
      console.log("[Sensor History] Initialized history file with 24h mock data.");
    } catch (err) {
      console.error("[Sensor History] Error initializing history file:", err);
    }
    return;
  }

  // Verifica o último item registrado
  const lastEntry = history[history.length - 1];
  const timeDiff = now - lastEntry.timestamp;

  // Loga a cada 30 minutos (1800000 ms). Usamos 29.5 minutos (1770000 ms) para tolerância
  if (timeDiff >= 1770000) {
    history.push({
      timestamp: now,
      temperature: temp,
      humidity: humid
    });

    // Limita o histórico a 500 registros (~10 dias)
    if (history.length > 500) {
      history = history.slice(history.length - 500);
    }

    try {
      fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf-8');
      console.log(`[Sensor History] Logged new entry: ${temp}°C, ${humid}%`);
    } catch (err) {
      console.error("[Sensor History] Error writing to history file:", err);
    }
  }
}

export async function GET() {
  const now = Date.now();
  const filePath = path.join(process.cwd(), 'sensor_data.json');

  try {
    if (fs.existsSync(filePath)) {
      const fileData = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(fileData);
      
      const sensorTimestamp = parsed.timestamp || 0;
      const age = now - sensorTimestamp;

      // Se os dados têm menos de 10 segundos, são considerados "frescos" e válidos
      if (age < 10000) {
        logSensorData(parsed.temperature, parsed.humidity);
        return NextResponse.json({
          temperature: parsed.temperature,
          humidity: parsed.humidity,
          timestamp: sensorTimestamp,
          source: 'arduino_real',
          system_status: parsed.system_status || 'online',
          cpu_usage: parsed.cpu_usage || 0,
          ram_usage: parsed.ram_usage || 0,
          camera_online: parsed.camera_online || false
        });
      } else {
        console.warn(`[API Sensores] Dados do Arduino obsoletos (${(age / 1000).toFixed(1)}s de idade). Fazendo fallback para simulação.`);
      }
    }
  } catch (err) {
    console.error("[API Sensores] Erro ao ler o arquivo de dados físicos do sensor:", err);
  }

  // FALLBACK: Simula a leitura física caso o Arduino não esteja transmitindo ou o receptor Python esteja desligado
  const timeScale = now / 10000; // muda a cada 10 segundos
  const tempFluctuation = Math.sin(timeScale) * 1.2 + Math.cos(timeScale / 3) * 0.5;
  const humidFluctuation = Math.cos(timeScale) * 3.5 + Math.sin(timeScale / 2) * 1.5;

  const temperature = parseFloat((24.5 + tempFluctuation).toFixed(1));
  const humidity = parseFloat((62.0 + humidFluctuation).toFixed(1));

  // Simula métricas do sistema oscilando levemente para manter a interface dinâmica no demo
  const cpu_usage = Math.floor(12 + Math.sin(now / 4000) * 5 + Math.random() * 3);
  const ram_usage = Math.floor(40 + Math.cos(now / 12000) * 1.5);
  const camera_online = true;

  logSensorData(temperature, humidity);

  return NextResponse.json({
    temperature,
    humidity,
    timestamp: now,
    source: 'simulation',
    system_status: 'erro', // Erro do receptor físico (desligado)
    cpu_usage,
    ram_usage,
    camera_online
  });
}

export const dynamic = 'force-dynamic';

