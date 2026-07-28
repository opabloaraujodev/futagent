import React, { useState, useEffect } from 'react';
import { BacktestResult, StrategyParams } from '../types';
import { loadGlobalSettings } from '../utils/settings';
import { BarChart2, Play, AlertTriangle, ShieldCheck, DollarSign, Percent, TrendingUp, RefreshCw, HardDrive, Zap } from 'lucide-react';

interface BacktestTabProps {
  initialSymbol?: string;
  initialParams?: StrategyParams | null;
}

export const BacktestTab: React.FC<BacktestTabProps> = ({
  initialSymbol = 'BTCUSDT',
  initialParams = null,
}) => {
  const globalDefaults = loadGlobalSettings();

  const [symbol, setSymbol] = useState(initialSymbol);
  const [timeframe, setTimeframe] = useState('15m');
  const [strategy, setStrategy] = useState<string>('rsi_volume');
  const [capital, setCapital] = useState(globalDefaults.capital || 10000);
  const [rsiPeriod, setRsiPeriod] = useState(initialParams?.rsi_period || 14);
  const [rsiLow, setRsiLow] = useState(initialParams?.rsi_oversold || 30);
  const [rsiHigh, setRsiHigh] = useState(initialParams?.rsi_overbought || 70);
  const [volRatio, setVolRatio] = useState(initialParams?.volume_ratio || 2.0);

  // Donchian + CMF params
  const [donchianPeriod, setDonchianPeriod] = useState(initialParams?.donchian_period || 20);
  const [cmfPeriod, setCmfPeriod] = useState(initialParams?.cmf_period || 20);
  const [cmfThreshold, setCmfThreshold] = useState(initialParams?.cmf_threshold || 0.05);
  const [emaFilter, setEmaFilter] = useState(initialParams?.ema_filter_period || 0);

  // EMA Cross params
  const [emaFast, setEmaFast] = useState(initialParams?.ema_fast || 9);
  const [emaSlow, setEmaSlow] = useState(initialParams?.ema_slow || 21);

  // Bollinger Bands params
  const [bbPeriod, setBbPeriod] = useState(initialParams?.bb_period || 20);
  const [bbStdDev, setBbStdDev] = useState(initialParams?.bb_std_dev || 2.0);

  // MACD params
  const [macdFast, setMacdFast] = useState(initialParams?.macd_fast || 12);
  const [macdSlow, setMacdSlow] = useState(initialParams?.macd_slow || 26);
  const [macdSignal, setMacdSignal] = useState(initialParams?.macd_signal || 9);

  // Supertrend params
  const [supertrendPeriod, setSupertrendPeriod] = useState(initialParams?.supertrend_period || 10);
  const [supertrendMultiplier, setSupertrendMultiplier] = useState(initialParams?.supertrend_multiplier || 3.0);

  // CRT params
  const [crtLookback, setCrtLookback] = useState(initialParams?.crt_lookback || 1);

  const [useAtrStop, setUseAtrStop] = useState(initialParams?.use_atr_stop || false);
  const [atrPeriod, setAtrPeriod] = useState(initialParams?.atr_period || 14);
  const [atrMultiplier, setAtrMultiplier] = useState(initialParams?.atr_multiplier || 2.0);

  // Trailing Stop Inteligente
  const [useTrailingStop, setUseTrailingStop] = useState(globalDefaults.use_trailing_stop);
  const [trailingActivationPct, setTrailingActivationPct] = useState(globalDefaults.trailing_activation_pct);
  const [trailingDistancePct, setTrailingDistancePct] = useState(globalDefaults.trailing_distance_pct);
  const [trailingType, setTrailingType] = useState(globalDefaults.trailing_type);
  const [trailingAtrMult, setTrailingAtrMult] = useState(globalDefaults.trailing_atr_mult);

  const [sl, setSl] = useState(initialParams?.stop_loss_pct || 1.5);
  const [tp, setTp] = useState(initialParams?.take_profit_pct || 3.0);
  const [leverage, setLeverage] = useState(initialParams?.leverage || globalDefaults.leverage || 10);
  const [marginType, setMarginType] = useState<'ISOLATED' | 'CROSS'>(
    initialParams?.margin_type ? (initialParams.margin_type === 'CROSS' ? 'CROSS' : 'ISOLATED') : globalDefaults.margin_type
  );
  const [positionSizingType, setPositionSizingType] = useState<'PERCENT' | 'FIXED'>(
    initialParams?.position_sizing_type ? (initialParams.position_sizing_type === 'FIXED' ? 'FIXED' : 'PERCENT') : globalDefaults.position_sizing_type
  );
  const [positionSizeValue, setPositionSizeValue] = useState(
    initialParams?.position_size_value || (globalDefaults.position_sizing_type === 'FIXED' ? globalDefaults.position_size_value_fixed : globalDefaults.position_size_value)
  );
  const [limit, setLimit] = useState(500);

  // Histórico Local JSON
  const [useLocalJson, setUseLocalJson] = useState(globalDefaults.use_local_json);
  const [dataDir, setDataDir] = useState(globalDefaults.data_dir || '/mnt/e/datadown/data/monthly/15m');
  const [periodMode, setPeriodMode] = useState<'all' | 'specific' | 'range'>('all');
  const [specificPeriods, setSpecificPeriods] = useState('2021-05,2022-06,2024-10');
  const [startPeriod, setStartPeriod] = useState('2021-01');
  const [endPeriod, setEndPeriod] = useState('2021-12');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRunBacktest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    try {
      const bodyPayload: any = {
        symbol,
        timeframe,
        strategy,
        capital,
        rsi_period: rsiPeriod,
        rsi_low: rsiLow,
        rsi_high: rsiHigh,
        vol_ratio: volRatio,
        donchian_period: donchianPeriod,
        cmf_period: cmfPeriod,
        cmf_threshold: cmfThreshold,
        ema_filter: emaFilter,
        ema_fast: emaFast,
        ema_slow: emaSlow,
        bb_period: bbPeriod,
        bb_std_dev: bbStdDev,
        macd_fast: macdFast,
        macd_slow: macdSlow,
        macd_signal: macdSignal,
        supertrend_period: supertrendPeriod,
        supertrend_multiplier: supertrendMultiplier,
        crt_lookback: crtLookback,
        use_atr_stop: useAtrStop,
        atr_period: atrPeriod,
        atr_multiplier: atrMultiplier,
        use_trailing_stop: useTrailingStop,
        trailing_activation_pct: trailingActivationPct,
        trailing_distance_pct: trailingDistancePct,
        trailing_type: trailingType,
        trailing_atr_mult: trailingAtrMult,
        sl,
        tp,
        leverage,
        margin_type: marginType,
        position_sizing_type: positionSizingType,
        position_size_value: positionSizeValue,
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

      const resp = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });
      const data = await resp.json();
      if (data.success && data.data && !data.data.error) {
        setResult(data.data);
      } else {
        setResult(null);
        setErrorMessage(data.error || data.data?.error || 'Não foi possível carregar os dados do backtest.');
      }
    } catch (error: any) {
      console.error('Erro ao executar backtest:', error);
      setResult(null);
      setErrorMessage(error.message || 'Erro de conexão ao executar backtest.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Form de Parâmetros de Backtest */}
      <form onSubmit={handleRunBacktest} className="bg-zinc-900/50 border border-white/10 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-white flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-indigo-400" />
              Simulador de Backtest Histórico
            </h2>
            <p className="text-[11px] text-slate-400 mt-1 font-sans">
              Testa a estratégia quantitativa em candles históricos reais da Binance Futures ou de arquivos JSON locais.
            </p>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all shadow-[0_0_12px_rgba(99,102,241,0.25)] disabled:opacity-50 cursor-pointer font-mono"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            {loading ? 'SIMULANDO TRADES...' : 'RODAR BACKTEST'}
          </button>
        </div>

        {/* Seleção de Fonte de Dados */}
        <div className="bg-black/40 border border-white/10 rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold font-mono text-slate-200 uppercase tracking-wider">
                Fonte de Dados do Backtest
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono">
              <button
                type="button"
                onClick={() => setUseLocalJson(false)}
                className={`px-3 py-1 rounded text-xs transition-all cursor-pointer border ${
                  !useLocalJson
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 font-bold'
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
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
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
                    Padrão: /mnt/e/datadown/data/monthly/15m
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

        {/* Estratégia e Dados Principais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="lg:col-span-2">
            <label className="text-[10px] text-indigo-300 font-mono font-bold uppercase block mb-1">Estratégia Quantitativa</label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              className="w-full bg-indigo-950/40 border border-indigo-500/30 text-indigo-100 rounded-lg p-2 text-xs font-mono font-bold focus:outline-none focus:border-indigo-500"
            >
              <option value="rsi_volume">RSI + Volume Spike</option>
              <option value="donchian_cmf">Donchian CMF Breakout (Turtle/Chaikin)</option>
              <option value="ema_cross">Cruzamento Média (EMA 9 / EMA 21)</option>
              <option value="bollinger_rsi">Bollinger Bands + RSI Reversão</option>
              <option value="macd_volume">MACD Histogram + Volume Spike</option>
              <option value="supertrend_atr">Supertrend Trend Following</option>
              <option value="crt_sweep">Candle Range Theory (CRT - Liquidity Sweep)</option>
              <option value="po3_trailing">HTF Power of 3 (PO3) + Trailing Stop</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Contrato</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500/60 uppercase font-mono font-bold"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Tempo Gráfico</label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-indigo-500/60"
            >
              <option value="1m">1m</option>
              <option value="5m">5m</option>
              <option value="15m">15m</option>
              <option value="1h">1h</option>
              <option value="4h">4h</option>
              <option value="1d">1d</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Capital ($)</label>
            <input
              type="number"
              value={capital}
              onChange={(e) => setCapital(Number(e.target.value))}
              className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500/60 font-mono"
            />
          </div>

          {strategy === 'rsi_volume' && (
            <>
              <div>
                <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Período RSI</label>
                <input
                  type="number"
                  value={rsiPeriod}
                  onChange={(e) => setRsiPeriod(Number(e.target.value))}
                  className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500/60 font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">RSI Compra</label>
                <input
                  type="number"
                  value={rsiLow}
                  onChange={(e) => setRsiLow(Number(e.target.value))}
                  className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500/60 font-mono text-emerald-400 font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">RSI Venda</label>
                <input
                  type="number"
                  value={rsiHigh}
                  onChange={(e) => setRsiHigh(Number(e.target.value))}
                  className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500/60 font-mono text-rose-400 font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Volume Ratio</label>
                <input
                  type="number"
                  step="0.1"
                  value={volRatio}
                  onChange={(e) => setVolRatio(Number(e.target.value))}
                  className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500/60 font-mono text-amber-300 font-bold"
                />
              </div>
            </>
          )}

          {strategy === 'donchian_cmf' && (
            <>
              <div>
                <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Donchian (N)</label>
                <input
                  type="number"
                  value={donchianPeriod}
                  onChange={(e) => setDonchianPeriod(Number(e.target.value))}
                  className="w-full bg-black/60 border border-white/10 text-emerald-300 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500/60 font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">CMF Período</label>
                <input
                  type="number"
                  value={cmfPeriod}
                  onChange={(e) => setCmfPeriod(Number(e.target.value))}
                  className="w-full bg-black/60 border border-white/10 text-amber-300 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500/60 font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">CMF Threshold</label>
                <input
                  type="number"
                  step="0.01"
                  value={cmfThreshold}
                  onChange={(e) => setCmfThreshold(Number(e.target.value))}
                  className="w-full bg-black/60 border border-white/10 text-cyan-300 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500/60 font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Filtro EMA (0=Off)</label>
                <input
                  type="number"
                  value={emaFilter}
                  onChange={(e) => setEmaFilter(Number(e.target.value))}
                  className="w-full bg-black/60 border border-white/10 text-indigo-300 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500/60 font-mono font-bold"
                />
              </div>
            </>
          )}

          {strategy === 'ema_cross' && (
            <>
              <div>
                <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">EMA Rápida</label>
                <input
                  type="number"
                  value={emaFast}
                  onChange={(e) => setEmaFast(Number(e.target.value))}
                  className="w-full bg-black/60 border border-white/10 text-cyan-300 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500/60 font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">EMA Lenta</label>
                <input
                  type="number"
                  value={emaSlow}
                  onChange={(e) => setEmaSlow(Number(e.target.value))}
                  className="w-full bg-black/60 border border-white/10 text-amber-300 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500/60 font-mono font-bold"
                />
              </div>
            </>
          )}

          {strategy === 'bollinger_rsi' && (
            <>
              <div>
                <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Bollinger Período</label>
                <input
                  type="number"
                  value={bbPeriod}
                  onChange={(e) => setBbPeriod(Number(e.target.value))}
                  className="w-full bg-black/60 border border-white/10 text-purple-300 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500/60 font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">BB Desvio Padrão</label>
                <input
                  type="number"
                  step="0.1"
                  value={bbStdDev}
                  onChange={(e) => setBbStdDev(Number(e.target.value))}
                  className="w-full bg-black/60 border border-white/10 text-pink-300 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500/60 font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">RSI Período</label>
                <input
                  type="number"
                  value={rsiPeriod}
                  onChange={(e) => setRsiPeriod(Number(e.target.value))}
                  className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500/60 font-mono"
                />
              </div>
            </>
          )}

          {strategy === 'macd_volume' && (
            <>
              <div>
                <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">MACD Rápida</label>
                <input
                  type="number"
                  value={macdFast}
                  onChange={(e) => setMacdFast(Number(e.target.value))}
                  className="w-full bg-black/60 border border-white/10 text-cyan-300 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500/60 font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">MACD Lenta</label>
                <input
                  type="number"
                  value={macdSlow}
                  onChange={(e) => setMacdSlow(Number(e.target.value))}
                  className="w-full bg-black/60 border border-white/10 text-amber-300 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500/60 font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">MACD Sinal</label>
                <input
                  type="number"
                  value={macdSignal}
                  onChange={(e) => setMacdSignal(Number(e.target.value))}
                  className="w-full bg-black/60 border border-white/10 text-indigo-300 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500/60 font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Volume Ratio</label>
                <input
                  type="number"
                  step="0.1"
                  value={volRatio}
                  onChange={(e) => setVolRatio(Number(e.target.value))}
                  className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500/60 font-mono font-bold text-amber-300"
                />
              </div>
            </>
          )}

          {strategy === 'supertrend_atr' && (
            <>
              <div>
                <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Supertrend Período</label>
                <input
                  type="number"
                  value={supertrendPeriod}
                  onChange={(e) => setSupertrendPeriod(Number(e.target.value))}
                  className="w-full bg-black/60 border border-white/10 text-emerald-300 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500/60 font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Multiplicador ATR</label>
                <input
                  type="number"
                  step="0.1"
                  value={supertrendMultiplier}
                  onChange={(e) => setSupertrendMultiplier(Number(e.target.value))}
                  className="w-full bg-black/60 border border-white/10 text-amber-300 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500/60 font-mono font-bold"
                />
              </div>
            </>
          )}

          {strategy === 'crt_sweep' && (
            <>
              <div>
                <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">CRT Lookback (Candles)</label>
                <input
                  type="number"
                  value={crtLookback}
                  onChange={(e) => setCrtLookback(Number(e.target.value))}
                  className="w-full bg-black/60 border border-white/10 text-indigo-300 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500/60 font-mono font-bold"
                />
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-2 border-t border-white/5">
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
              className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-indigo-500/60"
            >
              <option value="ISOLATED">Isolada (Isolated)</option>
              <option value="CROSS">Cruzada (Cross)</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Tipo de Dimensionamento</label>
            <select
              value={positionSizingType}
              onChange={(e) => setPositionSizingType(e.target.value as any)}
              className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-indigo-500/60"
            >
              <option value="PERCENT">% do Saldo Total</option>
              <option value="FIXED">Valor Fixo em USDT</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">
              {positionSizingType === 'PERCENT' ? 'Tamanho da Margem (%)' : 'Valor Fixo (USDT)'}
            </label>
            <input
              type="number"
              step="0.5"
              value={positionSizeValue}
              onChange={(e) => setPositionSizeValue(Number(e.target.value))}
              className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-indigo-500/60"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Stop Loss %</label>
            <input
              type="number"
              step="0.1"
              value={sl}
              onChange={(e) => setSl(Number(e.target.value))}
              className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500/60 font-mono"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Take Profit %</label>
            <input
              type="number"
              step="0.1"
              value={tp}
              onChange={(e) => setTp(Number(e.target.value))}
              className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500/60 font-mono"
            />
          </div>
        </div>

        {/* Painel de Trailing Stop Inteligente no Backtest */}
        <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-3.5 space-y-3 mt-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold font-mono text-amber-300 uppercase tracking-wider">
                Trailing Stop Inteligente no Backtest
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

      {/* Mensagem de Erro de Execução / Leitura de Arquivo */}
      {errorMessage && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-200 font-mono space-y-1">
            <span className="font-bold text-rose-300 block uppercase tracking-wider">Falha no Backtest</span>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Resultados do Backtest */}
      {result && (
        <div className="space-y-6">
          {/* Card de Resumo das Métricas */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-zinc-900/60 border border-white/10 rounded-xl p-4">
              <span className="text-[10px] font-mono text-slate-500 block uppercase">P&L Total</span>
              <span
                className={`text-base font-mono font-bold block mt-1 ${
                  (result.total_pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                ${result.total_pnl ?? 0} ({result.total_pnl_pct ?? 0}%)
              </span>
            </div>

            <div className="bg-zinc-900/60 border border-white/10 rounded-xl p-4">
              <span className="text-[10px] font-mono text-slate-500 block uppercase">Win Rate</span>
              <span className="text-base font-mono font-bold text-amber-400 block mt-1">
                {result.win_rate_pct ?? 0}%
              </span>
            </div>

            <div className="bg-zinc-900/60 border border-white/10 rounded-xl p-4">
              <span className="text-[10px] font-mono text-slate-500 block uppercase">Total Trades</span>
              <span className="text-base font-mono font-bold text-slate-200 block mt-1">
                {result.total_trades ?? 0} ({result.winning_trades ?? 0}V / {result.losing_trades ?? 0}D)
              </span>
            </div>

            <div className="bg-zinc-900/60 border border-white/10 rounded-xl p-4">
              <span className="text-[10px] font-mono text-slate-500 block uppercase">Max Drawdown</span>
              <span className="text-base font-mono font-bold text-rose-400 block mt-1">
                {result.max_drawdown_pct ?? 0}%
              </span>
            </div>

            <div className="bg-zinc-900/60 border border-white/10 rounded-xl p-4">
              <span className="text-[10px] font-mono text-slate-500 block uppercase">Fator Lucro</span>
              <span className="text-base font-mono font-bold text-indigo-300 block mt-1">
                {result.profit_factor ?? 0}
              </span>
            </div>

            <div className="bg-zinc-900/60 border border-white/10 rounded-xl p-4">
              <span className="text-[10px] font-mono text-slate-500 block uppercase">Sharpe Ratio</span>
              <span className="text-base font-mono font-bold text-sky-300 block mt-1">
                {result.sharpe_ratio ?? 0}
              </span>
            </div>
          </div>

          {/* Disclaimer de Backtest Teórico */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200/90 leading-relaxed font-mono text-[11px]">
              <span className="font-bold text-amber-400 block mb-0.5 uppercase tracking-wider">Nota de Isenção Teórica:</span>
              {result.disclaimer || 'Simulação teórica baseada no histórico de preços informados.'}
            </div>
          </div>

          {/* Tabela de Histórico de Trades */}
          <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5 shadow-xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Histórico de Trades da Simulação
            </h3>

            {!Array.isArray(result.trades) || result.trades.length === 0 ? (
              <p className="text-slate-500 text-xs py-4 text-center font-mono">Nenhum trade foi disparado pelos critérios no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300 border-collapse font-mono">
                  <thead>
                    <tr className="border-b border-white/10 text-[10px] text-slate-500 uppercase tracking-wider bg-white/[0.01]">
                      <th className="py-2.5 px-3">ID</th>
                      <th className="py-2.5 px-3">Lado</th>
                      <th className="py-2.5 px-3">Entrada</th>
                      <th className="py-2.5 px-3">Saída</th>
                      <th className="py-2.5 px-3">Data Entrada</th>
                      <th className="py-2.5 px-3">P&L ($)</th>
                      <th className="py-2.5 px-3">P&L (%)</th>
                      <th className="py-2.5 px-3">Motivo Saída</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {result.trades.map((t) => (
                      <tr key={t.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-2.5 px-3 text-slate-500">{t.id}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${
                              t.side === 'BUY'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {t.side}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-white">${t.entry_price}</td>
                        <td className="py-2.5 px-3 text-white">${t.exit_price}</td>
                        <td className="py-2.5 px-3 text-slate-400">{t.entry_time}</td>
                        <td
                          className={`py-2.5 px-3 font-bold ${
                            t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          ${t.pnl}
                        </td>
                        <td
                          className={`py-2.5 px-3 font-bold ${
                            t.pnl_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {t.pnl_pct}%
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 font-sans text-[11px]">{t.exit_reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
