import React, { useState } from 'react';
import { OptimizationResult, RankedStrategy, StrategyParams } from '../types';
import { loadGlobalSettings } from '../utils/settings';
import { Sliders, Zap, Award, CheckCircle2, RefreshCw, HardDrive, X, Plus } from 'lucide-react';

interface OptimizerTabProps {
  sharedSymbols: string[];
  onSharedSymbolsChange: (symbols: string[]) => void;
  onApplyStrategy: (symbol: string, params: StrategyParams) => void;
  onApplyToScanner: (params: { strategy: string; rsi_period?: number; rsi_oversold?: number; rsi_overbought?: number; volume_ratio?: number }) => void;
  onApplyToMultiBacktest: (params: StrategyParams) => void;
}

export const OptimizerTab: React.FC<OptimizerTabProps> = ({ sharedSymbols, onSharedSymbolsChange, onApplyStrategy, onApplyToScanner, onApplyToMultiBacktest }) => {
  const globalDefaults = loadGlobalSettings();

  const selectedSymbols = sharedSymbols;
  const setSelectedSymbols = onSharedSymbolsChange;
  const [customSymbol, setCustomSymbol] = useState('');
  const [timeframe, setTimeframe] = useState('15m');
  type StrategyType = 'rsi_volume' | 'donchian_cmf' | 'vwap_reversion' | 'donchian_breakout' | 'supertrend_pullback' | 'squeeze_breakout' | 'orderflow_divergence' | 'funding_sentiment' | 'ichimoku_cloud' | 'pivot_points';
  const [strategy, setStrategy] = useState<StrategyType>('rsi_volume');
  const [allStrategies, setAllStrategies] = useState(false);
  const [capital, setCapital] = useState(globalDefaults.capital || 10000);
  const [leverage, setLeverage] = useState(globalDefaults.leverage || 10);
  const [marginType, setMarginType] = useState<'ISOLATED' | 'CROSS'>(globalDefaults.margin_type || 'ISOLATED');
  const [positionSizingType, setPositionSizingType] = useState<'PERCENT' | 'FIXED'>(globalDefaults.position_sizing_type || 'PERCENT');
  const [positionSizeValue, setPositionSizeValue] = useState(
    globalDefaults.position_sizing_type === 'FIXED' ? globalDefaults.position_size_value_fixed : globalDefaults.position_size_value
  );
  const [metric, setMetric] = useState<'total_pnl_pct' | 'win_rate_pct' | 'sharpe_ratio'>('total_pnl_pct');
  const [topN, setTopN] = useState(10);
  const [limit, setLimit] = useState(500);

  // Trailing Stop Inteligente
  const [useTrailingStop, setUseTrailingStop] = useState(globalDefaults.use_trailing_stop);
  const [trailingActivationPct, setTrailingActivationPct] = useState(globalDefaults.trailing_activation_pct);
  const [trailingDistancePct, setTrailingDistancePct] = useState(globalDefaults.trailing_distance_pct);
  const [trailingType, setTrailingType] = useState(globalDefaults.trailing_type);
  const [trailingAtrMult, setTrailingAtrMult] = useState(globalDefaults.trailing_atr_mult);

  // Histórico Local JSON
  const [useLocalJson, setUseLocalJson] = useState(globalDefaults.use_local_json);
  const [dataDir, setDataDir] = useState(globalDefaults.data_dir || '/home/pablo/datadown/data/monthly');
  const [periodMode, setPeriodMode] = useState<'all' | 'specific' | 'range'>('all');
  const [specificPeriods, setSpecificPeriods] = useState('2021-05,2022-06,2024-10');
  const [startPeriod, setStartPeriod] = useState('2021-01');
  const [endPeriod, setEndPeriod] = useState('2021-12');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRemoveSymbol = (sym: string) => {
    setSelectedSymbols((prev) => prev.filter((s) => s !== sym));
  };

  const handleAddCustomSymbol = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const clean = customSymbol.trim().toUpperCase();
    if (clean && !selectedSymbols.includes(clean)) {
      setSelectedSymbols((prev) => [...prev, clean]);
      setCustomSymbol('');
    }
  };

  const handleRunOptimization = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (selectedSymbols.length === 0) {
      setErrorMessage('Adicione pelo menos um símbolo.');
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      const bodyPayload: any = {
        symbols: selectedSymbols.join(','),
        timeframe,
        strategy,
        all_strategies: allStrategies,
        capital,
        leverage,
        margin_type: marginType,
        position_sizing_type: positionSizingType,
        position_size_value: positionSizeValue,
        use_trailing_stop: useTrailingStop,
        trailing_activation_pct: trailingActivationPct,
        trailing_distance_pct: trailingDistancePct,
        trailing_type: trailingType,
        trailing_atr_mult: trailingAtrMult,
        metric,
        top_n: topN,
        limit,
        use_local_json: useLocalJson,
      };

      if (useLocalJson) {
        bodyPayload.data_dir = dataDir;
        if (periodMode === 'specific') {
          bodyPayload.periods = specificPeriods;
        } else if (periodMode === 'range') {
          bodyPayload.start_period = startPeriod;
          bodyPayload.end_period = endPeriod;
        }
      }

      const resp = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });
      const data = await resp.json();
      if (data.success && data.data && !data.data.error) {
        setResult(data.data);
      } else {
        setResult(null);
        setErrorMessage(data.error || data.data?.error || 'Não foi possível carregar a otimização.');
      }
    } catch (error: any) {
      console.error('Erro ao otimizar estratégia:', error);
      setResult(null);
      setErrorMessage(error.message || 'Erro de comunicação ao executar a otimização.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Form de Otimização */}
      <form onSubmit={handleRunOptimization} className="bg-zinc-900/50 border border-white/10 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              Otimizador Determinístico de Parâmetros (Grid Search)
            </h2>
            <p className="text-[11px] text-slate-400 mt-1 font-sans">
              Testa combinações de RSI, Volume e Stop/Alvo de forma 100% matemática e gera o ranking top N.
            </p>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all shadow-[0_0_12px_rgba(245,158,11,0.15)] disabled:opacity-50 cursor-pointer font-mono"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 fill-current" />}
            {loading ? 'EXECUTANDO GRID SEARCH...' : allStrategies ? 'OTIMIZAR TODAS ESTRATÉGIAS' : 'OTIMIZAR PARÂMETROS'}
          </button>
        </div>

        {/* Seleção de Fonte de Dados */}
        <div className="bg-black/40 border border-white/10 rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold font-mono text-slate-200 uppercase tracking-wider">
                Fonte de Dados para Otimização
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono">
              <button
                type="button"
                onClick={() => setUseLocalJson(false)}
                className={`px-3 py-1 rounded text-xs transition-all cursor-pointer border ${
                  !useLocalJson
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                    : 'bg-white/5 text-slate-400 border-white/10'
                }`}
              >
                Binance Online
              </button>
              <button
                type="button"
                onClick={() => setUseLocalJson(true)}
                className={`px-3 py-1 rounded text-xs transition-all cursor-pointer border ${
                  useLocalJson
                    ? 'bg-amber-500/30 text-amber-200 border-amber-500/60 font-bold'
                    : 'bg-white/5 text-slate-400 border-white/10'
                }`}
              >
                Histórico Local (JSON)
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
                  <span className="text-[9px] text-slate-500 mt-0.5 block">
                    Padrão: /home/pablo/datadown/data/monthly
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
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">Períodos (YYYY-MM separados por vírgula)</label>
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
                    <label className="text-[10px] text-slate-400 uppercase block mb-1">De (YYYY-MM)</label>
                    <input
                      type="text"
                      value={startPeriod}
                      onChange={(e) => setStartPeriod(e.target.value)}
                      placeholder="2021-01"
                      className="w-full bg-black/80 border border-white/10 text-slate-200 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-amber-500/60"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase block mb-1">Até (YYYY-MM)</label>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
          <div className="md:col-span-2">
            <label className="text-[10px] text-amber-300 font-mono font-bold uppercase block mb-1">Estratégia para Otimizar</label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as any)}
              disabled={allStrategies}
              className="w-full bg-amber-950/30 border border-amber-500/30 text-amber-200 rounded-lg p-2 text-xs font-mono font-bold focus:outline-none focus:border-amber-500 disabled:opacity-40 disabled:cursor-not-allowed"
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
            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="allStrategies"
                checked={allStrategies}
                onChange={(e) => setAllStrategies(e.target.checked)}
                className="accent-amber-500 w-3.5 h-3.5 cursor-pointer"
              />
              <label htmlFor="allStrategies" className="text-[10px] text-amber-400/80 font-mono cursor-pointer select-none">
                Rodar TODAS as estratégias automaticamente
              </label>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">
              Símbolos ({selectedSymbols.length})
            </label>
            <div className="flex flex-wrap items-center gap-1.5 bg-black/60 border border-white/10 rounded-lg p-2 min-h-[36px]">
              {selectedSymbols.map((sym) => (
                <span
                  key={sym}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-mono font-bold"
                >
                  {sym}
                  <button
                    type="button"
                    onClick={() => handleRemoveSymbol(sym)}
                    className="hover:bg-amber-500/20 p-0.5 rounded text-amber-300 hover:text-white transition-colors cursor-pointer"
                    title={`Remover ${sym}`}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
              <form onSubmit={handleAddCustomSymbol} className="flex items-center gap-1 ml-auto">
                <input
                  type="text"
                  placeholder="+ Par"
                  value={customSymbol}
                  onChange={(e) => setCustomSymbol(e.target.value)}
                  className="bg-black/80 border border-white/10 rounded px-1.5 py-0.5 text-[10px] font-mono text-slate-200 focus:outline-none focus:border-amber-500/60 w-24 uppercase placeholder:normal-case placeholder-slate-600"
                />
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-500 text-white p-0.5 rounded transition-colors cursor-pointer"
                  title="Adicionar símbolo"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </form>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Tempo Gráfico</label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-amber-500/60"
            >
              <option value="1m">1m</option>
              <option value="5m">5m</option>
              <option value="15m">15m</option>
              <option value="1h">1h</option>
              <option value="4h">4h</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Métrica Ranking</label>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as any)}
              className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-amber-500/60 font-semibold text-amber-400"
            >
              <option value="total_pnl_pct">Maior P&L Total (%)</option>
              <option value="win_rate_pct">Maior Win Rate (%)</option>
              <option value="sharpe_ratio">Maior Sharpe Ratio</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Top N Estratégias</label>
            <input
              type="number"
              value={topN}
              onChange={(e) => setTopN(Number(e.target.value))}
              className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-amber-500/60 font-mono"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Histórico Candles</label>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-amber-500/60 font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-white/5">
          <div>
            <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Alavancagem</label>
            <div className="flex items-center bg-black/60 border border-white/10 rounded-lg px-2 py-1.5">
              <input
                type="number"
                min="1"
                max="125"
                value={leverage}
                onChange={(e) => setLeverage(Number(e.target.value))}
                className="w-full bg-transparent text-amber-300 font-mono font-bold text-xs focus:outline-none"
              />
              <span className="text-[10px] font-mono text-slate-500 font-bold">x</span>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Modo de Margem</label>
            <select
              value={marginType}
              onChange={(e) => setMarginType(e.target.value as any)}
              className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-amber-500/60"
            >
              <option value="ISOLATED">Isolada (Isolated)</option>
              <option value="CROSS">Cruzada (Cross)</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Dimensionamento</label>
            <select
              value={positionSizingType}
              onChange={(e) => setPositionSizingType(e.target.value as any)}
              className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-amber-500/60"
            >
              <option value="PERCENT">% do Saldo Total</option>
              <option value="FIXED">Valor Fixo em USDT</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">
              {positionSizingType === 'PERCENT' ? 'Tamanho Margem (%)' : 'Valor Fixo (USDT)'}
            </label>
            <input
              type="number"
              step="0.5"
              value={positionSizeValue}
              onChange={(e) => setPositionSizeValue(Number(e.target.value))}
              className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-amber-500/60"
            />
          </div>
        </div>

        {/* Painel de Trailing Stop Inteligente na Otimização */}
        <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-3.5 space-y-3 mt-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold font-mono text-amber-300 uppercase tracking-wider">
                Trailing Stop Inteligente na Otimização
              </span>
            </div>

            <label className="flex items-center gap-2 cursor-pointer bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-lg hover:bg-amber-500/20 transition-all">
              <span className="text-xs font-mono font-bold text-amber-300">
                {useTrailingStop ? 'ATIVADO' : 'DESATIVADO'}
              </span>
              <input
                type="checkbox"
                checked={useTrailingStop}
                onChange={(e) => setUseTrailingStop(e.target.checked)}
                className="w-3.5 h-3.5 accent-amber-500 rounded cursor-pointer"
              />
            </label>
          </div>

          <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 transition-all ${useTrailingStop ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <div>
              <label className="text-[10px] text-amber-200/80 font-mono uppercase block mb-1">Tipo de Trailing</label>
              <select
                value={trailingType}
                onChange={(e) => setTrailingType(e.target.value as any)}
                className="w-full bg-black/80 border border-amber-500/30 text-amber-200 rounded-lg p-1.5 text-xs font-mono font-bold focus:outline-none"
              >
                <option value="PERCENT">PERCENT (Distância %)</option>
                <option value="ATR_DYNAMIC">ATR_DYNAMIC (Volatilidade)</option>
                <option value="STEP_RATCHET">STEP_RATCHET (Escalonado)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-amber-200/80 font-mono uppercase block mb-1">Gatilho Ativação (%)</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={trailingActivationPct}
                onChange={(e) => setTrailingActivationPct(Number(e.target.value))}
                className="w-full bg-black/80 border border-amber-500/30 text-amber-200 rounded-lg p-1.5 text-xs font-mono font-bold focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] text-amber-200/80 font-mono uppercase block mb-1">Distância Trailing (%)</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={trailingDistancePct}
                onChange={(e) => setTrailingDistancePct(Number(e.target.value))}
                className="w-full bg-black/80 border border-amber-500/30 text-amber-200 rounded-lg p-1.5 text-xs font-mono font-bold focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] text-amber-200/80 font-mono uppercase block mb-1">Multiplicador ATR</label>
              <input
                type="number"
                step="0.1"
                min="0.5"
                disabled={trailingType !== 'ATR_DYNAMIC'}
                value={trailingAtrMult}
                onChange={(e) => setTrailingAtrMult(Number(e.target.value))}
                className="w-full bg-black/80 border border-amber-500/30 text-amber-200 rounded-lg p-1.5 text-xs font-mono font-bold focus:outline-none disabled:opacity-30"
              />
            </div>
          </div>
        </div>
      </form>

      {/* Mensagem de Erro de Execução */}
      {errorMessage && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-start gap-3 font-mono text-xs">
          <Zap className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-rose-300 block uppercase tracking-wider">Falha na Otimização</span>
            <p className="text-rose-200">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Tabela de Resultados de Otimização */}
      {result && (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                Ranking de Melhores Configurações ({result.top_strategies?.length ?? 0} de {result.tested_combinations ?? 0} testadas)
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                Métrica: <span className="text-amber-400 font-semibold">{result.ranking_metric}</span>
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 border-collapse font-mono">
              <thead>
                <tr className="border-b border-white/10 text-[10px] text-slate-500 uppercase tracking-wider bg-white/[0.01]">
                  <th className="py-2.5 px-3">Rank</th>
                  <th className="py-2.5 px-3">Par</th>
                  <th className="py-2.5 px-3">Estratégia</th>
                  <th className="py-2.5 px-3">Parâmetros</th>
                  <th className="py-2.5 px-3">P&L (%)</th>
                  <th className="py-2.5 px-3">Win Rate (%)</th>
                  <th className="py-2.5 px-3">Fator Lucro</th>
                  <th className="py-2.5 px-3">Sharpe</th>
                  <th className="py-2.5 px-3">Max DD</th>
                  <th className="py-2.5 px-3">Trades</th>
                  <th className="py-2.5 px-3">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {(result.top_strategies || []).map((strat, idx) => {
                  const p = strat.params || {};
                  return (
                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-3 font-bold text-amber-400">#{idx + 1}</td>
                      <td className="py-3 px-3 font-bold text-white text-[11px]">{p.symbol || result.symbol}</td>
                      <td className="py-3 px-3">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-500/10 text-violet-400 border border-violet-500/30">
                          {p.strategy || strategy}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono">
                        <span className="bg-black/60 px-2 py-1 rounded border border-white/5 block text-[10px] text-slate-300">
                          SL:{p.stop_loss_pct}% | TP:{p.take_profit_pct}%
                          {p.rsi_period ? ` | RSI(${p.rsi_period})` : ''}
                          {p.rsi_oversold !== undefined ? ` [${p.rsi_oversold}/${p.rsi_overbought}]` : ''}
                          {p.volume_ratio ? ` | Vol:${p.volume_ratio}x` : ''}
                          {p.donchian_period ? ` | Donch:${p.donchian_period}` : ''}
                          {p.cmf_period ? ` | CMF(${p.cmf_period})` : ''}
                          {p.cmf_threshold !== undefined ? `≥${p.cmf_threshold}` : ''}
                          {p.ema_filter_period ? ` | EMA:${p.ema_filter_period}` : ''}
                          {p.vwap_deviation_pct !== undefined ? ` | VWAP:${p.vwap_deviation_pct}%` : ''}
                          {p.chop_threshold !== undefined ? ` | Chop≥${p.chop_threshold}` : ''}
                        </span>
                      </td>
                      <td className={`py-3 px-3 font-bold ${(strat.total_pnl_pct ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {strat.total_pnl_pct ?? 0}%
                      </td>
                      <td className="py-3 px-3 font-bold text-amber-400">{strat.win_rate_pct ?? 0}%</td>
                      <td className="py-3 px-3 text-slate-200">{strat.profit_factor ?? 0}</td>
                      <td className="py-3 px-3 text-sky-300">{strat.sharpe_ratio ?? 0}</td>
                      <td className="py-3 px-3 text-rose-400">{strat.max_drawdown_pct ?? 0}%</td>
                      <td className="py-3 px-3 text-slate-500">{strat.total_trades ?? 0}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => onApplyStrategy(p.symbol || result.symbol, p as any)}
                            className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[9px] font-bold py-1 px-2 rounded transition-all cursor-pointer flex items-center gap-1 font-mono"
                            title="Aplicar ao Backtest (símbolo)"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            BT
                          </button>
                          <button
                            onClick={() => onApplyToMultiBacktest(p as any)}
                            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold py-1 px-2 rounded transition-all cursor-pointer flex items-center gap-1 font-mono"
                            title="Aplicar ao Backtest Multi-Símbolo"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            BT ALL
                          </button>
                          <button
                            onClick={() => onApplyToScanner({
                              strategy: p.strategy || strategy,
                              rsi_period: p.rsi_period,
                              rsi_oversold: p.rsi_oversold,
                              rsi_overbought: p.rsi_overbought,
                              volume_ratio: p.volume_ratio,
                            })}
                            className="bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/30 text-[9px] font-bold py-1 px-2 rounded transition-all cursor-pointer flex items-center gap-1 font-mono"
                            title="Aplicar ao Scanner"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            SCANNER
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
