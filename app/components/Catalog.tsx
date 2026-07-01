'use client';

import React, { useState } from 'react';
import { CatalogedAnimal, AnimalCategory } from '../types';

interface CatalogProps {
  animals: CatalogedAnimal[];
  onDelete: (id: string) => void;
}

export default function Catalog({ animals, onDelete }: CatalogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedAnimal, setSelectedAnimal] = useState<CatalogedAnimal | null>(null);

  // Category tags mappings for UI
  const categoryMeta: Record<AnimalCategory, { label: string; class: string }> = {
    mammal: { label: 'Mamífero', class: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
    bird: { label: 'Ave', class: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' },
    reptile: { label: 'Réptil', class: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
    amphibian: { label: 'Anfíbio', class: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' },
    fish: { label: 'Peixe', class: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
    insect: { label: 'Inseto', class: 'bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20' },
    other: { label: 'Outro', class: 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20' },
  };

  const categories: { value: string; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'mammal', label: 'Mamíferos' },
    { value: 'bird', label: 'Aves' },
    { value: 'reptile', label: 'Répteis' },
    { value: 'amphibian', label: 'Anfíbios' },
    { value: 'fish', label: 'Peixes' },
    { value: 'insect', label: 'Insetos' },
    { value: 'other', label: 'Outros' },
  ];

  // Filter animals based on search query and category
  const filteredAnimals = animals.filter((animal) => {
    const matchesSearch =
      animal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (animal.scientificName && animal.scientificName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      animal.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      animal.notes.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'all' || animal.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Filters Toolbar */}
      <div className="panel-glass rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-zinc-800">

        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar registro por nome, local ou notas..."
            className="w-full bg-zinc-950 border border-zinc-850 rounded-xl pl-9 pr-4 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/80 transition-colors font-sans"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-300"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-thin">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex-shrink-0 border uppercase tracking-wider ${selectedCategory === cat.value
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40 font-semibold shadow-[0_0_8px_rgba(16,185,129,0.1)]'
                  : 'bg-zinc-900/40 text-zinc-400 border-zinc-850 hover:border-zinc-700 hover:text-zinc-200'
                }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog Grid */}
      {filteredAnimals.length === 0 ? (
        <div className="panel-glass rounded-2xl p-12 text-center border border-zinc-800 flex flex-col items-center justify-center min-h-[250px]">
          <svg className="w-12 h-12 text-zinc-600 mb-3 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h4 className="font-mono text-xs font-semibold text-zinc-400 uppercase tracking-widest">
            Sem Espécimes Registrados / No Catalog Entries
          </h4>
          <p className="text-xs text-zinc-500 mt-2 max-w-sm">
            {searchQuery || selectedCategory !== 'all'
              ? 'Tente ajustar os filtros de busca ou categoria para encontrar os registros.'
              : 'Detecção de movimento ativa. Movimente-se em frente à câmera para acionar a captura automática de fauna.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredAnimals.map((animal) => {
            const meta = categoryMeta[animal.category] || categoryMeta.other;
            const isAuto = animal.detectionType === 'automatic';

            return (
              <div
                key={animal.id}
                className="group relative flex flex-col rounded-2xl overflow-hidden border border-zinc-850 bg-zinc-900/40 hover:bg-zinc-900/70 hover:border-zinc-700 transition-all duration-300 hover:shadow-xl hover:scale-[1.01]"
              >
                {/* Photo Header */}
                <div className="relative aspect-video overflow-hidden bg-zinc-950 border-b border-zinc-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={animal.imageUrl}
                    alt={animal.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/90 via-transparent to-transparent"></div>

                  {/* Category Badge */}
                  <span className={`absolute top-3 left-3 px-2 py-0.5 rounded text-[8px] font-bold font-mono uppercase tracking-wider ${meta.class}`}>
                    {meta.label}
                  </span>

                  {/* Detection Mode Badge */}
                  <span className={`absolute top-3 right-3 px-2 py-0.5 rounded text-[8px] font-bold font-mono uppercase tracking-wider ${isAuto
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      : 'bg-zinc-800/80 text-zinc-300 border border-zinc-700'
                    }`}>
                    {isAuto ? 'AUTO // MVM' : 'MANUAL'}
                  </span>

                  {/* Sensor telemetries overlay */}
                  <div className="absolute bottom-2 right-3 font-mono text-[9px] text-cyan-400 bg-black/60 px-1.5 py-0.5 rounded flex gap-2 border border-zinc-800">
                    <span>{animal.temperature !== undefined && animal.temperature !== null ? animal.temperature.toFixed(1) : '--'}°C</span>
                    <span>{animal.humidity !== undefined && animal.humidity !== null ? animal.humidity.toFixed(1) : '--'}% HR</span>
                  </div>

                  {/* Date Badge */}
                  <span className="absolute bottom-2 left-3 text-[9px] font-mono text-zinc-400">
                    {formatDate(animal.timestamp).split(',')[0]}
                  </span>
                </div>

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="font-sans text-sm font-semibold text-zinc-100 tracking-tight group-hover:text-emerald-400 transition-colors truncate">
                      {animal.name}
                    </h3>
                    {animal.scientificName && (
                      <p className="font-sans text-[10px] text-zinc-400 italic mt-0.5 truncate">
                        {animal.scientificName}
                      </p>
                    )}
                    <div className="flex items-center gap-1 mt-2 text-[10px] font-mono text-zinc-500">
                      <svg className="w-3.5 h-3.5 flex-shrink-0 text-zinc-650" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="truncate">{animal.location}</span>
                    </div>
                  </div>

                  {animal.notes && (
                    <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed bg-zinc-950/30 p-2 rounded border border-zinc-850/50">
                      {animal.notes}
                    </p>
                  )}

                  {/* Actions bar */}
                  <div className="flex items-center justify-between border-t border-zinc-850/60 pt-3">
                    <button
                      onClick={() => setSelectedAnimal(animal)}
                      className="text-xs font-mono text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 transition-colors focus:outline-none"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      VER RELATÓRIO
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Excluir permanentemente o registro de "${animal.name}"?`)) {
                          onDelete(animal.id);
                        }
                      }}
                      className="text-xs font-mono text-rose-400/80 hover:text-rose-400 flex items-center gap-1 transition-colors focus:outline-none"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      DELETAR
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Specimen Detail Modal / Dossier */}
      {selectedAnimal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-100 shadow-2xl animate-fade-in panel-glass">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950/50 px-6 py-4">
              <span className="font-mono text-xs text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse"></span>
                Dossiê de Espécime / Report ID: #{selectedAnimal.id.replace('specimen-', '').substring(0, 8)}
              </span>
              <button
                onClick={() => setSelectedAnimal(null)}
                className="text-zinc-400 hover:text-zinc-200 transition-colors focus:outline-none"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Main Photo Banner */}
              <div className="relative aspect-video rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedAnimal.imageUrl}
                  alt={selectedAnimal.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 pointer-events-none grid-overlay-emerald opacity-10"></div>

                {/* Bounding box mock in detail to make it look cool if it was automatic */}
                {selectedAnimal.detectionType === 'automatic' && (
                  <div className="absolute border border-dashed border-rose-500 w-1/3 h-1/3 left-1/3 top-1/3 pointer-events-none">
                    <span className="absolute -top-4 left-0 text-[8px] bg-rose-600 text-white font-mono px-1 rounded uppercase">DETECTOR_BOUNDS</span>
                  </div>
                )}
              </div>

              {/* Grid Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-zinc-950/60 p-4 rounded-xl border border-zinc-850/50 space-y-2">
                  <h4 className="font-mono text-[9px] text-zinc-500 uppercase tracking-wider">Identificação</h4>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-zinc-100">{selectedAnimal.name}</p>
                    {selectedAnimal.scientificName && (
                      <p className="text-xs text-zinc-400 italic">{selectedAnimal.scientificName}</p>
                    )}
                  </div>
                </div>

                <div className="bg-zinc-950/60 p-4 rounded-xl border border-zinc-850/50 space-y-2">
                  <h4 className="font-mono text-[9px] text-zinc-500 uppercase tracking-wider">Classificação</h4>
                  <div className="flex gap-2">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase tracking-wider ${categoryMeta[selectedAnimal.category]?.class || categoryMeta.other.class
                      }`}>
                      {categoryMeta[selectedAnimal.category]?.label || 'Outro'}
                    </span>
                    <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase tracking-wider ${selectedAnimal.detectionType === 'automatic'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                      }`}>
                      {selectedAnimal.detectionType === 'automatic' ? 'AUTOCAPTURA // MVM' : 'MANUAL'}
                    </span>
                  </div>
                </div>

                {/* Telemetria do sensor */}
                <div className="bg-zinc-950/60 p-4 rounded-xl border border-zinc-850/50 space-y-2 col-span-1 sm:col-span-2 grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-mono text-[9px] text-zinc-500 uppercase tracking-wider mb-1">Temperatura Sensor</h4>
                    <p className="text-sm font-mono text-cyan-400 font-bold">{selectedAnimal.temperature !== undefined && selectedAnimal.temperature !== null ? selectedAnimal.temperature.toFixed(1) : '--'} °C</p>
                  </div>
                  <div>
                    <h4 className="font-mono text-[9px] text-zinc-500 uppercase tracking-wider mb-1">Umidade Relativa</h4>
                    <p className="text-sm font-mono text-cyan-400 font-bold">{selectedAnimal.humidity !== undefined && selectedAnimal.humidity !== null ? selectedAnimal.humidity.toFixed(1) : '--'} %</p>
                  </div>
                </div>

                <div className="bg-zinc-950/60 p-4 rounded-xl border border-zinc-850/50 space-y-2">
                  <h4 className="font-mono text-[9px] text-zinc-500 uppercase tracking-wider">Horário do Registro</h4>
                  <p className="text-xs text-zinc-300 font-mono flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {formatDate(selectedAnimal.timestamp)}
                  </p>
                </div>

                <div className="bg-zinc-950/60 p-4 rounded-xl border border-zinc-850/50 space-y-2">
                  <h4 className="font-mono text-[9px] text-zinc-500 uppercase tracking-wider">Identificador Sensor</h4>
                  <p className="text-xs text-zinc-300 font-mono flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    {selectedAnimal.location}
                  </p>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <h4 className="font-mono text-[9px] text-zinc-500 uppercase tracking-wider font-bold">Resumo / Notas de Observação</h4>
                <p className="text-xs text-zinc-300 bg-zinc-950/40 p-4 rounded-xl border border-zinc-850 leading-relaxed min-h-[60px] whitespace-pre-wrap">
                  {selectedAnimal.notes || 'Nenhuma nota de campo adicionada.'}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end border-t border-zinc-800 px-6 py-4 bg-zinc-950/50">
              <button
                onClick={() => setSelectedAnimal(null)}
                className="px-5 py-2 text-xs font-mono font-semibold text-zinc-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg hover:shadow-[0_0_12px_rgba(6,182,212,0.3)] transition-all uppercase"
              >
                FECHAR DOSSIÊ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
