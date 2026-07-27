import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ScanResult, StrategyParams } from '../types';
import { loadGlobalSettings } from '../utils/settings';
import { hasParamGroup } from '../utils/strategyParams';
import { Search, Flame, TrendingUp, TrendingDown, AlertCircle, Cpu, Play, RefreshCw, X, FolderCheck, HardDrive, Plus, Trash2, Timer } from 'lucide-react';

interface ScannerTabProps {
  sharedSymbols: string[];
  onSharedSymbolsChange: (symbols: string[]) => void;
  onQuickTrade: (symbol: string, side: 'BUY' | 'SELL', price: number, sl: number, tp: number) => void;
  onApplyParamsToBacktest: (symbol: string, params: StrategyParams) => void;
  appliedParams: {
    strategy: string;
    rsi_period: number;
    rsi_oversold: number;
    rsi_overbought: number;
    volume_ratio: number;
  } | null;
  onClearAppliedParams: () => void;
  ollamaAvailable: boolean;
  ollamaModels: string[];
}

export const ScannerTab: React.FC<ScannerTabProps> = ({
  sharedSymbols,
  onSharedSymbolsChange,
  onQuickTrade,
  onApplyParamsToBacktest,
  appliedParams,
  onClearAppliedParams,
  ollamaAvailable,
  ollamaModels,
}) => {
  const globalDefaults = loadGlobalSettings();

  const selectedSymbols = sharedSymbols;
  const setSelectedSymbols = onSharedSymbolsChange;
  const defaultList = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT', 'XRPUSDT', 'ADAUSDT'];
  const [customSymbol, setCustomSymbol] = useState('');
  const [timeframe, setTimeframe] = useState('15m');
  const [rsiPeriod, setRsiPeriod] = useState(14);
  const [rsiLow, setRsiLow] = useState(30);
  const [rsiHigh, setRsiHigh] = useState(70);
  const [volRatio, setVolRatio] = useState(2.0);
  const [donchianPeriod, setDonchianPeriod] = useState(20);
  const [cmfPeriod, setCmfPeriod] = useState(20);
  const [cmfThreshold, setCmfThreshold] = useState(0.05);
  const [vwapDeviationPct, setVwapDeviationPct] = useState(0.3);
  const [chopThreshold, setChopThreshold] = useState(61.0);

  // Supertrend params
  const [supertrendPeriod, setSupertrendPeriod] = useState(10);
  const [supertrendMultiplier, setSupertrendMultiplier] = useState(3.0);
  const [stochRsiPeriod, setStochRsiPeriod] = useState(14);

  // Squeeze params
  const [bbPeriod, setBbPeriod] = useState(20);
  const [bbStdDev, setBbStdDev] = useState(2.0);
  const [kcAtrPeriod, setKcAtrPeriod] = useState(10);
  const [kcAtrMult, setKcAtrMult] = useState(2.0);

  // Orderflow params
  const [orderflowLookback, setOrderflowLookback] = useState(20);

  // Funding params
  const [fundingThreshold, setFundingThreshold] = useState(0.0005);

  // Ichimoku params
  const [ichimokuTenkan, setIchimokuTenkan] = useState(9);
  const [ichimokuKijun, setIchimokuKijun] = useState(26);
  const [ichimokuSenkouB, setIchimokuSenkouB] = useState(52);

  // Pivot params
  const [pivotVolPeriod, setPivotVolPeriod] = useState(20);

  const [showAll, setShowAll] = useState(true);
  const [withOllama, setWithOllama] = useState(false);
  const [selectedModel, setSelectedModel] = useState('llama3');
  const [scannerStrategy, setScannerStrategy] = useState<string>('rsi_volume');

  useEffect(() => {
    if (appliedParams) {
      setScannerStrategy(appliedParams.strategy);
      setRsiPeriod(appliedParams.rsi_period);
      setRsiLow(appliedParams.rsi_oversold);
      setRsiHigh(appliedParams.rsi_overbought);
      setVolRatio(appliedParams.volume_ratio);
      onClearAppliedParams();
    }
  }, [appliedParams]);

  // Fonte de Dados Local JSON
  const [useLocalJson, setUseLocalJson] = useState(globalDefaults.use_local_json);
  const [dataDir, setDataDir] = useState(globalDefaults.data_dir || '/home/pablo/datadown/data/monthly');
  const [periodMode, setPeriodMode] = useState<'all' | 'specific' | 'range'>('all');
  const [specificPeriods, setSpecificPeriods] = useState('2021-05,2022-06,2024-10');
  const [startPeriod, setStartPeriod] = useState('2021-01');
  const [endPeriod, setEndPeriod] = useState('2021-12');

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [scanErrors, setScanErrors] = useState<{ symbol: string; error: string }[]>([]);

  // Auto-refresh
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0);
  const [countdown, setCountdown] = useState(0);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const scanFnRef = useRef<() => void>(() => {});

  const runScanWithSymbols = useCallback(async (symbolsToScan: string[]) => {
    setLoading(true);
    try {
      const symsParam = symbolsToScan.join(',');
      let url = `/api/scan?symbols=${symsParam}&timeframe=${timeframe}&strategy=${scannerStrategy}&rsi_period=${rsiPeriod}&rsi_low=${rsiLow}&rsi_high=${rsiHigh}&vol_ratio=${volRatio}&all=${showAll}&with_ollama=${withOllama}&model=${selectedModel}&donchian_period=${donchianPeriod}&cmf_period=${cmfPeriod}&cmf_threshold=${cmfThreshold}&vwap_deviation_pct=${vwapDeviationPct}&chop_threshold=${chopThreshold}&supertrend_period=${supertrendPeriod}&supertrend_multiplier=${supertrendMultiplier}&stoch_rsi_period=${stochRsiPeriod}&bb_period=${bbPeriod}&bb_std_dev=${bbStdDev}&kc_atr_period=${kcAtrPeriod}&kc_atr_mult=${kcAtrMult}&orderflow_lookback=${orderflowLookback}&funding_threshold=${fundingThreshold}&ichimoku_tenkan=${ichimokuTenkan}&ichimoku_kijun=${ichimokuKijun}&ichimoku_senkou_b=${ichimokuSenkouB}&pivot_vol_period=${pivotVolPeriod}`;
      
      if (useLocalJson) {
        url += `&use_local_json=true&data_dir=${encodeURIComponent(dataDir)}`;
        if (periodMode === 'specific' && specificPeriods.trim()) {
          url += `&periods=${encodeURIComponent(specificPeriods)}`;
        } else if (periodMode === 'range') {
          if (startPeriod) url += `&start_period=${startPeriod}`;
          if (endPeriod) url += `&end_period=${endPeriod}`;
        }
      }

      const resp = await fetch(url);
      const data = await resp.json();
      if (data.success) {
        setResults(data.data || []);
        setScanErrors(data.errors || []);
      } else {
        setScanErrors([{ symbol: 'SCANNER', error: data.error || 'Erro desconhecido ao executar scan' }]);
      }
    } catch (error) {
      console.error('Erro ao executar scan:', error);
    } finally {
      setLoading(false);
    }
  }, [timeframe, scannerStrategy, rsiPeriod, rsiLow, rsiHigh, volRatio, showAll, withOllama, selectedModel, useLocalJson, dataDir, periodMode, specificPeriods, startPeriod, endPeriod]);

  const runScan = useCallback(() => {
    runScanWithSymbols(selectedSymbols);
  }, [runScanWithSymbols, selectedSymbols]);

  scanFnRef.current = runScan;

  const stopAutoRefresh = useCallback(() => {
    if (autoRefreshRef.current) {
      clearInterval(autoRefreshRef.current);
      autoRefreshRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setCountdown(0);
  }, []);

  const startAutoRefresh = useCallback((intervalSec: number) => {
    stopAutoRefresh();
    if (intervalSec <= 0) return;
    setCountdown(intervalSec);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) return intervalSec;
        return prev - 1;
      });
    }, 1000);
    autoRefreshRef.current = setInterval(() => {
      scanFnRef.current();
      setCountdown(intervalSec);
    }, intervalSec * 1000);
  }, [stopAutoRefresh]);

  const handleAutoRefreshToggle = (intervalSec: number) => {
    if (intervalSec === autoRefreshInterval) {
      setAutoRefreshInterval(0);
      stopAutoRefresh();
    } else {
      setAutoRefreshInterval(intervalSec);
      startAutoRefresh(intervalSec);
    }
  };

  useEffect(() => {
    return () => stopAutoRefresh();
  }, []);

  const handleToggleSymbol = (sym: string) => {
    let next: string[];
    if (selectedSymbols.includes(sym)) {
      if (selectedSymbols.length <= 1) {
        alert('É necessário manter pelo menos 1 símbolo no scanner.');
        return;
      }
      next = selectedSymbols.filter((s) => s !== sym);
    } else {
      next = [...selectedSymbols, sym];
    }
    setSelectedSymbols(next);
  };

  const handleRemoveSymbol = (sym: string) => {
    if (selectedSymbols.length <= 1) {
      alert('É necessário manter pelo menos 1 símbolo no scanner.');
      return;
    }
    const next = selectedSymbols.filter((s) => s !== sym);
    setSelectedSymbols(next);
  };

  const handleAddCustomSymbol = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customSymbol) return;
    let clean = customSymbol.trim().toUpperCase();
    if (!clean.endsWith('USDT')) {
      clean = clean + 'USDT';
    }
    if (!selectedSymbols.includes(clean)) {
      const next = [...selectedSymbols, clean];
      setSelectedSymbols(next);
    }
    setCustomSymbol('');
  };

  useEffect(() => {
    runScan();
  }, [selectedSymbols]);

  useEffect(() => {
    runScan();
    if (autoRefreshInterval > 0) {
      startAutoRefresh(autoRefreshInterval);
    }
  }, [scannerStrategy]);

  return (
    <div className="space-y-6">
      {/* Configuração de Filtros */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5 shadow-xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-white flex items-center gap-2">
              <Search className="w-4 h-4 text-emerald-400" />
              Scanner Multiassímbolo de Contratos
            </h2>
            <p className="text-[11px] text-slate-400 mt-1 font-sans">
              Varre pares de futuros USDⓈ-M em tempo real ou arquivos JSON históricos locais, calcula RSI, volume spikes e zonas técnicas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {autoRefreshInterval > 0 && (
              <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                <Timer className="w-3 h-3 text-emerald-400 animate-pulse" />
                <span className="text-[10px] font-mono font-bold text-emerald-400">
                  {countdown}s
                </span>
              </div>
            )}
            <div className="flex items-center gap-0.5 bg-black/50 border border-white/10 rounded-lg p-0.5">
              {[
                { label: 'OFF', value: 0 },
                { label: '15s', value: 15 },
                { label: '30s', value: 30 },
                { label: '60s', value: 60 },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleAutoRefreshToggle(opt.value)}
                  className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold cursor-pointer transition-all ${
                    autoRefreshInterval === opt.value
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-500 hover:text-slate-300 border border-transparent'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={runScan}
              disabled={loading}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all shadow-[0_0_12px_rgba(16,185,129,0.25)] disabled:opacity-50 cursor-pointer font-mono"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              {loading ? 'VARENDO MERCADO...' : 'EXECUTAR SCAN'}
            </button>
          </div>
        </div>

        {/* Gerenciamento Ativo de Símbolos */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 font-mono">
              Símbolos no Scanner ({selectedSymbols.length}):
            </label>
            <button
              onClick={() => setSelectedSymbols(defaultList)}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 font-mono underline cursor-pointer"
            >
              Restaurar Lista Padrão
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 bg-black/40 border border-white/5 rounded-xl p-3">
            {selectedSymbols.map((sym) => (
              <span
                key={sym}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-bold"
              >
                {sym}
                <button
                  type="button"
                  onClick={() => handleRemoveSymbol(sym)}
                  className="hover:bg-emerald-500/20 p-0.5 rounded text-emerald-300 hover:text-white transition-colors cursor-pointer"
                  title={`Remover ${sym}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            <form onSubmit={handleAddCustomSymbol} className="flex items-center gap-1 ml-auto">
              <input
                type="text"
                placeholder="+ Adicionar Par (ex: ADAUSDT)"
                value={customSymbol}
                onChange={(e) => setCustomSymbol(e.target.value)}
                className="bg-black/80 border border-white/10 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500/60 w-44 uppercase placeholder:normal-case placeholder-slate-600"
              />
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-500 text-white p-1 rounded-lg transition-colors cursor-pointer"
                title="Adicionar símbolo"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Seção de Seleção da Fonte de Dados: API Binance vs Histórico Local JSON */}
        <div className="bg-black/40 border border-white/10 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-2.5">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-bold font-mono text-slate-200 uppercase tracking-wider">
                Fonte de Dados para Análise
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setUseLocalJson(false)}
                className={`px-3 py-1 rounded text-xs font-mono font-semibold transition-all cursor-pointer border ${
                  !useLocalJson
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm'
                    : 'bg-white/5 text-slate-400 border-white/10 hover:text-slate-200'
                }`}
              >
                Binance API (Online)
              </button>
              <button
                type="button"
                onClick={() => setUseLocalJson(true)}
                className={`px-3 py-1 rounded text-xs font-mono font-semibold transition-all cursor-pointer border ${
                  useLocalJson
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                    : 'bg-white/5 text-slate-400 border-white/10 hover:text-slate-200'
                }`}
              >
                Histórico Local (Arquivos JSON)
              </button>
            </div>
          </div>

          {useLocalJson && (
            <div className="space-y-3 text-xs font-mono pt-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">Caminho do Diretório Local</label>
                  <input
                    type="text"
                    value={dataDir}
                    onChange={(e) => setDataDir(e.target.value)}
                    className="w-full bg-black/80 border border-white/10 text-amber-200 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-amber-500/60"
                  />
                  <span className="text-[9px] text-slate-500 mt-1 block">
                    Padrão de arquivos: &#123;SIMBOLO&#125;-{timeframe}-YYYY-MM.json em /home/pablo/datadown/data/monthly
                  </span>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">Filtro de Período</label>
                  <select
                    value={periodMode}
                    onChange={(e) => setPeriodMode(e.target.value as any)}
                    className="w-full bg-black/80 border border-white/10 text-slate-200 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-amber-500/60"
                  >
                    <option value="all">Todos os arquivos JSON encontrados na pasta</option>
                    <option value="specific">Períodos Específicos (ex: 2021-05, 2022-06)</option>
                    <option value="range">Intervalo de Datas (ex: 2021-01 até 2021-12)</option>
                  </select>
                </div>
              </div>

              {periodMode === 'specific' && (
                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">Lista de Períodos (YYYY-MM separados por vírgula)</label>
                  <input
                    type="text"
                    value={specificPeriods}
                    onChange={(e) => setSpecificPeriods(e.target.value)}
                    placeholder="2021-05, 2022-06, 2024-10"
                    className="w-full bg-black/80 border border-white/10 text-slate-200 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-amber-500/60"
                  />
                </div>
              )}

              {periodMode === 'range' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase block mb-1">Período De (YYYY-MM)</label>
                    <input
                      type="text"
                      value={startPeriod}
                      onChange={(e) => setStartPeriod(e.target.value)}
                      placeholder="2021-01"
                      className="w-full bg-black/80 border border-white/10 text-slate-200 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-amber-500/60"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase block mb-1">Período Até (YYYY-MM)</label>
                    <input
                      type="text"
                      value={endPeriod}
                      onChange={(e) => setEndPeriod(e.target.value)}
                      placeholder="2021-12"
                      className="w-full bg-black/80 border border-white/10 text-slate-200 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-amber-500/60"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Parâmetros Técnicos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 pt-1">
          <div className="lg:col-span-2">
            <label className="text-[10px] text-emerald-300 font-mono font-bold uppercase block mb-1">Estratégia do Scanner</label>
            <select
              value={scannerStrategy}
              onChange={(e) => setScannerStrategy(e.target.value)}
              className="w-full bg-emerald-950/30 border border-emerald-500/30 text-emerald-200 rounded-lg p-2 text-xs font-mono font-bold focus:outline-none focus:border-emerald-500"
            >
              <option value="rsi_volume">RSI + Volume Spike</option>
              <option value="donchian_cmf">Donchian CMF Breakout</option>
              <option value="vwap_reversion">VWAP Mean Reversion</option>
              <option value="donchian_breakout">Donchian Breakout (ADX)</option>
              <option value="supertrend_pullback">SuperTrend Pullback</option>
              <option value="squeeze_breakout">Squeeze Momentum Breakout</option>
              <option value="orderflow_divergence">CVD/OBV Divergence</option>
              <option value="funding_sentiment">Funding Rate Sentiment</option>
              <option value="ichimoku_cloud">Ichimoku Cloud</option>
              <option value="pivot_points">Pivot Points Bounce</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Tempo Gráfico</label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-emerald-500/60"
            >
              <option value="1m">1 minuto</option>
              <option value="5m">5 minutos</option>
              <option value="15m">15 minutos (15m)</option>
              <option value="1h">1 hora</option>
              <option value="4h">4 horas</option>
            </select>
          </div>

          {hasParamGroup(scannerStrategy, 'rsi') && (<>
          <div>
            <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Período RSI</label>
            <input
              type="number"
              value={rsiPeriod}
              onChange={(e) => setRsiPeriod(Number(e.target.value))}
              className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-emerald-500/60"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Sobrevenda (LONG)</label>
            <input
              type="number"
              value={rsiLow}
              onChange={(e) => setRsiLow(Number(e.target.value))}
              className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-emerald-500/60"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Sobrecompra (SHORT)</label>
            <input
              type="number"
              value={rsiHigh}
              onChange={(e) => setRsiHigh(Number(e.target.value))}
              className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-emerald-500/60"
            />
          </div>
          </>)}

          {hasParamGroup(scannerStrategy, 'volume') && (
          <div>
            <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Vol Spike (Múltiplo)</label>
            <input
              type="number"
              step="0.1"
              value={volRatio}
              onChange={(e) => setVolRatio(Number(e.target.value))}
              className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-emerald-500/60"
            />
          </div>
          )}

          {hasParamGroup(scannerStrategy, 'donchian') && (
            <div>
              <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Donchian (N)</label>
              <input type="number" value={donchianPeriod} onChange={(e) => setDonchianPeriod(Number(e.target.value))}
                className="w-full bg-black/60 border border-white/10 text-emerald-300 rounded-lg p-2 text-xs font-mono font-bold focus:outline-none focus:border-emerald-500/60" />
            </div>
          )}

          {hasParamGroup(scannerStrategy, 'cmf') && (<>
            <div>
              <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">CMF Período</label>
              <input type="number" value={cmfPeriod} onChange={(e) => setCmfPeriod(Number(e.target.value))}
                className="w-full bg-black/60 border border-white/10 text-amber-300 rounded-lg p-2 text-xs font-mono font-bold focus:outline-none focus:border-emerald-500/60" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">CMF Threshold</label>
              <input type="number" step="0.01" value={cmfThreshold} onChange={(e) => setCmfThreshold(Number(e.target.value))}
                className="w-full bg-black/60 border border-white/10 text-cyan-300 rounded-lg p-2 text-xs font-mono font-bold focus:outline-none focus:border-emerald-500/60" />
            </div>
          </>)}

          {hasParamGroup(scannerStrategy, 'vwap') && (
            <div>
              <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">VWAP Desvio (%)</label>
              <input type="number" step="0.1" value={vwapDeviationPct} onChange={(e) => setVwapDeviationPct(Number(e.target.value))}
                className="w-full bg-black/60 border border-white/10 text-amber-300 rounded-lg p-2 text-xs font-mono font-bold focus:outline-none focus:border-emerald-500/60" />
            </div>
          )}

          {hasParamGroup(scannerStrategy, 'chop') && (
            <div>
              <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Choppiness Limiar</label>
              <input type="number" step="1" value={chopThreshold} onChange={(e) => setChopThreshold(Number(e.target.value))}
                className="w-full bg-black/60 border border-white/10 text-amber-300 rounded-lg p-2 text-xs font-mono font-bold focus:outline-none focus:border-emerald-500/60" />
            </div>
          )}

          {hasParamGroup(scannerStrategy, 'supertrend') && (<>
            <div>
              <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">SuperTrend Período</label>
              <input type="number" value={supertrendPeriod} onChange={(e) => setSupertrendPeriod(Number(e.target.value))}
                className="w-full bg-black/60 border border-white/10 text-sky-300 rounded-lg p-2 text-xs font-mono font-bold focus:outline-none focus:border-emerald-500/60" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">SuperTrend Mult</label>
              <input type="number" step="0.5" value={supertrendMultiplier} onChange={(e) => setSupertrendMultiplier(Number(e.target.value))}
                className="w-full bg-black/60 border border-white/10 text-sky-300 rounded-lg p-2 text-xs font-mono font-bold focus:outline-none focus:border-emerald-500/60" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Stoch RSI Período</label>
              <input type="number" value={stochRsiPeriod} onChange={(e) => setStochRsiPeriod(Number(e.target.value))}
                className="w-full bg-black/60 border border-white/10 text-sky-300 rounded-lg p-2 text-xs font-mono font-bold focus:outline-none focus:border-emerald-500/60" />
            </div>
          </>)}

          {hasParamGroup(scannerStrategy, 'squeeze') && (<>
            <div>
              <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">BB Período</label>
              <input type="number" value={bbPeriod} onChange={(e) => setBbPeriod(Number(e.target.value))}
                className="w-full bg-black/60 border border-white/10 text-purple-300 rounded-lg p-2 text-xs font-mono font-bold focus:outline-none focus:border-emerald-500/60" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">BB Std Dev</label>
              <input type="number" step="0.5" value={bbStdDev} onChange={(e) => setBbStdDev(Number(e.target.value))}
                className="w-full bg-black/60 border border-white/10 text-purple-300 rounded-lg p-2 text-xs font-mono font-bold focus:outline-none focus:border-emerald-500/60" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">KC ATR Período</label>
              <input type="number" value={kcAtrPeriod} onChange={(e) => setKcAtrPeriod(Number(e.target.value))}
                className="w-full bg-black/60 border border-white/10 text-purple-300 rounded-lg p-2 text-xs font-mono font-bold focus:outline-none focus:border-emerald-500/60" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">KC ATR Mult</label>
              <input type="number" step="0.5" value={kcAtrMult} onChange={(e) => setKcAtrMult(Number(e.target.value))}
                className="w-full bg-black/60 border border-white/10 text-purple-300 rounded-lg p-2 text-xs font-mono font-bold focus:outline-none focus:border-emerald-500/60" />
            </div>
          </>)}

          {hasParamGroup(scannerStrategy, 'orderflow') && (
            <div>
              <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Lookback (barras)</label>
              <input type="number" value={orderflowLookback} onChange={(e) => setOrderflowLookback(Number(e.target.value))}
                className="w-full bg-black/60 border border-white/10 text-cyan-300 rounded-lg p-2 text-xs font-mono font-bold focus:outline-none focus:border-emerald-500/60" />
            </div>
          )}

          {hasParamGroup(scannerStrategy, 'funding') && (
            <div>
              <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Funding Threshold</label>
              <input type="number" step="0.0001" value={fundingThreshold} onChange={(e) => setFundingThreshold(Number(e.target.value))}
                className="w-full bg-black/60 border border-white/10 text-orange-300 rounded-lg p-2 text-xs font-mono font-bold focus:outline-none focus:border-emerald-500/60" />
            </div>
          )}

          {hasParamGroup(scannerStrategy, 'ichimoku') && (<>
            <div>
              <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Tenkan (Rápida)</label>
              <input type="number" value={ichimokuTenkan} onChange={(e) => setIchimokuTenkan(Number(e.target.value))}
                className="w-full bg-black/60 border border-white/10 text-teal-300 rounded-lg p-2 text-xs font-mono font-bold focus:outline-none focus:border-emerald-500/60" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Kijun (Média)</label>
              <input type="number" value={ichimokuKijun} onChange={(e) => setIchimokuKijun(Number(e.target.value))}
                className="w-full bg-black/60 border border-white/10 text-teal-300 rounded-lg p-2 text-xs font-mono font-bold focus:outline-none focus:border-emerald-500/60" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Senkou B (Lenta)</label>
              <input type="number" value={ichimokuSenkouB} onChange={(e) => setIchimokuSenkouB(Number(e.target.value))}
                className="w-full bg-black/60 border border-white/10 text-teal-300 rounded-lg p-2 text-xs font-mono font-bold focus:outline-none focus:border-emerald-500/60" />
            </div>
          </>)}

          {hasParamGroup(scannerStrategy, 'pivot') && (
            <div>
              <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Vol SMA Período</label>
              <input type="number" value={pivotVolPeriod} onChange={(e) => setPivotVolPeriod(Number(e.target.value))}
                className="w-full bg-black/60 border border-white/10 text-rose-300 rounded-lg p-2 text-xs font-mono font-bold focus:outline-none focus:border-emerald-500/60" />
            </div>
          )}

          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 py-2 select-none">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="accent-emerald-500 rounded bg-black/60 border-white/10"
              />
              <span className="font-mono text-[11px] text-slate-400">Exibir Todos</span>
            </label>
          </div>
        </div>

        {/* Ollama Toggle */}
        <div className="flex items-center justify-between bg-black/40 border border-white/10 rounded-xl p-3">
          <div className="flex items-center gap-3">
            <Cpu className="w-4 h-4 text-indigo-400" />
            <div>
              <span className="text-xs font-bold text-slate-200 block uppercase tracking-wider font-mono">
                Decisão IA Ollama Local
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {ollamaAvailable
                  ? `Serviço Ollama Ativo (${ollamaModels.length} modelos disponíveis)`
                  : 'Ollama offline - Usará regras técnicas determinísticas caso ativado'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {ollamaModels.length > 0 && (
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-black/60 border border-white/10 text-xs font-mono text-slate-200 rounded-lg px-2.5 py-1"
              >
                {ollamaModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => setWithOllama(!withOllama)}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer border ${
                withOllama
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-sm'
                  : 'bg-white/5 text-slate-400 hover:text-slate-200 border-white/10'
              }`}
            >
              {withOllama ? 'IA ATIVADA' : 'ATIVAR IA'}
            </button>
          </div>
        </div>
      </div>

      {/* Resultados do Scan */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
            Contratos Analisados ({results.length})
          </h3>
          <span className="text-[10px] font-mono text-slate-500">
            {results.length > 0
              ? `Atualizado: ${results[0]?.timestamp}${autoRefreshInterval > 0 ? ` · Próx: ${countdown}s` : ''}`
              : loading
              ? 'Buscando dados...'
              : scanErrors.length > 0
              ? 'Dados indisponíveis'
              : 'Aguardando scan'}
          </span>
        </div>

        {scanErrors.length > 0 && (
          <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs font-bold font-mono uppercase tracking-wider">
                {scanErrors.length} erro(s) ao buscar dados de preços
              </span>
            </div>
            <div className="space-y-1">
              {scanErrors.map((err, idx) => (
                <div key={idx} className="flex items-center gap-2 text-[11px] font-mono">
                  <span className="text-amber-300 font-bold">{err.symbol}:</span>
                  <span className="text-amber-400/70 truncate">{err.error}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-amber-500/50 font-mono">
              Verifique sua conexão com a internet ou se a API da Binance está acessível na sua região.
            </p>
          </div>
        )}

        {results.length === 0 ? (
          <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-10 text-center">
            <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <p className="text-slate-300 text-xs font-mono font-semibold">Nenhum contrato atende aos filtros atuais.</p>
            <p className="text-slate-500 text-[11px] mt-1 font-mono">
              Marque "Exibir Todos os Pares" ou ajuste os níveis de RSI e Volume Spike.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((res) => {
              const isLongAlert = res.signal === 'LONG_ALERT';
              const isShortAlert = res.signal === 'SHORT_ALERT';

              return (
                <div
                  key={res.symbol}
                  className={`bg-zinc-900/60 border rounded-xl p-4 shadow-lg transition-all hover:border-white/20 relative flex flex-col justify-between ${
                    isLongAlert
                      ? 'border-emerald-500/40 bg-emerald-950/10'
                      : isShortAlert
                      ? 'border-rose-500/40 bg-rose-950/10'
                      : 'border-white/10'
                  }`}
                >
                  <div>
                    {/* Header do Card */}
                    <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5">
                      <div>
                        <span className="font-bold font-mono text-sm text-white">{res.symbol}</span>
                        <span className="text-[10px] font-mono text-slate-500 block">{res.strategy_name || scannerStrategy} · Futures USDⓈ-M</span>
                      </div>
                      <div className="text-right">
                        <span className={`font-mono text-sm font-bold ${res.price_source === 'kline_stale' ? 'text-amber-400/70' : 'text-white'}`}>
                          ${res.price}
                          {res.price_source === 'kline_stale' && (
                            <span className="text-[8px] text-amber-500/60 block font-normal">
                              ⚠ Preço antigo (API indisponível)
                            </span>
                          )}
                        </span>
                        <span
                          className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded block mt-0.5 tracking-wider ${
                            isLongAlert
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : isShortAlert
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              : 'bg-white/5 text-slate-400 border border-white/10'
                          }`}
                        >
                          {res.signal}
                        </span>
                      </div>
                    </div>

                    {/* Métrica RSI & Volume Spike */}
                    <div className="grid grid-cols-2 gap-2 my-3 text-xs">
                      <div className="bg-black/60 p-2 rounded-lg border border-white/5">
                        <span className="text-slate-500 block text-[9px] font-mono uppercase">RSI ({rsiPeriod})</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span
                            className={`font-mono font-bold text-xs ${
                              res.rsi <= rsiLow
                                ? 'text-emerald-400'
                                : res.rsi >= rsiHigh
                                ? 'text-rose-400'
                                : 'text-slate-200'
                            }`}
                          >
                            {res.rsi}
                          </span>
                          {res.rsi <= rsiLow && <TrendingDown className="w-3 h-3 text-emerald-400" />}
                          {res.rsi >= rsiHigh && <TrendingUp className="w-3 h-3 text-rose-400" />}
                        </div>
                      </div>

                      <div className="bg-black/60 p-2 rounded-lg border border-white/5">
                        <span className="text-slate-500 block text-[9px] font-mono uppercase">Pico Vol ({volRatio}x)</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span
                            className={`font-mono font-bold text-xs ${
                              res.is_volume_spike ? 'text-amber-400' : 'text-slate-300'
                            }`}
                          >
                            {res.volume_ratio_pct}%
                          </span>
                          {res.is_volume_spike && <Flame className="w-3 h-3 text-amber-400 animate-pulse" />}
                        </div>
                      </div>
                    </div>

                    {/* Níveis Técnicos */}
                    <div className="space-y-1 text-xs bg-black/40 p-2.5 rounded-lg border border-white/5 font-mono">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-500">Suporte 1:</span>
                        <span className="text-emerald-400 font-medium">
                          ${res.support_levels?.[0] || '---'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-500">Resistência 1:</span>
                        <span className="text-rose-400 font-medium">
                          ${res.resistance_levels?.[0] || '---'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-t border-white/5 pt-1 text-[11px]">
                        <span className="text-slate-500">Zona Entrada:</span>
                        <span className="text-amber-300 font-semibold">
                          ${res.entry_zone?.low} → ${res.entry_zone?.high}
                        </span>
                      </div>
                    </div>

                    {/* Recomendação IA se disponível */}
                    {res.recommendation && (
                      <div className="mt-3 bg-indigo-950/30 border border-indigo-500/20 rounded-lg p-2.5 text-xs space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-indigo-300 flex items-center gap-1 font-mono text-[11px]">
                            <Cpu className="w-3 h-3 text-indigo-400" />
                            AÇÃO IA: {res.recommendation.acao}
                          </span>
                          <span className="text-[9px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 px-1.5 py-0.5 rounded font-mono">
                            CONF. {res.recommendation.confianca}%
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 line-clamp-2">{res.recommendation.justificativa}</p>
                      </div>
                    )}
                  </div>

                  {/* Ações Rápidas */}
                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-white/10">
                    <button
                      onClick={() =>
                        onQuickTrade(
                          res.symbol,
                          isShortAlert ? 'SELL' : 'BUY',
                          res.price,
                          res.support_levels[0] || res.price * 0.98,
                          res.resistance_levels[0] || res.price * 1.02
                        )
                      }
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold font-mono py-1.5 px-2 rounded-lg transition-all text-center cursor-pointer shadow-[0_0_8px_rgba(16,185,129,0.2)]"
                    >
                      TRADE PAPER
                    </button>
                    <button
                      onClick={() =>
                        onApplyParamsToBacktest(res.symbol, {
                          rsi_period: rsiPeriod,
                          rsi_oversold: rsiLow,
                          rsi_overbought: rsiHigh,
                          volume_ratio: volRatio,
                          stop_loss_pct: 1.5,
                          take_profit_pct: 3.0,
                        })
                      }
                      className="bg-white/5 hover:bg-white/10 text-slate-200 text-[11px] font-bold font-mono py-1.5 px-2 rounded-lg border border-white/10 transition-all text-center cursor-pointer"
                    >
                      BACKTEST PAR
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
