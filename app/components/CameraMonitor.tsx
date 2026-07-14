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
  const [cameraError2, setCameraError2] = useState<string | null>(null);
  
  // These indicate whether the MJPEG streams are active / loaded
  const [webcamActive1, setWebcamActive1] = useState(false);
  const [webcamActive2, setWebcamActive2] = useState(false);

  // Streaming IP Option for direct MJPEG stream
  const [mjpegServerIp, setMjpegServerIp] = useState('localhost');
  const [ipInput, setIpInput] = useState('localhost');

  // Image Refs (for MONITOR mode canvas grabbings)
  const imgRef1 = useRef<HTMLImageElement>(null);
  const imgRef2 = useRef<HTMLImageElement>(null);

  // Derived Stream Feed URLs targeting mjpg-streamer ports 8080 & 8081
  const cameraFeed1 = `http://${mjpegServerIp.split(':')[0]}:8080/?action=stream`;
  const cameraFeed2 = `http://${mjpegServerIp.split(':')[0]}:8081/?action=stream`;

  // Snapshot Capture Canvases
  const canvasRef1 = useRef<HTMLCanvasElement>(null);
  const canvasRef2 = useRef<HTMLCanvasElement>(null);
  const [isCapturing1, setIsCapturing1] = useState(false);
  const [isCapturing2, setIsCapturing2] = useState(false);

  // Clock HUD State
  const [timestamp, setTimestamp] = useState('');
  const [fps1, setFps1] = useState(30);
  const [fps2, setFps2] = useState(30);

  // Sensor Telemetry State (DHT22 Readings)
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [sensorStatus, setSensorStatus] = useState<'CONNECTED' | 'DISCONNECTED' | 'ERROR'>('DISCONNECTED');

  // Motion Detection States (independent per camera)
  const [motionDetected1, setMotionDetected1] = useState(false);
  const [motionDetected2, setMotionDetected2] = useState(false);
  const [motionBox1, setMotionBox1] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [motionBox2, setMotionBox2] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  const [autoCaptureEnabled1, setAutoCaptureEnabled1] = useState(true);
  const [autoCaptureEnabled2, setAutoCaptureEnabled2] = useState(true);
  
  const [cooldownTimeLeft1, setCooldownTimeLeft1] = useState(0);
  const [cooldownTimeLeft2, setCooldownTimeLeft2] = useState(0);

  // Refs for motion tracking loops
  const motionStreakCount1 = useRef(0);
  const motionStreakCount2 = useRef(0);
  const isCooldownActive1 = useRef(false);
  const isCooldownActive2 = useRef(false);
  const cooldownTimerRef1 = useRef<NodeJS.Timeout | null>(null);
  const cooldownTimerRef2 = useRef<NodeJS.Timeout | null>(null);
  
  const prevPixels1 = useRef<Uint8ClampedArray | null>(null);
  const prevPixels2 = useRef<Uint8ClampedArray | null>(null);

  // Clock Update & Subtle FPS Jitter
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setTimestamp(now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
      setFps1(Math.floor(29 + Math.random() * 2));
      setFps2(Math.floor(29 + Math.random() * 2));
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
  const triggerAutoCapture = (camIndex: 1 | 2) => {
    const isCooldownActive = camIndex === 1 ? isCooldownActive1 : isCooldownActive2;
    const isCapturing = camIndex === 1 ? isCapturing1 : isCapturing2;
    const motionStreakCount = camIndex === 1 ? motionStreakCount1 : motionStreakCount2;
    const setCooldownTimeLeft = camIndex === 1 ? setCooldownTimeLeft1 : setCooldownTimeLeft2;
    const cooldownTimerRef = camIndex === 1 ? cooldownTimerRef1 : cooldownTimerRef2;

    if (isCooldownActive.current || isCapturing) return;

    motionStreakCount.current = 0;
    isCooldownActive.current = true;
    setCooldownTimeLeft(8);

    let secondsLeft = 8;
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    cooldownTimerRef.current = setInterval(() => {
      secondsLeft -= 1;
      setCooldownTimeLeft(secondsLeft);
      if (secondsLeft <= 0) {
        if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
        isCooldownActive.current = false;
      }
    }, 1000);

    captureSnapshot(camIndex, 'automatic');
  };

  const captureSnapshot = (camIndex: 1 | 2, type: 'manual' | 'automatic') => {
    const isCapturing = camIndex === 1 ? isCapturing1 : isCapturing2;
    const setIsCapturing = camIndex === 1 ? setIsCapturing1 : setIsCapturing2;

    if (isCapturing) return;
    setIsCapturing(true);

    const locationName = camIndex === 1 ? 'WEBCAM_SENSOR_01' : 'WEBCAM_SENSOR_02';
    const temp = sensorData?.temperature ?? 24.5;
    const humid = sensorData?.humidity ?? 60.0;

    const canvas = camIndex === 1 ? canvasRef1.current : canvasRef2.current;

    // Draw from <img> tag to grab the currently visible frame
    const img = camIndex === 1 ? imgRef1.current : imgRef2.current;
    if (!canvas || !img || !img.complete || img.naturalWidth === 0) {
      setIsCapturing(false);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsCapturing(false);
      return;
    }

    canvas.width = img.naturalWidth || 640;
    canvas.height = img.naturalHeight || 360;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    onCapture(dataUrl, type, temp, humid, locationName);
    setIsCapturing(false);
  };

  const handleImageError = (camIndex: 1 | 2) => {
    const setError = camIndex === 1 ? setCameraError1 : setCameraError2;
    const setActive = camIndex === 1 ? setWebcamActive1 : setWebcamActive2;
    setError('SEM SINAL // STREAM OFFLINE');
    setActive(false);
  };

  const handleImageLoad = (camIndex: 1 | 2) => {
    const setError = camIndex === 1 ? setCameraError1 : setCameraError2;
    const setActive = camIndex === 1 ? setWebcamActive1 : setWebcamActive2;
    setError(null);
    setActive(true);
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
    autoCaptureEnabled: boolean,
    camIndex: 1 | 2
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
        triggerAutoCapture(camIndex);
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
              autoCaptureEnabled1,
              1
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

  // LOOP 2: Câmera 2 (MONITOR mode)
  useEffect(() => {
    let active = true;

    const runMonitorLoop = () => {
      if (!active || !imgRef2.current) return;
      const img = imgRef2.current;
      
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
              prevPixels2.current,
              setMotionDetected2,
              setMotionBox2,
              motionStreakCount2,
              autoCaptureEnabled2,
              2
            );
            prevPixels2.current = currentPixels;
          }
        } catch (e) {
          console.error(e);
        }
      }
      setTimeout(runMonitorLoop, 150);
    };

    runMonitorLoop();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCaptureEnabled2, cameraFeed2]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* Dual Video Stream Containers */}
      <div className="lg:col-span-8 flex flex-col gap-6">
        
        {/* Video Viewport Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* CAMERA 1 CONTAINER */}
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
                  <span className="font-bold text-zinc-200 uppercase tracking-wider">CÂN_01 // ATIVA</span>
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
                  alt="Camera 1 stream"
                  crossOrigin="anonymous"
                  onError={() => handleImageError(1)}
                  onLoad={() => handleImageLoad(1)}
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
                onClick={() => captureSnapshot(1, 'manual')}
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

          {/* CAMERA 2 CONTAINER */}
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
                  <span className="font-bold text-zinc-200 uppercase tracking-wider">CÂN_02 // ATIVA</span>
                </span>
                {motionDetected2 && (
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
                  ref={imgRef2}
                  src={cameraFeed2}
                  alt="Camera 2 stream"
                  crossOrigin="anonymous"
                  onError={() => handleImageError(2)}
                  onLoad={() => handleImageLoad(2)}
                  className={`w-full h-full object-cover select-none ${cameraError2 ? 'hidden' : 'block'}`}
                />
                {cameraError2 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 font-mono text-[9px] text-rose-500/70 z-20 p-4 text-center">
                    <svg className="animate-pulse h-6 w-6 mb-2 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="font-bold">{cameraError2}</span>
                    <span className="text-[8px] text-zinc-650 mt-1">
                      Verifique se o mjpg-streamer está rodando na porta 8081 e se o IP do servidor está correto.
                    </span>
                  </div>
                )}
              </>

              {/* Bounding box detection box */}
              {motionBox2 && webcamActive2 && !cameraError2 && (
                <div
                  style={{
                    left: `${motionBox2.left}%`,
                    top: `${motionBox2.top}%`,
                    width: `${motionBox2.width}%`,
                    height: `${motionBox2.height}%`,
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
              <span>FPS: {fps2}</span>
              
              <button
                onClick={() => captureSnapshot(2, 'manual')}
                disabled={isCapturing2 || !webcamActive2}
                className={`px-3 py-1 rounded-lg font-mono font-bold tracking-wider text-[8px] border transition-all flex items-center gap-1.5 ${
                  isCapturing2 || !webcamActive2
                    ? 'bg-zinc-950 border-zinc-850 text-zinc-650 cursor-not-allowed'
                    : 'bg-emerald-500 text-zinc-950 border-emerald-400 hover:bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)] hover:scale-105 active:scale-95'
                }`}
              >
                CAPTURAR
              </button>

              <span className="text-[8px] text-zinc-500 tracking-wider">STREAM REMOTO</span>
            </div>
            <canvas ref={canvasRef2} className="hidden" />
          </div>

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
                <span>STREAMER DE VÍDEO (8080/8081)</span>
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
              
              <div className="space-y-2 pt-1.5">
                <span className="font-mono text-[8px] text-zinc-500 block uppercase">
                  IP do Servidor (mjpg-streamer)
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ipInput}
                    onChange={(e) => setIpInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setMjpegServerIp(ipInput);
                      }
                    }}
                    placeholder="Ex: 192.168.1.100 ou localhost"
                    className="flex-1 bg-zinc-950 border border-zinc-850 rounded px-2 py-1 text-[10px] font-mono text-zinc-200 outline-none focus:border-amber-500 transition-colors"
                  />
                  <button
                    onClick={() => setMjpegServerIp(ipInput)}
                    className="px-3 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 font-mono text-[9px] font-bold hover:bg-zinc-850 hover:border-zinc-700 active:scale-95 transition-all"
                  >
                    CONECTAR
                  </button>
                </div>
              </div>
            </div>

            {/* Motion Detector Options */}
            <div className="mt-5 bg-zinc-950/40 p-4 rounded-xl border border-zinc-850 space-y-4">
              <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest block">Configuração do Rastreamento</span>
              
              {/* Camera 1 Controls */}
              <div className="space-y-2 pb-3 border-b border-zinc-900">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-300 font-mono">Auto Registro Câm 1</span>
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
                    <span>COOLDOWN CÂM 1: {cooldownTimeLeft1}s</span>
                  </div>
                )}
              </div>

              {/* Camera 2 Controls */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-300 font-mono">Auto Registro Câm 2</span>
                  <button
                    onClick={() => setAutoCaptureEnabled2(!autoCaptureEnabled2)}
                    className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 outline-none border ${
                      autoCaptureEnabled2 
                        ? 'bg-emerald-500/20 border-emerald-500/50 flex justify-end' 
                        : 'bg-zinc-900 border-zinc-850 flex justify-start'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full ${
                      autoCaptureEnabled2 ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-zinc-600'
                    }`}></span>
                  </button>
                </div>
                {cooldownTimeLeft2 > 0 && (
                  <div className="bg-rose-950/20 border border-rose-900/30 rounded p-1.5 font-mono text-[9px] text-rose-400 text-center flex items-center justify-center gap-1.5 animate-pulse">
                    <span className="h-1.5 w-1.5 bg-rose-500 rounded-full animate-ping"></span>
                    <span>COOLDOWN CÂM 2: {cooldownTimeLeft2}s</span>
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
            <p>• **Monitoramento**: Visualiza os streams de vídeo do mjpg-streamer em tempo real.</p>
            <p>• **Conexão**: Utiliza portas dedicadas 8080 (Cam 1) e 8081 (Cam 2) via protocolo MJPEG.</p>
            <p>• Detecção de pixels e capturas automatizadas continuam ativas no navegador.</p>
          </div>
        </div>
      </div>

    </div>
  );
}
