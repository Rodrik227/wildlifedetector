'use client';
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/purity */

import React, { useState, useEffect, useRef } from 'react';
import CameraMonitor from './components/CameraMonitor';
import ScanModal from './components/ScanModal';
import Catalog from './components/Catalog';
import SensorChart from './components/SensorChart';
import { CatalogedAnimal } from './types';

export default function Home() {
  const [animals, setAnimals] = useState<CatalogedAnimal[]>([]);
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [capturedImageUrl, setCapturedImageUrl] = useState('');
  const [scanLocation, setScanLocation] = useState('WEBCAM_SENSOR_01');
  const [tempAtCapture, setTempAtCapture] = useState(24.5);
  const [humidAtCapture, setHumidAtCapture] = useState(60.0);
  const [hydrated, setHydrated] = useState(false);

  // Notification states for automatic captures
  const [autoCaptureNotify, setAutoCaptureNotify] = useState<string | null>(null);
  const notifyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load catalog items from localStorage on mount (Client-side only)
  useEffect(() => {
    setHydrated(true);
    const stored = localStorage.getItem('wildlens_catalog');
    if (stored) {
      try {
        setAnimals(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse catalog from localStorage:", e);
      }
    } else {
      // Add two initial mock entries representing actual detections with temperature and humidity
      const initialMock: CatalogedAnimal[] = [
        {
          id: 'specimen-mock1',
          name: 'Movimento Suspeito (Mamífero)',
          scientificName: 'A ser verificado',
          category: 'mammal',
          notes: 'Detecção automática acionada por movimento rápido no centro do quadrante de cobertura do sensor.',
          location: 'WEBCAM_SENSOR_01',
          timestamp: Date.now() - 3600000 * 3, // 3 hours ago
          imageUrl: 'https://images.unsplash.com/photo-1575550959106-5a7defe28b56?auto=format&fit=crop&w=800&q=80',
          temperature: 23.4,
          humidity: 65.2,
          detectionType: 'automatic',
        },
        {
          id: 'specimen-mock2',
          name: 'Registro Manual',
          scientificName: 'Felis catus',
          category: 'mammal',
          notes: 'Gato doméstico avistado passando na área de monitoramento durante testes do sensor de temperatura.',
          location: 'WEBCAM_SENSOR_01',
          timestamp: Date.now() - 3600000 * 24, // 1 day ago
          imageUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=800&q=80',
          temperature: 25.1,
          humidity: 58.7,
          detectionType: 'manual',
        }
      ];
      setAnimals(initialMock);
      localStorage.setItem('wildlens_catalog', JSON.stringify(initialMock));
    }
  }, []);

  const handleCapture = (
    imageUrl: string,
    type: 'manual' | 'automatic',
    temp: number,
    humid: number,
    location?: string
  ) => {
    const activeLocation = location || 'WEBCAM_SENSOR_01';
    setTempAtCapture(temp);
    setHumidAtCapture(humid);
    setCapturedImageUrl(imageUrl);

    if (type === 'manual') {
      setScanLocation(activeLocation);
      setIsScanOpen(true);
    } else {
      // Automatic capture - direct registration in catalog!
      const autoAnimal: CatalogedAnimal = {
        id: `specimen-${Math.random().toString(36).substring(2, 11)}`,
        name: `Autocaptura #${Math.floor(100 + Math.random() * 900)}`,
        scientificName: 'Análise de Movimento',
        category: 'other',
        notes: `Detecção de movimento automática disparada pelo sensor de pixels em tempo real. Condições térmicas registradas: ${temp.toFixed(1)}°C com umidade relativa de ${humid.toFixed(1)}%.`,
        location: activeLocation,
        timestamp: Date.now(),
        imageUrl,
        temperature: temp,
        humidity: humid,
        detectionType: 'automatic',
      };

      setAnimals(prev => {
        const updated = [autoAnimal, ...prev];
        localStorage.setItem('wildlens_catalog', JSON.stringify(updated));
        return updated;
      });

      // Show floating notification on UI
      triggerNotification(`Nova captura automática registrada! Temp: ${temp.toFixed(1)}°C | Umid: ${humid.toFixed(1)}%`);
    }
  };

  const triggerNotification = (message: string) => {
    if (notifyTimeoutRef.current) clearTimeout(notifyTimeoutRef.current);
    setAutoCaptureNotify(message);
    notifyTimeoutRef.current = setTimeout(() => {
      setAutoCaptureNotify(null);
    }, 4000);
  };

  const handleSaveAnimal = (newAnimalData: Omit<CatalogedAnimal, 'id' | 'timestamp'>) => {
    const newAnimal: CatalogedAnimal = {
      ...newAnimalData,
      id: `specimen-${Math.random().toString(36).substring(2, 11)}`,
      timestamp: Date.now(),
    };

    setAnimals(prev => {
      const updated = [newAnimal, ...prev];
      localStorage.setItem('wildlens_catalog', JSON.stringify(updated));
      return updated;
    });

    setIsScanOpen(false);
  };

  const handleDeleteAnimal = (id: string) => {
    setAnimals(prev => {
      const updated = prev.filter(a => a.id !== id);
      localStorage.setItem('wildlens_catalog', JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    return () => {
      if (notifyTimeoutRef.current) clearTimeout(notifyTimeoutRef.current);
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-zinc-950 text-zinc-100 selection:bg-emerald-500/30 selection:text-emerald-400">

      {/* Grid background overlay */}
      <div className="absolute inset-0 pointer-events-none grid-overlay opacity-30 z-0"></div>

      {/* Floating Auto-Capture Notification */}
      {autoCaptureNotify && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-rose-950/90 text-rose-300 border-2 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.6)] backdrop-blur-md px-6 py-3.5 rounded-2xl flex items-center gap-3 font-mono text-xs font-semibold">
            <span className="relative flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500"></span>
            </span>
            <span>{autoCaptureNotify}</span>
          </div>
        </div>
      )}

      {/* Main Layout Container */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex flex-col gap-8 z-10">

        {/* Tactical Header */}
        <header className="panel-glass rounded-2xl p-6 border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
          <div>
            <div className="flex items-center gap-3">
              <span className="relative flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
              </span>
              <h1 className="font-mono text-base sm:text-lg font-bold tracking-widest text-emerald-400 uppercase">
                WILDLENS CONSOLE // MONITOR DE FAUNA
              </h1>
            </div>
            <p className="text-xs text-zinc-400 mt-1 font-sans">
              Sistema de Rastreamento de Movimento por Câmera & Leitura de Sensores Ambientais
            </p>
          </div>

          {/* Quick Stats telemetry */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-6 font-mono text-[10px] text-zinc-500">
            <div className="bg-zinc-900/60 border border-zinc-850 px-3 py-1.5 rounded-xl">
              <span className="text-zinc-400 font-semibold block uppercase">Câmera Principal</span>
              <span className="text-emerald-400 font-bold text-xs">CAMERA // ONLINE</span>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-850 px-3 py-1.5 rounded-xl">
              <span className="text-zinc-400 font-semibold block uppercase">Dossies Registrados</span>
              <span className="text-cyan-400 font-bold text-xs">
                {hydrated ? `${animals.length} Registros` : 'Lendo DB...'}
              </span>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-850 px-3 py-1.5 rounded-xl">
              <span className="text-zinc-400 font-semibold block uppercase">Alerta Movimento</span>
              <span className="text-zinc-300 font-bold text-xs flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 inline-block animate-pulse"></span>
                MONITOR_ACTIVE
              </span>
            </div>
          </div>
        </header>

        {/* Section 1: Real-Time Stream Telemetry */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="font-mono text-xs font-semibold tracking-wider text-zinc-400 uppercase">
              {"// CANAL DE VÍDEO & TELEMETRIA DOS SENSORES // VIDEO STREAM & TELEMETRY"}
            </h2>
            <div className="flex-1 h-px bg-zinc-800"></div>
          </div>

          <CameraMonitor onCapture={handleCapture} />
        </section>

        {/* Section: Histórico de Telemetria Ambiental */}
        <section className="space-y-4">
          <SensorChart />
        </section>

        {/* Section 2: Catalog Database of Detections */}
        <section className="space-y-4 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-mono text-xs font-semibold tracking-wider text-zinc-400 uppercase">
              {"// HISTÓRICO DE CAPTURAS REGISTRADAS // DETECTION LOG DATABASE"}
            </h2>
            <div className="flex-1 h-px bg-zinc-800"></div>
          </div>

          {hydrated ? (
            <Catalog
              animals={animals}
              onDelete={handleDeleteAnimal}
            />
          ) : (
            <div className="panel-glass rounded-2xl p-12 text-center border border-zinc-800 flex items-center justify-center">
              <svg className="animate-spin h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="font-mono text-xs text-zinc-400 ml-3">CONECTANDO HISTÓRICO...</span>
            </div>
          )}
        </section>

        {/* Scan Entry Overlay Modal */}
        <ScanModal
          isOpen={isScanOpen}
          imageUrl={capturedImageUrl}
          defaultLocation={scanLocation}
          temperature={tempAtCapture}
          humidity={humidAtCapture}
          onSave={handleSaveAnimal}
          onClose={() => setIsScanOpen(false)}
        />

        {/* Footer */}
        <footer className="mt-8 border-t border-zinc-900 pt-6 pb-8 text-center font-mono text-[9px] text-zinc-650 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 WILDLENS CONSOLE. PROTOCOLO DE TRANSMISSÃO EM TEMPO REAL.</p>
          <p className="text-zinc-600">SISTEMA INTEGRADO DE TELEMETRIA DHT11 / WEBCAM SENSOR</p>
        </footer>

      </div>
    </div>
  );
}
