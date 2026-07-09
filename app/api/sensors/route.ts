import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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
