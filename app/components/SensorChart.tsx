'use client';

import React, { useState, useEffect, useRef } from 'react';

interface HistoryPoint {
  timestamp: number;
  temperature: number;
  humidity: number;
}

export default function SensorChart() {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'temp' | 'humid' | 'both'>('both');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/sensors/history');
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Error fetching sensor history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchHistory();
    // Poll a cada 30 segundos por novos logs de histórico
    const interval = setInterval(fetchHistory, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="panel-glass rounded-2xl p-12 text-center border border-zinc-800 flex items-center justify-center min-h-[300px]">
        <svg className="animate-spin h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="font-mono text-xs text-zinc-400 ml-3">CONECTANDO AO HISTÓRICO DE SENSORES...</span>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="panel-glass rounded-2xl p-12 text-center border border-zinc-800 min-h-[300px] flex items-center justify-center">
        <span className="font-mono text-xs text-zinc-500">NENHUM DADO HISTÓRICO ENCONTRADO</span>
      </div>
    );
  }

  // Configurações de dimensão interna do SVG
  const width = 800;
  const height = 280;
  const paddingLeft = 50;
  const paddingRight = 50;
  const paddingTop = 30;
  const paddingBottom = 40;

  // Extrair valores para cálculo de escala
  const temps = history.map(d => d.temperature);
  const humids = history.map(d => d.humidity);

  const minTemp = Math.min(...temps) - 1;
  const maxTemp = Math.max(...temps) + 1;
  const minHumid = Math.min(...humids) - 5;
  const maxHumid = Math.max(...humids) + 5;

  const tempRange = maxTemp - minTemp || 2;
  const humidRange = maxHumid - minHumid || 10;

  // Funções de escala
  const getX = (index: number) => {
    return paddingLeft + (index / (history.length - 1)) * (width - paddingLeft - paddingRight);
  };

  const getTempY = (temp: number) => {
    return height - paddingBottom - ((temp - minTemp) / tempRange) * (height - paddingTop - paddingBottom);
  };

  const getHumidY = (humid: number) => {
    return height - paddingBottom - ((humid - minHumid) / humidRange) * (height - paddingTop - paddingBottom);
  };

  // Gerar caminhos de linhas e áreas
  let tempPath = '';
  let tempAreaPath = '';
  let humidPath = '';
  let humidAreaPath = '';

  if (history.length > 0) {
    // Temperatura
    const firstTempX = getX(0);
    const firstTempY = getTempY(temps[0]);
    tempPath = `M ${firstTempX} ${firstTempY}`;
    tempAreaPath = `M ${firstTempX} ${height - paddingBottom} L ${firstTempX} ${firstTempY}`;

    for (let i = 1; i < history.length; i++) {
      const x = getX(i);
      const y = getTempY(temps[i]);
      tempPath += ` L ${x} ${y}`;
      tempAreaPath += ` L ${x} ${y}`;
    }
    tempAreaPath += ` L ${getX(history.length - 1)} ${height - paddingBottom} Z`;

    // Umidade
    const firstHumidX = getX(0);
    const firstHumidY = getHumidY(humids[0]);
    humidPath = `M ${firstHumidX} ${firstHumidY}`;
    humidAreaPath = `M ${firstHumidX} ${height - paddingBottom} L ${firstHumidX} ${firstHumidY}`;

    for (let i = 1; i < history.length; i++) {
      const x = getX(i);
      const y = getHumidY(humids[i]);
      humidPath += ` L ${x} ${y}`;
      humidAreaPath += ` L ${x} ${y}`;
    }
    humidAreaPath += ` L ${getX(history.length - 1)} ${height - paddingBottom} Z`;
  }

  // Handler de movimento do mouse sobre o gráfico
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * width;
    
    let closestIndex = 0;
    let closestDistance = Infinity;

    for (let i = 0; i < history.length; i++) {
      const ptX = getX(i);
      const dist = Math.abs(ptX - mouseX);
      if (dist < closestDistance) {
        closestDistance = dist;
        closestIndex = i;
      }
    }

    setHoverIndex(closestIndex);

    if (containerRef.current) {
      const ptXReal = (getX(closestIndex) / width) * rect.width;
      
      let activeYVal = 0;
      if (activeTab === 'temp') activeYVal = getTempY(temps[closestIndex]);
      else if (activeTab === 'humid') activeYVal = getHumidY(humids[closestIndex]);
      else activeYVal = (getTempY(temps[closestIndex]) + getHumidY(humids[closestIndex])) / 2;

      const ptYReal = (activeYVal / height) * rect.height;

      setTooltipPos({
        x: ptXReal,
        y: ptYReal - 10
      });
    }
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatFullDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${d.toLocaleDateString([], { day: '2-digit', month: '2-digit' })} às ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  // Índices para desenhar as linhas de grade verticais (cerca de 6 a 8 divisões)
  const gridLineIndices = [];
  const step = Math.max(1, Math.floor(history.length / 6));
  for (let i = 0; i < history.length; i += step) {
    gridLineIndices.push(i);
  }
  if (gridLineIndices[gridLineIndices.length - 1] !== history.length - 1) {
    gridLineIndices.push(history.length - 1);
  }

  const activePoint = hoverIndex !== null ? history[hoverIndex] : null;

  return (
    <div ref={containerRef} className="panel-glass rounded-2xl p-5 border border-zinc-800 flex flex-col relative w-full gap-5 shadow-2xl">
      
      {/* Header e Controles */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <h3 className="font-mono text-xs font-semibold tracking-wider text-zinc-300 uppercase">
              {"// TELEMETRIA HISTÓRICA AMBIENTAL // ENVIRONMENTAL LOG"}
            </h3>
          </div>
          <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
            Logs ambientais consolidados a cada 30 minutos
          </p>
        </div>

        {/* Filtros */}
        <div className="flex items-center bg-zinc-900/60 p-1 rounded-xl border border-zinc-850 select-none">
          <button
            onClick={() => { setActiveTab('temp'); setHoverIndex(null); }}
            className={`px-3 py-1.5 rounded-lg font-mono text-[9px] font-bold tracking-wider uppercase transition-all duration-200 cursor-pointer ${
              activeTab === 'temp'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
            }`}
          >
            Temperatura
          </button>
          <button
            onClick={() => { setActiveTab('humid'); setHoverIndex(null); }}
            className={`px-3 py-1.5 rounded-lg font-mono text-[9px] font-bold tracking-wider uppercase transition-all duration-200 cursor-pointer ${
              activeTab === 'humid'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_8px_rgba(6,182,212,0.15)]'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
            }`}
          >
            Umidade
          </button>
          <button
            onClick={() => { setActiveTab('both'); setHoverIndex(null); }}
            className={`px-3 py-1.5 rounded-lg font-mono text-[9px] font-bold tracking-wider uppercase transition-all duration-200 cursor-pointer ${
              activeTab === 'both'
                ? 'bg-zinc-850 text-zinc-200 border border-zinc-800 shadow-md'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
            }`}
          >
            Ambos
          </button>
        </div>
      </div>

      {/* Visão de Máximas/Mínimas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-[10px] text-zinc-500">
        <div className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-850/80">
          <span className="text-zinc-500 block uppercase text-[8px] tracking-widest">Temp. Mínima</span>
          <span className="text-emerald-400 font-bold text-xs">{(Math.min(...temps)).toFixed(1)}°C</span>
        </div>
        <div className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-850/80">
          <span className="text-zinc-500 block uppercase text-[8px] tracking-widest">Temp. Máxima</span>
          <span className="text-emerald-400 font-bold text-xs">{(Math.max(...temps)).toFixed(1)}°C</span>
        </div>
        <div className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-850/80">
          <span className="text-zinc-500 block uppercase text-[8px] tracking-widest">Umidade Mínima</span>
          <span className="text-cyan-400 font-bold text-xs">{(Math.min(...humids)).toFixed(1)}%</span>
        </div>
        <div className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-850/80">
          <span className="text-zinc-500 block uppercase text-[8px] tracking-widest">Umidade Máxima</span>
          <span className="text-cyan-400 font-bold text-xs">{(Math.max(...humids)).toFixed(1)}%</span>
        </div>
      </div>

      {/* Gráfico Area */}
      <div className="relative flex-1 bg-zinc-950/40 border border-zinc-850 rounded-xl overflow-hidden min-h-[280px]">
        {/* SVG Filters & Gradients */}
        <svg className="absolute w-0 h-0">
          <defs>
            <filter id="glow-temp" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-humid" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="grad-temp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="grad-humid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
            </linearGradient>
          </defs>
        </svg>

        {/* Gráfico SVG */}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full select-none cursor-crosshair overflow-visible p-2"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Linhas de Grade Horizontais */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
            const y = paddingTop + ratio * (height - paddingTop - paddingBottom);
            return (
              <line
                key={`grid-h-${index}`}
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="#18181b"
                strokeWidth="1"
                strokeDasharray="4,4"
              />
            );
          })}

          {/* Linhas de Grade Verticais e Horários */}
          {gridLineIndices.map((idx, index) => {
            const x = getX(idx);
            return (
              <g key={`grid-v-${index}`}>
                <line
                  x1={x}
                  y1={paddingTop}
                  x2={x}
                  y2={height - paddingBottom}
                  stroke="#18181b"
                  strokeWidth="1"
                  strokeDasharray="4,4"
                />
                <text
                  x={x}
                  y={height - paddingBottom + 18}
                  fill="#52525b"
                  fontSize="8"
                  fontFamily="monospace"
                  textAnchor="middle"
                  className="opacity-90"
                >
                  {formatDate(history[idx].timestamp)}
                </text>
              </g>
            );
          })}

          {/* Eixo Temperatura (Esquerda) */}
          {(activeTab === 'temp' || activeTab === 'both') && (
            <g>
              <text x={paddingLeft - 10} y={paddingTop + 3} fill="#10b981" fontSize="8" fontFamily="monospace" textAnchor="end" fontWeight="bold">
                {maxTemp.toFixed(1)}°C
              </text>
              <text x={paddingLeft - 10} y={(paddingTop + height - paddingBottom) / 2 + 3} fill="#10b981" fontSize="8" fontFamily="monospace" textAnchor="end">
                {((maxTemp + minTemp) / 2).toFixed(1)}°C
              </text>
              <text x={paddingLeft - 10} y={height - paddingBottom + 3} fill="#10b981" fontSize="8" fontFamily="monospace" textAnchor="end" fontWeight="bold">
                {minTemp.toFixed(1)}°C
              </text>
            </g>
          )}

          {/* Eixo Umidade (Direita) */}
          {(activeTab === 'humid' || activeTab === 'both') && (
            <g>
              <text x={width - paddingRight + 10} y={paddingTop + 3} fill="#06b6d4" fontSize="8" fontFamily="monospace" textAnchor="start" fontWeight="bold">
                {maxHumid.toFixed(0)}%
              </text>
              <text x={width - paddingRight + 10} y={(paddingTop + height - paddingBottom) / 2 + 3} fill="#06b6d4" fontSize="8" fontFamily="monospace" textAnchor="start">
                {((maxHumid + minHumid) / 2).toFixed(0)}%
              </text>
              <text x={width - paddingRight + 10} y={height - paddingBottom + 3} fill="#06b6d4" fontSize="8" fontFamily="monospace" textAnchor="start" fontWeight="bold">
                {minHumid.toFixed(0)}%
              </text>
            </g>
          )}

          {/* Preenchimento de Área Gradiente */}
          {(activeTab === 'temp' || activeTab === 'both') && (
            <path d={tempAreaPath} fill="url(#grad-temp)" />
          )}
          {(activeTab === 'humid' || activeTab === 'both') && (
            <path d={humidAreaPath} fill="url(#grad-humid)" />
          )}

          {/* Desenho das Linhas do Gráfico */}
          {(activeTab === 'temp' || activeTab === 'both') && (
            <path
              d={tempPath}
              fill="none"
              stroke="#10b981"
              strokeWidth="1.5"
              filter="url(#glow-temp)"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {(activeTab === 'humid' || activeTab === 'both') && (
            <path
              d={humidPath}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="1.5"
              filter="url(#glow-humid)"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Linha de Cursor Vertical e Pontos na Posição Hover */}
          {hoverIndex !== null && (
            <g>
              {/* Cursor Vertical */}
              <line
                x1={getX(hoverIndex)}
                y1={paddingTop}
                x2={getX(hoverIndex)}
                y2={height - paddingBottom}
                stroke="#3f3f46"
                strokeWidth="1"
                strokeDasharray="3,3"
              />

              {/* Ponto Hover de Temperatura */}
              {(activeTab === 'temp' || activeTab === 'both') && (
                <g>
                  <circle
                    cx={getX(hoverIndex)}
                    cy={getTempY(temps[hoverIndex])}
                    r="5.5"
                    fill="#10b981"
                    fillOpacity="0.2"
                  />
                  <circle
                    cx={getX(hoverIndex)}
                    cy={getTempY(temps[hoverIndex])}
                    r="3.5"
                    fill="#10b981"
                    stroke="#09090b"
                    strokeWidth="1.5"
                  />
                </g>
              )}

              {/* Ponto Hover de Umidade */}
              {(activeTab === 'humid' || activeTab === 'both') && (
                <g>
                  <circle
                    cx={getX(hoverIndex)}
                    cy={getHumidY(humids[hoverIndex])}
                    r="5.5"
                    fill="#06b6d4"
                    fillOpacity="0.2"
                  />
                  <circle
                    cx={getX(hoverIndex)}
                    cy={getHumidY(humids[hoverIndex])}
                    r="3.5"
                    fill="#06b6d4"
                    stroke="#09090b"
                    strokeWidth="1.5"
                  />
                </g>
              )}
            </g>
          )}
        </svg>

        {/* Tooltip Absoluto Flutuante */}
        {hoverIndex !== null && activePoint && (
          <div
            style={{
              left: `${tooltipPos.x}px`,
              top: `${tooltipPos.y}px`,
            }}
            className="absolute z-30 pointer-events-none -translate-x-1/2 -translate-y-[110%] bg-zinc-950/95 text-zinc-200 border border-zinc-800 rounded-xl px-3 py-2 font-mono text-[9px] shadow-2xl backdrop-blur-md space-y-1.5 min-w-[145px]"
          >
            <div className="text-zinc-500 font-bold border-b border-zinc-900 pb-1 mb-1 tracking-wider uppercase text-[8px]">
              {formatFullDate(activePoint.timestamp)}
            </div>
            {(activeTab === 'temp' || activeTab === 'both') && (
              <div className="flex justify-between items-center gap-3">
                <span className="text-emerald-400">TEMPERATURA:</span>
                <span className="font-bold text-zinc-100">{activePoint.temperature.toFixed(1)}°C</span>
              </div>
            )}
            {(activeTab === 'humid' || activeTab === 'both') && (
              <div className="flex justify-between items-center gap-3">
                <span className="text-cyan-400">UMIDADE:</span>
                <span className="font-bold text-zinc-100">{activePoint.humidity.toFixed(1)}%</span>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
