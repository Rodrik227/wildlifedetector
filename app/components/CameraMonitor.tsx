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
  // Console Mode State
  // MONITOR: receives streams from the base PC via MJPEG streaming
  // SENDER: captures local webcams and uploads them to the Next.js API
  const [consoleMode, setConsoleMode] = useState<'MONITOR' | 'SENDER'>('MONITOR');

  // Video Refs & Streams (for SENDER mode)
  const videoRef1 = useRef<HTMLVideoElement>(null);
  const videoRef2 = useRef<HTMLVideoElement>(null);
  const streamRef1 = useRef<MediaStream | null>(null);
  const streamRef2 = useRef<MediaStream | null>(null);
  
  const [stream1, setStream1] = useState<MediaStream | null>(null);
  const [stream2, setStream2] = useState<MediaStream | null>(null);
  
  const [cameraError1, setCameraError1] = useState<string | null>(null);
  const [cameraError2, setCameraError2] = useState<string | null>(null);
  
  const [webcamActive1, setWebcamActive1] = useState(false);
  const [webcamActive2, setWebcamActive2] = useState(false);

  // Streaming Options (for MONITOR mode)
  const [streamSource, setStreamSource] = useState<'NEXTJS' | 'PYTHON'>('NEXTJS');
  const [pythonServerIp, setPythonServerIp] = useState('localhost:8080');

  // Image Refs (for MONITOR mode canvas grabbings)
  const imgRef1 = useRef<HTMLImageElement>(null);
  const imgRef2 = useRef<HTMLImageElement>(null);

  // Derived Stream Feed URLs
  const cameraFeed1 = streamSource === 'NEXTJS'
    ? '/api/camera/stream?id=1'
    : `http://${pythonServerIp}/video1`;

  const cameraFeed2 = streamSource === 'NEXTJS'
    ? '/api/camera/stream?id=2'
    : `http://${pythonServerIp}/video2`;

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

  // Available video sources list (for SENDER mode)
  const [availableVideoDevices, setAvailableVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDeviceId1, setSelectedVideoDeviceId1] = useState('');
  const [selectedVideoDeviceId2, setSelectedVideoDeviceId2] = useState('');

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

  // Enumerate video devices (for SENDER mode)
  useEffect(() => {
    if (consoleMode !== 'SENDER') return;
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.enumerateDevices()
        .then(devices => {
          const videoDevs = devices.filter(d => d.kind === 'videoinput');
          setAvailableVideoDevices(videoDevs);
          
          if (videoDevs.length > 0) {
            if (!selectedVideoDeviceId1) {
              setSelectedVideoDeviceId1(videoDevs[0].deviceId);
            }
            if (!selectedVideoDeviceId2) {
              setSelectedVideoDeviceId2(videoDevs[1]?.deviceId || 'disabled');
            }
          }
        })
        .catch(err => {
          console.error("Error enumerating video sources: ", err);
        });
    }
  }, [consoleMode, selectedVideoDeviceId1, selectedVideoDeviceId2]);

  // Webcam stream helpers (SENDER mode)
  const startWebcam = async (camIndex: 1 | 2, deviceId: string) => {
    const setWebcamActive = camIndex === 1 ? setWebcamActive1 : setWebcamActive2;
    const setCameraError = camIndex === 1 ? setCameraError1 : setCameraError2;
    const setStream = camIndex === 1 ? setStream1 : setStream2;
    const videoRef = camIndex === 1 ? videoRef1 : videoRef2;
    const streamRef = camIndex === 1 ? streamRef1 : streamRef2;

    setCameraError(null);
    setWebcamActive(false);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (!deviceId || deviceId === 'disabled') {
      setCameraError('CÂMERA DESATIVADA / STANDBY');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: { deviceId: { exact: deviceId }, width: 1280, height: 720 },
        audio: false,
      };

      const userStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = userStream;
      setStream(userStream);
      setWebcamActive(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = userStream;
      }
    } catch (err: unknown) {
      console.error(`Failed to open camera ${camIndex}:`, err);
      let errMsg = 'Acesso à câmera negado ou indisponível.';
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          errMsg = 'Permissão de acesso à câmera negada.';
        } else if (err.name === 'NotFoundError') {
          errMsg = 'Câmera não encontrada.';
        }
      }
      setCameraError(errMsg);
      setWebcamActive(false);
    }
  };

  const stopWebcam = (camIndex: 1 | 2) => {
    const streamRef = camIndex === 1 ? streamRef1 : streamRef2;
    const setStream = camIndex === 1 ? setStream1 : setStream2;
    const setWebcamActive = camIndex === 1 ? setWebcamActive1 : setWebcamActive2;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setStream(null);
    setWebcamActive(false);
  };

  useEffect(() => {
    if (consoleMode === 'SENDER') {
      if (selectedVideoDeviceId1) startWebcam(1, selectedVideoDeviceId1);
    } else {
      stopWebcam(1);
    }
    return () => stopWebcam(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consoleMode, selectedVideoDeviceId1]);

  useEffect(() => {
    if (consoleMode === 'SENDER') {
      if (selectedVideoDeviceId2) startWebcam(2, selectedVideoDeviceId2);
    } else {
      stopWebcam(2);
    }
    return () => stopWebcam(2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consoleMode, selectedVideoDeviceId2]);

  // ==========================================
  // SENDER MODE: Background Upload of Frames
  // ==========================================
  
  // Camera 1 Upload
  useEffect(() => {
    if (consoleMode !== 'SENDER' || !webcamActive1 || !stream1 || !videoRef1.current) return;

    const video = videoRef1.current;
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let active = true;
    const uploadInterval = setInterval(async () => {
      if (!active) return;
      if (video.readyState < video.HAVE_CURRENT_DATA) return;

      try {
        ctx.drawImage(video, 0, 0, 640, 360);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        await fetch('/api/camera/upload?id=1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: dataUrl })
        });
      } catch (err) {
        console.error("Erro no envio remoto da Câmera 1:", err);
      }
    }, 150); // ~7 FPS

    return () => {
      active = false;
      clearInterval(uploadInterval);
    };
  }, [consoleMode, webcamActive1, stream1]);

  // Camera 2 Upload
  useEffect(() => {
    if (consoleMode !== 'SENDER' || !webcamActive2 || !stream2 || !videoRef2.current) return;

    const video = videoRef2.current;
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let active = true;
    const uploadInterval = setInterval(async () => {
      if (!active) return;
      if (video.readyState < video.HAVE_CURRENT_DATA) return;

      try {
        ctx.drawImage(video, 0, 0, 640, 360);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        await fetch('/api/camera/upload?id=2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: dataUrl })
        });
      } catch (err) {
        console.error("Erro no envio remoto da Câmera 2:", err);
      }
    }, 150);

    return () => {
      active = false;
      clearInterval(uploadInterval);
    };
  }, [consoleMode, webcamActive2, stream2]);


  // ==========================================
  // DETECÇÃO DE MOVIMENTO (MOTION DETECTION)
  // ==========================================

  const processPixelDifferencing = (
    currentPixels: Uint8ClampedArray,
    prevPixels: Uint8ClampedArray | null,
    setMotionDetected: (detected: boolean) => void,
    setMotionBox: (box: any) => void,
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

      const streakLimit = consoleMode === 'MONITOR' ? 4 : 8;
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

  // LOOP 1: Câmera 1 (SENDER mode)
  useEffect(() => {
    if (consoleMode !== 'SENDER') return;
    let active = true;

    const runSenderLoop = () => {
      if (!active || consoleMode !== 'SENDER' || !webcamActive1 || !videoRef1.current) return;
      const video = videoRef1.current;
      if (video.readyState >= video.HAVE_CURRENT_DATA) {
        try {
          const procCanvas = document.createElement('canvas');
          procCanvas.width = 64;
          procCanvas.height = 48;
          const procCtx = procCanvas.getContext('2d');
          if (procCtx) {
            procCtx.drawImage(video, 0, 0, 64, 48);
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
      setTimeout(runSenderLoop, 66);
    };

    setTimeout(runSenderLoop, 1000);

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consoleMode, webcamActive1, autoCaptureEnabled1]);

  // LOOP 1: Câmera 1 (MONITOR mode)
  useEffect(() => {
    if (consoleMode !== 'MONITOR') return;
    let active = true;

    const runMonitorLoop = () => {
      if (!active || consoleMode !== 'MONITOR' || !imgRef1.current) return;
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
  }, [consoleMode, autoCaptureEnabled1, cameraFeed1]);

  // LOOP 2: Câmera 2 (SENDER mode)
  useEffect(() => {
    if (consoleMode !== 'SENDER') return;
    let active = true;

    const runSenderLoop = () => {
      if (!active || consoleMode !== 'SENDER' || !webcamActive2 || !videoRef2.current) return;
      const video = videoRef2.current;
      if (video.readyState >= video.HAVE_CURRENT_DATA) {
        try {
          const procCanvas = document.createElement('canvas');
          procCanvas.width = 64;
          procCanvas.height = 48;
          const procCtx = procCanvas.getContext('2d');
          if (procCtx) {
            procCtx.drawImage(video, 0, 0, 64, 48);
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
      setTimeout(runSenderLoop, 66);
    };

    setTimeout(runSenderLoop, 1000);

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consoleMode, webcamActive2, autoCaptureEnabled2]);

  // LOOP 2: Câmera 2 (MONITOR mode)
  useEffect(() => {
    if (consoleMode !== 'MONITOR') return;
    let active = true;

    const runMonitorLoop = () => {
      if (!active || consoleMode !== 'MONITOR' || !imgRef2.current) return;
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
  }, [consoleMode, autoCaptureEnabled2, cameraFeed2]);


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

    if (consoleMode === 'SENDER') {
      const video = camIndex === 1 ? videoRef1.current : videoRef2.current;
      if (!canvas || !video || video.readyState < video.HAVE_CURRENT_DATA) {
        setIsCapturing(false);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsCapturing(false);
        return;
      }

      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

      onCapture(dataUrl, type, temp, humid, locationName);
      setIsCapturing(false);
    } else {
      // MONITOR Mode: Draw from <img> tag to grab the currently visible frame
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
    }
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

  useEffect(() => {
    return () => {
      if (cooldownTimerRef1.current) clearInterval(cooldownTimerRef1.current);
      if (cooldownTimerRef2.current) clearInterval(cooldownTimerRef2.current);
    };
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* Dual Video Stream Containers */}
      <div className="lg:col-span-8 flex flex-col gap-6">
        
        {/* Mode Selector Panel */}
        <div className="panel-glass rounded-2xl p-4 border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Configuração do Modo de Visualização
            </span>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setConsoleMode('MONITOR')}
              className={`px-4 py-1.5 rounded-lg font-mono text-[10px] font-bold tracking-wider border transition-all ${
                consoleMode === 'MONITOR'
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                  : 'bg-zinc-900 border-zinc-850 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              MODO MONITOR (REMOTO)
            </button>
            <button
              onClick={() => setConsoleMode('SENDER')}
              className={`px-4 py-1.5 rounded-lg font-mono text-[10px] font-bold tracking-wider border transition-all ${
                consoleMode === 'SENDER'
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                  : 'bg-zinc-900 border-zinc-850 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              MODO TRANSMISSOR (LOCAL)
            </button>
          </div>
        </div>

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
              {consoleMode === 'SENDER' ? (
                cameraError1 ? (
                  <div className="text-center p-4 max-w-xs z-20 bg-zinc-900/90 rounded-xl border border-rose-950 text-zinc-400">
                    <p className="font-mono text-[10px] font-semibold text-rose-400 mb-1">CÂMERA 1 OFFLINE</p>
                    <p className="text-[9px] leading-relaxed mb-2">{cameraError1}</p>
                    {selectedVideoDeviceId1 !== 'disabled' && (
                      <button 
                        onClick={() => startWebcam(1, selectedVideoDeviceId1)} 
                        className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded text-[9px] font-mono transition-all"
                      >
                        RECONECTAR
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef1}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover select-none"
                    />
                    {!webcamActive1 && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 font-mono text-[10px] text-emerald-400 z-20">
                        <svg className="animate-spin h-5 w-5 mb-2" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>CONECTANDO HARDWARE...</span>
                      </div>
                    )}
                  </>
                )
              ) : (
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
                      <span className="text-[8px] text-zinc-600 mt-1">
                        {streamSource === 'NEXTJS' 
                          ? 'Inicie a transmissão no computador base' 
                          : 'Verifique se o script Python está rodando no IP correto'}
                      </span>
                    </div>
                  )}
                </>
              )}

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

              {consoleMode === 'SENDER' ? (
                <select
                  value={selectedVideoDeviceId1}
                  onChange={(e) => setSelectedVideoDeviceId1(e.target.value)}
                  className="bg-zinc-900/90 border border-zinc-800 rounded px-1.5 py-0.5 text-zinc-300 outline-none text-[8px] font-mono cursor-pointer max-w-[85px] truncate"
                >
                  {availableVideoDevices.map(device => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Câmera ${availableVideoDevices.indexOf(device) + 1}`}
                    </option>
                  ))}
                  {availableVideoDevices.length === 0 && (
                    <option value="">Sem câmera</option>
                  )}
                </select>
              ) : (
                <span className="text-[8px] text-zinc-500 tracking-wider">STREAM REMOTO</span>
              )}
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
              {consoleMode === 'SENDER' ? (
                cameraError2 ? (
                  <div className="text-center p-4 max-w-xs z-20 bg-zinc-900/90 rounded-xl border border-rose-950 text-zinc-400">
                    <p className="font-mono text-[10px] font-semibold text-rose-400 mb-1">CÂMERA 2 STANDBY</p>
                    <p className="text-[9px] leading-relaxed mb-2">{cameraError2}</p>
                    {selectedVideoDeviceId2 !== 'disabled' && (
                      <button 
                        onClick={() => startWebcam(2, selectedVideoDeviceId2)} 
                        className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded text-[9px] font-mono transition-all"
                      >
                        RECONECTAR
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef2}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover select-none"
                    />
                    {!webcamActive2 && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 font-mono text-[10px] text-emerald-400 z-20">
                        <svg className="animate-spin h-5 w-5 mb-2" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>CONECTANDO HARDWARE...</span>
                      </div>
                    )}
                  </>
                )
              ) : (
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
                      <span className="text-[8px] text-zinc-600 mt-1">
                        {streamSource === 'NEXTJS' 
                          ? 'Inicie a transmissão no computador base' 
                          : 'Verifique se o script Python está rodando no IP correto'}
                      </span>
                    </div>
                  )}
                </>
              )}

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
                    ? 'bg-zinc-900 border-zinc-850 text-zinc-650 cursor-not-allowed'
                    : 'bg-emerald-500 text-zinc-950 border-emerald-400 hover:bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)] hover:scale-105 active:scale-95'
                }`}
              >
                CAPTURAR
              </button>

              {consoleMode === 'SENDER' ? (
                <select
                  value={selectedVideoDeviceId2}
                  onChange={(e) => setSelectedVideoDeviceId2(e.target.value)}
                  className="bg-zinc-900/90 border border-zinc-800 rounded px-1.5 py-0.5 text-zinc-300 outline-none text-[8px] font-mono cursor-pointer max-w-[85px] truncate"
                >
                  <option value="disabled">Desativar</option>
                  {availableVideoDevices.map(device => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Câmera ${availableVideoDevices.indexOf(device) + 1}`}
                    </option>
                  ))}
                  {availableVideoDevices.length === 0 && (
                    <option value="">Sem câmera</option>
                  )}
                </select>
              ) : (
                <span className="text-[8px] text-zinc-500 tracking-wider">STREAM REMOTO</span>
              )}
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
                <span className="text-[8px] text-zinc-650 font-mono mt-1">DTH22_SENSOR_1</span>
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
                <span className="text-[8px] text-zinc-650 font-mono mt-1">DTH22_SENSOR_2</span>
              </div>
            </div>

            {/* Stream Origin Options (Monitor Mode config) */}
            {consoleMode === 'MONITOR' && (
              <div className="mt-5 bg-zinc-950/50 p-4 rounded-xl border border-zinc-850 space-y-3">
                <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest block">Origem do Vídeo Remoto</span>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setStreamSource('NEXTJS')}
                    className={`flex-1 py-1 rounded font-mono text-[9px] font-bold border transition-all ${
                      streamSource === 'NEXTJS'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                        : 'bg-zinc-900 border-zinc-850 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    SERVIDOR WEB
                  </button>
                  <button
                    onClick={() => setStreamSource('PYTHON')}
                    className={`flex-1 py-1 rounded font-mono text-[9px] font-bold border transition-all ${
                      streamSource === 'PYTHON'
                        ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400'
                        : 'bg-zinc-900 border-zinc-850 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    IP PYTHON DIRETO
                  </button>
                </div>

                {streamSource === 'PYTHON' && (
                  <div className="space-y-1 pt-1.5">
                    <span className="font-mono text-[8px] text-zinc-500 block uppercase">Endereço IP do Transmissor (Python)</span>
                    <input
                      type="text"
                      value={pythonServerIp}
                      onChange={(e) => setPythonServerIp(e.target.value)}
                      placeholder="Ex: 192.168.1.100:8080"
                      className="w-full bg-zinc-950 border border-zinc-850 rounded px-2 py-1 text-[10px] font-mono text-zinc-200 outline-none focus:border-cyan-500 transition-colors"
                    />
                  </div>
                )}
              </div>
            )}

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
            <p className="text-emerald-400 font-bold">Modo Atual: {consoleMode === 'SENDER' ? 'Transmissor' : 'Monitor'}</p>
            <p>• **Modo Monitor**: Visualiza o stream de vídeo em tempo real.</p>
            <p>• **Servidor Web**: Utiliza um único stream MJPEG (reduz logs do console).</p>
            <p>• **IP Python**: Conexão direta com o script (zero logs no Next.js dev server).</p>
            <p>• Detecção de pixels e capturas continuam ativas no navegador.</p>
          </div>
        </div>
      </div>

    </div>
  );
}
