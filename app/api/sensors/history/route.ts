import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const historyPath = path.join(process.cwd(), 'sensor_history.json');
  let history = [];

  try {
    if (fs.existsSync(historyPath)) {
      const fileData = fs.readFileSync(historyPath, 'utf-8');
      if (fileData.trim()) {
        history = JSON.parse(fileData);
      }
    } else {
      // Se não existir, gera dados simulados retroativos para as últimas 24 horas (48 pontos, a cada 30 min)
      const now = Date.now();
      for (let i = 47; i >= 0; i--) {
        const timestamp = now - i * 30 * 60 * 1000;
        const dateObj = new Date(timestamp);
        const hour = dateObj.getHours() + dateObj.getMinutes() / 60;
        const tempCycle = Math.sin((hour - 9) * Math.PI / 12);
        const mockTemp = parseFloat((22.5 + tempCycle * 4 + Math.random() * 0.5).toFixed(1));
        const mockHumid = parseFloat((65.0 - tempCycle * 15 + Math.random() * 1.5).toFixed(1));
        history.push({ timestamp, temperature: mockTemp, humidity: mockHumid });
      }
      fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error("[API Histórico] Erro ao obter histórico:", err);
  }

  return NextResponse.json(history);
}

export const dynamic = 'force-dynamic';
