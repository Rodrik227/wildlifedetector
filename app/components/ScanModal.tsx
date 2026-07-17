'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect } from 'react';
import { CatalogedAnimal } from '../types';

interface ScanModalProps {
  isOpen: boolean;
  imageUrl: string;
  defaultLocation: string;
  temperature: number;
  humidity: number;
  onSave: (animal: Omit<CatalogedAnimal, 'id' | 'timestamp'>) => void;
  onClose: () => void;
}

export default function ScanModal({
  isOpen,
  imageUrl,
  defaultLocation,
  temperature,
  humidity,
  onSave,
  onClose,
}: ScanModalProps) {
  const [name, setName] = useState('');
  const [scientificName, setScientificName] = useState('');
  const [category, setCategory] = useState<CatalogedAnimal['category']>('mammal');
  const [location, setLocation] = useState(defaultLocation);
  const [notes, setNotes] = useState('');
  const [isScanning, setIsScanning] = useState(true);

  // Auto-populate when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setScientificName('');
      setLocation(defaultLocation);
      setNotes('');
      setIsScanning(true);

      // Simulate AI Scanning progress
      const timer = setTimeout(() => {
        setIsScanning(false);
      }, 1200);

      return () => clearTimeout(timer);
    }
  }, [isOpen, defaultLocation]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      name: name.trim(),
      scientificName: scientificName.trim() || undefined,
      category,
      location: location.trim(),
      notes: notes.trim(),
      imageUrl,
      temperature,
      humidity,
      detectionType: 'manual', // Manual because they used the modal form
    });
  };

  const handleSuggestionClick = (sName: string, sSci: string, cat: CatalogedAnimal['category']) => {
    setName(sName);
    setScientificName(sSci);
    setCategory(cat);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
      <div 
        className="w-full max-w-4xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/95 text-zinc-100 shadow-2xl animate-fade-in panel-glass"
        id="scan-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <h2 className="font-mono text-sm font-semibold tracking-wider text-emerald-400 uppercase">
              Registro de Espécime / Manual Capture Registry
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 transition-colors focus:outline-none"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12">
          {/* Left Column: Image & Telemetry Data */}
          <div className="relative flex flex-col items-center justify-center bg-zinc-950 p-6 md:col-span-5 border-r border-zinc-800 min-h-[300px]">
            {/* Captured Frame */}
            <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Captured animal frame"
                className="w-full h-full object-cover"
              />
              
              <div className="absolute inset-0 pointer-events-none grid-overlay-emerald"></div>
              <div className="absolute top-2 left-2 font-mono text-[9px] text-emerald-400/80 bg-zinc-900/60 px-1.5 py-0.5 rounded border border-zinc-850">
                FRAME_CAPTURE // RAW_DATA
              </div>

              {/* Scanning Laser Line */}
              {isScanning && (
                <div className="absolute inset-x-0 h-0.5 bg-emerald-400 shadow-[0_0_12px_#34d399] animate-scanline-fast"></div>
              )}
            </div>

            {/* Ambient Conditions during Capture */}
            <div className="mt-4 w-full bg-zinc-900/50 p-3 rounded-lg border border-zinc-850 space-y-2 font-mono text-[10px]">
              <span className="text-zinc-500 uppercase tracking-widest block border-b border-zinc-800 pb-1 mb-1">Telemetria de Captura</span>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">TEMPERATURA AR:</span>
                <span className="text-cyan-400 font-bold text-[11px]">{temperature.toFixed(1)} °C</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">UMIDADE AMBIENTE:</span>
                <span className="text-cyan-400 font-bold text-[11px]">{humidity.toFixed(1)} %</span>
              </div>
            </div>

            {/* Analysis Status */}
            <div className="mt-4 w-full font-mono text-xs text-center">
              {isScanning ? (
                <div className="flex items-center justify-center gap-2 text-emerald-400">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>ANALISANDO ASSINATURA...</span>
                </div>
              ) : (
                <div className="text-emerald-400 bg-emerald-950/30 border border-emerald-800/40 rounded py-1 px-3">
                  ✓ ASSINATURA DE IMAGEM PRONTA
                </div>
              )}
            </div>
            
            {/* Quick Suggestions */}
            {!isScanning && (
              <div className="mt-4 w-full">
                <span className="block font-mono text-[9px] text-zinc-500 mb-2 uppercase">Sugestões Rápidas:</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSuggestionClick('Cão Doméstico', 'Canis lupus familiaris', 'mammal')}
                    className="text-[10px] bg-zinc-800/80 hover:bg-emerald-500/20 hover:text-emerald-400 border border-zinc-700/80 rounded px-2 py-0.5 transition-colors font-mono"
                  >
                    Cão
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSuggestionClick('Gato Doméstico', 'Felis catus', 'mammal')}
                    className="text-[10px] bg-zinc-800/80 hover:bg-emerald-500/20 hover:text-emerald-400 border border-zinc-700/80 rounded px-2 py-0.5 transition-colors font-mono"
                  >
                    Gato
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSuggestionClick('Pássaro Silvestre', 'Aves', 'bird')}
                    className="text-[10px] bg-zinc-800/80 hover:bg-emerald-500/20 hover:text-emerald-400 border border-zinc-700/80 rounded px-2 py-0.5 transition-colors font-mono"
                  >
                    Ave
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSuggestionClick('Lagarto', 'Lacertilia', 'reptile')}
                    className="text-[10px] bg-zinc-800/80 hover:bg-emerald-500/20 hover:text-emerald-400 border border-zinc-700/80 rounded px-2 py-0.5 transition-colors font-mono"
                  >
                    Lagarto
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSuggestionClick('Inseto Indeterminado', 'Insecta', 'insect')}
                    className="text-[10px] bg-zinc-800/80 hover:bg-emerald-500/20 hover:text-emerald-400 border border-zinc-700/80 rounded px-2 py-0.5 transition-colors font-mono"
                  >
                    Inseto
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Form */}
          <form onSubmit={handleSubmit} className="p-6 md:col-span-7 flex flex-col justify-between">
            <div className="space-y-4">
              {/* Animal Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 font-mono">
                  Nome do Animal / Animal Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Gato Doméstico, Pombo, Lagartixa"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Scientific Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 font-mono">
                  Nome Científico / Scientific Name
                </label>
                <input
                  type="text"
                  value={scientificName}
                  onChange={(e) => setScientificName(e.target.value)}
                  placeholder="Ex: Felis catus"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors italic"
                />
              </div>

              {/* Category & Location Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Category */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 font-mono">
                    Categoria / Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as CatalogedAnimal['category'])}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors font-mono text-xs"
                  >
                    <option value="mammal">Mamífero / Mammal</option>
                    <option value="bird">Ave / Bird</option>
                    <option value="reptile">Réptil / Reptile</option>
                    <option value="amphibian">Anfíbio / Amphibian</option>
                    <option value="fish">Peixe / Fish</option>
                    <option value="insect">Inseto / Insect</option>
                    <option value="other">Outro / Other</option>
                  </select>
                </div>

                {/* Location */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 font-mono">
                    Identificador do Sensor
                  </label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 font-mono">
                  Notas de Observação / Field Notes
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Escreva notas de campo sobre o animal registrado..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors resize-none font-sans"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-3 mt-6 border-t border-zinc-800/80 pt-4 font-mono">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 bg-transparent border border-zinc-850 rounded-lg hover:bg-zinc-800 transition-all"
              >
                DESCARTAR
              </button>
              <button
                type="submit"
                disabled={!name.trim() || isScanning}
                className={`px-5 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all ${
                  !name.trim() || isScanning
                    ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed border border-zinc-800'
                    : 'bg-emerald-500 text-zinc-950 border-emerald-400 hover:bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                }`}
              >
                REGISTRAR NO CATÁLOGO
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
