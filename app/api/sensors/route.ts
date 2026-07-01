import { NextResponse } from 'next/server';

export async function GET() {
  // Simulate physical sensor reading with slight fluctuations based on time
  const now = Date.now();
  
  // Base temperature: 24.5 °C. Base humidity: 62.0%
  // Fluctuate slowly using sine/cosine functions based on time
  const timeScale = now / 10000; // changes every 10 seconds
  const tempFluctuation = Math.sin(timeScale) * 1.2 + Math.cos(timeScale / 3) * 0.5;
  const humidFluctuation = Math.cos(timeScale) * 3.5 + Math.sin(timeScale / 2) * 1.5;

  const temperature = parseFloat((24.5 + tempFluctuation).toFixed(1));
  const humidity = parseFloat((62.0 + humidFluctuation).toFixed(1));

  return NextResponse.json({
    temperature,
    humidity,
    timestamp: now
  });
}
export const dynamic = 'force-dynamic';
