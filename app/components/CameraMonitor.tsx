'use client';

import React, { useRef, useState, useEffect } from 'react';
import { SensorData } from '../types';

interface CameraMonitorProps {
  onCapture: (
    imageUrl: string,
    detectionType: 'manual' | 'automatic',
    temp: number,
    humid: number,
    location: string
  ) => void;
}

export default function CameraMonitor({ onCapture }: CameraMonitorProps) {
  // Remote viewing states for MJPEG streams
  const [cameraError1, setCameraError1] = useState<string | null>(null);
  
  // These indicate whether the MJPEG stream is active / loaded
  const [webcamActive1, setWebcamActive1] = useState(false);

  // Streaming IP Option for direct MJPEG stream
  const [mjpegServerIp, setMjpegServerIp] = useState('localhost');

  // Image Refs (for MONITOR mode canvas grabbings)
  const imgRef1 = useRef<HTMLImageElement>(null);

  // Derived Stream Feed URL targeting mjpg-streamer port 8080
  const cameraFeed1 = `http://${mjpegServerIp.split(':')[0]}:8080/?action=stream`;

  // Snapshot Capture Canvas
  const canvasRef1 = useRef<HTMLCanvasElement>(null);
  const [isCapturing1, setIsCapturing1] = useState(false);

  // Clock HUD State
  const [timestamp, setTimestamp] = useState('');
  const [fps1, setFps1] = useState(30);

  // Sensor Telemetry State (DHT22 Readings)
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [sensorStatus, setSensorStatus] = useState<'CONNECTED' | 'DISCONNECTED' | 'ERROR'>('DISCONNECTED');

  // Motion Detection States (independent per camera)
  const [motionDetected1, setMotionDetected1] = useState(false);
  const [motionBox1, setMotionBox1] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  const [autoCaptureEnabled1, setAutoCaptureEnabled1] = useState(true);
  
  const [cooldownTimeLeft1, setCooldownTimeLeft1] = useState(0);

  // Refs for motion tracking loops
  const motionStreakCount1 = useRef(0);
  const isCooldownActive1 = useRef(false);
  const cooldownTimerRef1 = useRef<NodeJS.Timeout | null>(null);
  
  const prevPixels1 = useRef<Uint8ClampedArray | null>(null);

  // Clock Update & Subtle FPS Jitter
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setTimestamp(now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
      setFps1(Math.floor(29 + Math.random() * 2));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Poll Sensor Data API Route
  useEffect(() => {
    const fetchSensors = async () => {
      try {
        const res = await fetch('/api/sensors');
        if (res.ok) {
          const data: SensorData = await res.json();
          setSensorData(data);
          setSensorStatus('CONNECTED');
        } else {
          setSensorStatus('ERROR');
        }
      } catch (err) {
        console.error("Error fetching sensor readings:", err);
        setSensorStatus('ERROR');
      }
    };

    fetchSensors();
    const interval = setInterval(fetchSensors, 2000);

    return () => clearInterval(interval);
  }, []);




  // ==========================================
  // COOLDOWN & AUTO CAPTURE CONTROLS
  // ==========================================
  const triggerAutoCapture = () => {
    if (isCooldownActive1.current || isCapturing1) return;

    motionStreakCount1.current = 0;
    isCooldownActive1.current = true;
    setCooldownTimeLeft1(8);

    let secondsLeft = 8;
    if (cooldownTimerRef1.current) clearInterval(cooldownTimerRef1.current);
    cooldownTimerRef1.current = setInterval(() => {
      secondsLeft -= 1;
      setCooldownTimeLeft1(secondsLeft);
      if (secondsLeft <= 0) {
        if (cooldownTimerRef1.current) clearInterval(cooldownTimerRef1.current);
        isCooldownActive1.current = false;
      }
    }, 1000);

    captureSnapshot('automatic');
  };

  const captureSnapshot = (type: 'manual' | 'automatic') => {
    if (isCapturing1) return;
    setIsCapturing1(true);

    const locationName = 'WEBCAM_SENSOR_01';
    const temp = sensorData?.temperature ?? 24.5;
    const humid = sensorData?.humidity ?? 60.0;

    const canvas = canvasRef1.current;

    // Draw from <img> tag to grab the currently visible frame
    const img = imgRef1.current;
    if (!canvas || !img || !img.complete || img.naturalWidth === 0) {
      setIsCapturing1(false);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsCapturing1(false);
      return;
    }

    canvas.width = img.naturalWidth || 640;
    canvas.height = img.naturalHeight || 360;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    onCapture(dataUrl, type, temp, humid, locationName);
    setIsCapturing1(false);
  };

  const handleImageError = () => {
    setCameraError1('SEM SINAL // STREAM OFFLINE');
    setWebcamActive1(false);
  };

  const handleImageLoad = () => {
    setCameraError1(null);
    setWebcamActive1(true);
  };

  // ==========================================
  // DETECÇÃO DE MOVIMENTO (MOTION DETECTION)
  // ==========================================

  const processPixelDifferencing = (
    currentPixels: Uint8ClampedArray,
    prevPixels: Uint8ClampedArray | null,
    setMotionDetected: (detected: boolean) => void,
    setMotionBox: (box: { left: number; top: number; width: number; height: number } | null) => void,
    motionStreakCount: React.MutableRefObject<number>,
    autoCaptureEnabled: boolean
  ) => {
    if (!prevPixels) return;

    let motionCount = 0;
    let minX = 64, maxX = 0, minY = 48, maxY = 0;

    for (let y = 0; y < 48; y++) {
      for (let x = 0; x < 64; x++) {
        const idx = (y * 64 + x) * 4;
        const rDiff = Math.abs(currentPixels[idx] - prevPixels[idx]);
        const gDiff = Math.abs(currentPixels[idx + 1] - prevPixels[idx + 1]);
        const bDiff = Math.abs(currentPixels[idx + 2] - prevPixels[idx + 2]);
        const pixelDiff = rDiff + gDiff + bDiff;

        if (pixelDiff > 75) {
          motionCount++;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }

    const totalPixels = 64 * 48;
    const motionPercentage = (motionCount / totalPixels) * 100;

    if (motionPercentage > 1.2 && motionPercentage < 40) {
      setMotionBox({
        left: (minX / 64) * 100,
        top: (minY / 48) * 100,
        width: ((maxX - minX + 1) / 64) * 100,
        height: ((maxY - minY + 1) / 48) * 100,
      });

      setMotionDetected(true);
      motionStreakCount.current += 1;

      const streakLimit = 4;
      if (autoCaptureEnabled && motionStreakCount.current >= streakLimit) {
        triggerAutoCapture();
      }
    } else {
      setMotionDetected(false);
      motionStreakCount.current = Math.max(0, motionStreakCount.current - 1);
      if (motionStreakCount.current === 0) {
        setMotionBox(null);
      }
    }
  };

  // LOOP 1: Câmera 1 (MONITOR mode)
  useEffect(() => {
    let active = true;

    const runMonitorLoop = () => {
      if (!active || !imgRef1.current) return;
      const img = imgRef1.current;
      
      if (img.complete && img.naturalWidth > 0) {
        try {
          const procCanvas = document.createElement('canvas');
          procCanvas.width = 64;
          procCanvas.height = 48;
          const procCtx = procCanvas.getContext('2d');
          if (procCtx) {
            procCtx.drawImage(img, 0, 0, 64, 48);
            const currentPixels = procCtx.getImageData(0, 0, 64, 48).data;
            processPixelDifferencing(
              currentPixels,
              prevPixels1.current,
              setMotionDetected1,
              setMotionBox1,
              motionStreakCount1,
              autoCaptureEnabled1
            );
            prevPixels1.current = currentPixels;
          }
        } catch (e) {
          console.error(e);
        }
      }
      setTimeout(runMonitorLoop, 150); // check at ~7 FPS
    };

    runMonitorLoop();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCaptureEnabled1, cameraFeed1]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* Video Stream Container */}
      <div className="lg:col-span-8 flex flex-col gap-6">
        
        {/* Video Viewport */}
        <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-2xl flex flex-col justify-between">
          {/* CFTV Cyberpunk Overlays */}
          <div className="absolute inset-0 pointer-events-none grid-overlay-emerald z-10 opacity-70"></div>
          <div className="absolute inset-x-0 h-0.5 bg-emerald-500/10 shadow-[0_0_8px_rgba(16,185,129,0.3)] animate-scanline pointer-events-none z-10"></div>
          <div className="absolute inset-0 pointer-events-none bg-zinc-900/5 animate-noise z-10 opacity-30"></div>

          {/* Top HUD */}
          <div className="absolute top-0 inset-x-0 bg-gradient-to-bottom from-black/95 to-transparent p-3.5 flex items-center justify-between font-mono text-[9px] text-zinc-400 z-20">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 bg-zinc-900/95 px-2 py-0.5 rounded border border-zinc-850 shadow-md">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
                </span>
                <span className="font-bold text-zinc-200 uppercase tracking-wider">CÂMERA // ATIVA</span>
              </span>
              {motionDetected1 && (
                <span className="flex items-center gap-1 bg-rose-950/85 text-rose-400 border border-rose-800 px-1.5 py-0.5 rounded animate-blink font-bold text-[8px] tracking-wider uppercase">
                  MVM_DETECTADO
                </span>
              )}
            </div>
            <span className="text-zinc-300 font-bold bg-zinc-900/70 px-1.5 py-0.5 rounded border border-zinc-850">
              {timestamp || 'STARTING...'}
            </span>
          </div>

          {/* Stream View Area */}
          <div className="flex-1 flex items-center justify-center relative overflow-hidden">
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef1}
                src={cameraFeed1}
                alt="Camera stream"
                crossOrigin="anonymous"
                onError={handleImageError}
                onLoad={handleImageLoad}
                className={`w-full h-full object-cover select-none ${cameraError1 ? 'hidden' : 'block'}`}
              />
              {cameraError1 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 font-mono text-[9px] text-rose-500/70 z-20 p-4 text-center">
                  <svg className="animate-pulse h-6 w-6 mb-2 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="font-bold">{cameraError1}</span>
                  <span className="text-[8px] text-zinc-650 mt-1">
                    Verifique se o mjpg-streamer está rodando na porta 8080 e se o IP do servidor está correto.
                  </span>
                </div>
              )}
            </>

            {/* Bounding box detection box */}
            {motionBox1 && webcamActive1 && !cameraError1 && (
              <div
                style={{
                  left: `${motionBox1.left}%`,
                  top: `${motionBox1.top}%`,
                  width: `${motionBox1.width}%`,
                  height: `${motionBox1.height}%`,
                }}
                className="absolute border border-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.3)] pointer-events-none z-10 transition-all duration-75"
              >
                <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-rose-400"></div>
                <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-rose-400"></div>
                <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-rose-400"></div>
                <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-rose-400"></div>
              </div>
            )}

            {/* Crosshair Center mark */}
            <div className="absolute pointer-events-none inset-0 flex items-center justify-center z-10 opacity-15">
              <div className="w-8 h-8 relative">
                <div className="absolute top-0 left-0 w-2.5 h-0.5 bg-emerald-400"></div>
                <div className="absolute top-0 left-0 w-0.5 h-2.5 bg-emerald-400"></div>
                <div className="absolute bottom-0 right-0 w-2.5 h-0.5 bg-emerald-400"></div>
                <div className="absolute bottom-0 right-0 w-0.5 h-2.5 bg-emerald-400"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-emerald-500 rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Bottom HUD bar */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-top from-black/95 to-transparent p-3 flex items-center justify-between font-mono text-[9px] text-zinc-400 z-20">
            <span>FPS: {fps1}</span>
            
            <button
              onClick={() => captureSnapshot('manual')}
              disabled={isCapturing1 || !webcamActive1}
              className={`px-3 py-1 rounded-lg font-mono font-bold tracking-wider text-[8px] border transition-all flex items-center gap-1.5 ${
                isCapturing1 || !webcamActive1
                  ? 'bg-zinc-900 border-zinc-850 text-zinc-650 cursor-not-allowed'
                  : 'bg-emerald-500 text-zinc-950 border-emerald-400 hover:bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)] hover:scale-105 active:scale-95'
              }`}
            >
              CAPTURAR
            </button>

            <span className="text-[8px] text-zinc-500 tracking-wider">STREAM REMOTO</span>
          </div>
          <canvas ref={canvasRef1} className="hidden" />
        </div>
      </div>

      {/* Side Sensors & Control Diagnostics Panel */}
      <div className="lg:col-span-4 flex flex-col">
        <div className="panel-glass rounded-2xl p-5 flex flex-col h-full border border-zinc-800 space-y-5 justify-between">
          <div>
            <h3 className="font-mono text-xs font-semibold tracking-wider text-zinc-400 uppercase mb-3 pb-2 border-b border-zinc-800 flex items-center justify-between">
              <span>Painel de Telemetria</span>
              <span className={`h-2 w-2 rounded-full ${
                sensorStatus === 'CONNECTED' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500 animate-pulse'
              }`}></span>
            </h3>

            {/* Live Sensors Grid */}
            <div className="grid grid-cols-2 gap-4 animate-fade-in">
              {/* Temperature Display */}
              <div className="bg-zinc-950/70 p-4 rounded-xl border border-zinc-850 flex flex-col justify-between min-h-[90px] hover:border-cyan-500/30 transition-all duration-300">
                <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest block">Temperatura</span>
                {sensorStatus === 'CONNECTED' && sensorData ? (
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-cyan-400 font-mono tracking-tight">
                      {sensorData.temperature.toFixed(1)}
                    </span>
                    <span className="text-xs text-zinc-400 font-mono">°C</span>
                  </div>
                ) : (
                  <span className="text-xs text-zinc-600 font-mono mt-2 animate-pulse">Lendo...</span>
                )}
                <span className="text-[8px] text-zinc-650 font-mono mt-1">DHT11_SENSOR_T</span>
              </div>

              {/* Humidity Display */}
              <div className="bg-zinc-950/70 p-4 rounded-xl border border-zinc-850 flex flex-col justify-between min-h-[90px] hover:border-cyan-500/30 transition-all duration-300">
                <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest block">Umidade Ar</span>
                {sensorStatus === 'CONNECTED' && sensorData ? (
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-cyan-400 font-mono tracking-tight">
                      {sensorData.humidity.toFixed(1)}
                    </span>
                    <span className="text-xs text-zinc-400 font-mono">%</span>
                  </div>
                ) : (
                  <span className="text-xs text-zinc-600 font-mono mt-2 animate-pulse">Lendo...</span>
                )}
                <span className="text-[8px] text-zinc-650 font-mono mt-1">DHT11_SENSOR_H</span>
              </div>

              {/* CPU Usage Display */}
              <div className="bg-zinc-950/70 p-4 rounded-xl border border-zinc-850 flex flex-col justify-between min-h-[90px] hover:border-cyan-500/30 transition-all duration-300">
                <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest block">Uso da CPU</span>
                {sensorStatus === 'CONNECTED' && sensorData ? (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-bold text-cyan-400 font-mono tracking-tight">
                        {sensorData.cpu_usage !== undefined ? sensorData.cpu_usage : 0}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">%</span>
                    </div>
                    <div className="w-full bg-zinc-900 rounded-full h-1 border border-zinc-800 overflow-hidden">
                      <div 
                        className="bg-cyan-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${sensorData.cpu_usage !== undefined ? Math.min(sensorData.cpu_usage, 100) : 0}%` }}
                      ></div>
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-zinc-600 font-mono mt-2 animate-pulse">Lendo...</span>
                )}
                <span className="text-[8px] text-zinc-650 font-mono mt-1">HOST_CPU_LOAD</span>
              </div>

              {/* RAM Usage Display */}
              <div className="bg-zinc-950/70 p-4 rounded-xl border border-zinc-850 flex flex-col justify-between min-h-[90px] hover:border-cyan-500/30 transition-all duration-300">
                <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest block">Memória RAM</span>
                {sensorStatus === 'CONNECTED' && sensorData ? (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-bold text-cyan-400 font-mono tracking-tight">
                        {sensorData.ram_usage !== undefined ? sensorData.ram_usage : 0}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">%</span>
                    </div>
                    <div className="w-full bg-zinc-900 rounded-full h-1 border border-zinc-800 overflow-hidden">
                      <div 
                        className="bg-cyan-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${sensorData.ram_usage !== undefined ? Math.min(sensorData.ram_usage, 100) : 0}%` }}
                      ></div>
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-zinc-600 font-mono mt-2 animate-pulse">Lendo...</span>
                )}
                <span className="text-[8px] text-zinc-650 font-mono mt-1">HOST_RAM_USAGE</span>
              </div>
            </div>

            {/* Diagnostic Status indicators */}
            <div className="mt-4 bg-zinc-950/50 p-4 rounded-xl border border-zinc-850 font-mono text-[9px] text-zinc-400 space-y-2.5">
              <span className="text-zinc-500 uppercase tracking-widest block mb-1">Status dos Serviços</span>
              
              <div className="flex justify-between items-center">
                <span>SCRIPT RECEPTOR ARDUINO</span>
                <span className={`px-2 py-0.5 rounded font-bold text-[8px] border transition-all ${
                  sensorStatus === 'CONNECTED' && sensorData?.system_status === 'online'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : sensorStatus === 'CONNECTED' && sensorData?.system_status === 'inicializando'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                }`}>
                  {sensorStatus === 'CONNECTED'
                    ? (sensorData?.system_status || 'ONLINE').toUpperCase()
                    : 'ERRO / OFF'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span>STREAMER DE VÍDEO (8080)</span>
                <span className={`px-2 py-0.5 rounded font-bold text-[8px] border transition-all ${
                  sensorStatus === 'CONNECTED' && sensorData?.camera_online
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                }`}>
                  {sensorStatus === 'CONNECTED' && sensorData?.camera_online ? 'ATIVO' : 'INATIVO'}
                </span>
              </div>
            </div>

            {/* Stream IP Address Input */}
            <div className="mt-5 bg-zinc-950/50 p-4 rounded-xl border border-zinc-850 space-y-3">
              <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest block">Endereço IP do Streamer (MJPEG)</span>
              
              <div className="space-y-1 pt-1.5">
                <span className="font-mono text-[8px] text-zinc-500 block uppercase">
                  IP do Servidor (mjpg-streamer)
                </span>
                <input
                  type="text"
                  value={mjpegServerIp}
                  onChange={(e) => setMjpegServerIp(e.target.value)}
                  placeholder="Ex: 192.168.1.100 ou localhost"
                  className="w-full bg-zinc-950 border border-zinc-850 rounded px-2 py-1 text-[10px] font-mono text-zinc-200 outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            {/* Motion Detector Options */}
            <div className="mt-5 bg-zinc-950/40 p-4 rounded-xl border border-zinc-850 space-y-4">
              <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest block">Configuração do Rastreamento</span>
              
              {/* Camera Controls */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-300 font-mono">Auto Registro Câmera</span>
                  <button
                    onClick={() => setAutoCaptureEnabled1(!autoCaptureEnabled1)}
                    className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 outline-none border ${
                      autoCaptureEnabled1 
                        ? 'bg-emerald-500/20 border-emerald-500/50 flex justify-end' 
                        : 'bg-zinc-900 border-zinc-850 flex justify-start'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full ${
                      autoCaptureEnabled1 ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-zinc-600'
                    }`}></span>
                  </button>
                </div>
                {cooldownTimeLeft1 > 0 && (
                  <div className="bg-rose-950/20 border border-rose-900/30 rounded p-1.5 font-mono text-[9px] text-rose-400 text-center flex items-center justify-center gap-1.5 animate-pulse">
                    <span className="h-1.5 w-1.5 bg-rose-500 rounded-full animate-ping"></span>
                    <span>COOLDOWN CÂMERA: {cooldownTimeLeft1}s</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick instructions / Info box */}
          <div className="p-3.5 bg-zinc-950 border border-zinc-850 rounded-xl font-mono text-[9px] text-zinc-500 space-y-1">
            <p className="text-zinc-400 font-bold border-b border-zinc-900 pb-1.5 mb-1.5 uppercase">
              Rastreamento de Fauna
            </p>
            <p className="text-emerald-400 font-bold">Modo: Monitor MJPEG Remoto</p>
            <p>• **Monitoramento**: Visualiza o stream de vídeo do mjpg-streamer em tempo real.</p>
            <p>• **Conexão**: Utiliza a porta dedicada 8080 via protocolo MJPEG.</p>
            <p>• Detecção de pixels e capturas automatizadas continuam ativas no navegador.</p>
          </div>
        </div>
      </div>

    </div>
  );
}
