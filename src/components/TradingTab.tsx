import React, { useState, useEffect } from 'react';
import { PaperState, Order, Position, ClosedPosition } from '../types';
import { loadGlobalSettings } from '../utils/settings';
import {
  Wallet,
  ShieldAlert,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  CheckCircle2,
  Lock,
  XCircle,
  Clock,
  Layers,
  Activity,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Sliders,
  Key,
  AlertCircle
} from 'lucide-react';

interface TradingTabProps {
  initialSymbol?: string;
  initialSide?: 'BUY' | 'SELL';
  initialPrice?: number;
  initialSl?: number;
  initialTp?: number;
  onTradingModeChange?: (mode: 'paper' | 'live') => void;
  onNavigateToSettings?: () => void;
}

export const TradingTab: React.FC<TradingTabProps> = ({
  initialSymbol = 'BTCUSDT',
  initialSide = 'BUY',
  initialPrice = 65000,
  initialSl = 64000,
  initialTp = 67000,
  onTradingModeChange,
  onNavigateToSettings,
}) => {
  const globalDefaults = loadGlobalSettings();

  const [tradingMode, setTradingMode] = useState<'paper' | 'live'>('paper');
  const [showLiveConfirmModal, setShowLiveConfirmModal] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');

  // Tab para histórico (Fechadas vs Logs de Envio)
  const [activeHistoryTab, setActiveHistoryTab] = useState<'closed' | 'logs'>('closed');

  // Form State
  const [symbol, setSymbol] = useState(initialSymbol);
  const [side, setSide] = useState<'BUY' | 'SELL'>(initialSide);
  const [quantity, setQuantity] = useState(0.01);
  const [leverage, setLeverage] = useState(globalDefaults.leverage || 10);
  const [marginType, setMarginType] = useState<'ISOLATED' | 'CROSS'>(globalDefaults.margin_type || 'ISOLATED');
  const [positionSizingType, setPositionSizingType] = useState<'PERCENT' | 'FIXED'>(globalDefaults.position_sizing_type || 'PERCENT');
  const [positionSizeValue, setPositionSizeValue] = useState<number | ''>(
    globalDefaults.position_sizing_type === 'FIXED' ? globalDefaults.position_size_value_fixed : globalDefaults.position_size_value
  );
  const [price, setPrice] = useState<number | ''>('');
  const [slPrice, setSlPrice] = useState<number | ''>(initialSl || '');
  const [tpPrice, setTpPrice] = useState<number | ''>(initialTp || '');
  const [liveSymbolPrice, setLiveSymbolPrice] = useState<number | null>(null);
  const [fetchingSymbolPrice, setFetchingSymbolPrice] = useState(false);

  const fetchCurrentSymbolPrice = async (targetSymbol: string) => {
    if (!targetSymbol) return;
    setFetchingSymbolPrice(true);
    try {
      const resp = await fetch(`/api/price?symbol=${targetSymbol}`);
      if (!resp.ok || !(resp.headers.get('content-type') || '').includes('application/json')) return;
      const data = await resp.json();
      if (data && data.price) {
        setLiveSymbolPrice(data.price);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFetchingSymbolPrice(false);
    }
  };

  useEffect(() => {
    if (symbol) {
      fetchCurrentSymbolPrice(symbol);
    }
  }, [symbol]);

  useEffect(() => {
    if (initialSymbol) setSymbol(initialSymbol);
    if (initialSide) setSide(initialSide);
    if (initialPrice) setPrice(initialPrice);
    if (initialSl) setSlPrice(initialSl);
    if (initialTp) setTpPrice(initialTp);
  }, [initialSymbol, initialSide, initialPrice, initialSl, initialTp]);

  const [loading, setLoading] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [paperState, setPaperState] = useState<PaperState>({
    initial_balance: 10000,
    balance: 10000,
    real_wallet_balance: 1250,
    equity: 10000,
    pnl_usdt: 0,
    pnl_pct: 0,
    open_orders_count: 0,
    max_simultaneous_trades: 3,
    positions: [],
    closed_positions: [],
    history: []
  });

  const [refreshInterval, setRefreshInterval] = useState<number>(globalDefaults.auto_refresh_interval ?? 5);

  const fetchPaperStatus = async () => {
    try {
      const resp = await fetch('/api/trade/status');
      if (!resp.ok || !(resp.headers.get('content-type') || '').includes('application/json')) return;
      const data = await resp.json();
      if (data && data.success) {
        setPaperState(data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchPaperStatus();
    if (refreshInterval > 0) {
      const timer = setInterval(() => {
        fetchPaperStatus();
      }, Math.max(1000, refreshInterval * 1000));
      return () => clearInterval(timer);
    }
  }, [refreshInterval]);

  const handleModeChange = (mode: 'paper' | 'live') => {
    setTradingMode(mode);
    if (onTradingModeChange) {
      onTradingModeChange(mode);
    }
  };

  const handleMaxTradesChange = async (newVal: number) => {
    try {
      const resp = await fetch('/api/trade/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_simultaneous_trades: newVal })
      });
      const data = await resp.json();
      if (data.success && data.data) {
        setPaperState(data.data);
      } else {
        fetchPaperStatus();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetPaper = async () => {
    if (!window.confirm('Tem certeza que deseja resetar a conta simulada para o saldo inicial de $10.000?')) return;
    try {
      await fetch('/api/trade/reset', { method: 'POST' });
      fetchPaperStatus();
    } catch (e) {
      console.error(e);
    }
  };

  const handleClosePosition = async (posId: string) => {
    if (!window.confirm(`Deseja encenar/fechar a posição ${posId} a preço de mercado?`)) return;
    setClosingId(posId);
    try {
      const resp = await fetch('/api/trade/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: posId })
      });
      const data = await resp.json();
      if (data.success && data.data) {
        setPaperState(data.data);
      } else {
        alert(`Erro ao fechar posição: ${data.error}`);
        fetchPaperStatus();
      }
    } catch (err: any) {
      alert(`Falha ao encerar posição: ${err.message}`);
    } finally {
      setClosingId(null);
    }
  };

  const handleSendOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tradingMode === 'live') {
      setShowLiveConfirmModal(true);
      return;
    }
    await executeOrderRequest(false);
  };

  const executeOrderRequest = async (isLiveConfirmed: boolean) => {
    setLoading(true);
    try {
      const resp = await fetch('/api/trade/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          side,
          quantity,
          leverage,
          margin_type: marginType,
          position_sizing_type: positionSizingType,
          position_size_value: positionSizeValue !== '' ? Number(positionSizeValue) : null,
          price: price ? Number(price) : null,
          sl: slPrice ? Number(slPrice) : null,
          tp: tpPrice ? Number(tpPrice) : null,
          is_live: tradingMode === 'live',
          confirmed: isLiveConfirmed,
        }),
      });
      const data = await resp.json();
      if (data.success) {
        alert(`Ordem executada com sucesso! ID: ${data.data?.order_id || 'OK'}`);
        fetchPaperStatus();
      } else {
        alert(`Erro na ordem: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Falha no envio da ordem: ${err.message}`);
    } finally {
      setLoading(false);
      setShowLiveConfirmModal(false);
      setConfirmInput('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner de Aviso de API no Modo Live */}
      {tradingMode === 'live' && !paperState.api_connected && (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-200 font-mono text-xs shadow-lg animate-fade-in">
          <div className="flex items-start sm:items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <span className="font-bold text-amber-300">Modo Live Selecionado sem API Conectada:</span>
              <p className="text-[11px] text-amber-200/80 font-normal mt-0.5">
                Insira sua API Key e Secret Key da Binance Futures na aba Configurações para carregar o saldo real atualizado da sua carteira e liberar execuções em tempo real.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (onNavigateToSettings) {
                onNavigateToSettings();
              }
            }}
            className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Key className="w-3.5 h-3.5" />
            <span>Configurar Chaves API</span>
          </button>
        </div>
      )}

      {/* Cards de Métricas e Saldos (4 Colunas) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Saldo Ativo & Carteira Real */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4 shadow-xl flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-400 block uppercase tracking-wider">
              {tradingMode === 'live' ? 'Saldo Binance Futures (Live)' : 'Saldo Virtual (Paper)'}
            </span>
            {tradingMode === 'paper' ? (
              <button
                onClick={handleResetPaper}
                className="text-[9px] font-mono font-bold bg-white/5 hover:bg-white/10 text-slate-300 px-2 py-0.5 rounded border border-white/10 cursor-pointer transition-all"
                title="Resetar banca simulada para $10.000"
              >
                RESETAR
              </button>
            ) : (
              <span className={`flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                paperState.api_connected
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${paperState.api_connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                {paperState.api_connected ? 'API CONECTADA' : 'SEM API'}
              </span>
            )}
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-400 font-mono">
                {tradingMode === 'live' ? 'Carteira Real:' : 'Banca Simulado:'}
              </span>
              <span className={`text-lg font-mono font-bold ${tradingMode === 'live' ? 'text-emerald-400' : 'text-white'}`}>
                ${tradingMode === 'live'
                  ? (paperState.real_wallet_balance ?? 0.0).toFixed(2)
                  : (paperState.balance ?? paperState.initial_balance ?? 10000).toFixed(2)} USDT
              </span>
            </div>
            <div className="flex items-baseline justify-between mt-1 pt-1 border-t border-white/5">
              <span className="text-[10px] text-slate-500 font-mono">
                {tradingMode === 'live' ? 'Simulado (Paper):' : 'Binance Real:'}
              </span>
              <span className="text-xs font-mono font-medium text-slate-400">
                ${tradingMode === 'live'
                  ? (paperState.balance ?? 10000).toFixed(2)
                  : (paperState.real_wallet_balance ?? 0.0).toFixed(2)} USDT
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Saldo Equity & PnL Geral */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4 shadow-xl flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-400 block uppercase tracking-wider">Saldo Equity & PnL</span>
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div>
            <span className="text-xl font-mono font-bold text-white block">
              ${paperState.equity?.toFixed(2)} <span className="text-xs font-normal text-slate-400">USDT</span>
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs font-mono font-bold flex items-center gap-0.5 ${paperState.pnl_usdt >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {paperState.pnl_usdt >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {paperState.pnl_usdt >= 0 ? '+' : ''}${paperState.pnl_usdt?.toFixed(2)}
              </span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${paperState.pnl_pct >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                {paperState.pnl_pct >= 0 ? '+' : ''}{paperState.pnl_pct?.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Ordens Abertas & Quantidade Simultânea */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4 shadow-xl flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-400 block uppercase tracking-wider">Ordens Abertas</span>
            <Layers className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-mono font-bold text-amber-400">
                {paperState.open_orders_count || paperState.positions?.length || 0}
              </span>
              <span className="text-xs font-mono text-slate-500">
                / {paperState.max_simultaneous_trades || 3} ativas
              </span>
            </div>

            <div className="flex items-center justify-between mt-2 pt-1 border-t border-white/5">
              <label className="text-[10px] font-mono text-slate-400 uppercase">Max Simultâneos:</label>
              <select
                value={paperState.max_simultaneous_trades || 3}
                onChange={(e) => handleMaxTradesChange(Number(e.target.value))}
                className="bg-black/80 border border-amber-500/30 text-amber-300 font-mono font-bold text-xs rounded px-1.5 py-0.5 focus:outline-none cursor-pointer"
              >
                <option value={1}>1 Trade</option>
                <option value={2}>2 Trades</option>
                <option value={3}>3 Trades</option>
                <option value={5}>5 Trades</option>
                <option value={10}>10 Trades</option>
              </select>
            </div>
          </div>
        </div>

        {/* Card 4: Seletor de Modo de Execução */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4 shadow-xl flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-400 block uppercase tracking-wider">Modo de Execução</span>
            <button
              onClick={fetchPaperStatus}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Atualizar Saldos e Cotações"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <div>
            <span
              className={`text-[10px] font-mono font-bold block mb-2 px-2 py-0.5 rounded text-center tracking-wider ${
                tradingMode === 'paper'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/30 animate-pulse'
              }`}
            >
              {tradingMode === 'paper' ? 'PAPER TRADING (SIMULADO)' : 'LIVE TRADING (REAL)'}
            </span>

            <div className="grid grid-cols-2 gap-1.5 font-mono">
              <button
                onClick={() => handleModeChange('paper')}
                className={`py-1 rounded text-xs font-semibold cursor-pointer border text-center transition-all ${
                  tradingMode === 'paper'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                    : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                }`}
              >
                Paper
              </button>
              <button
                onClick={() => handleModeChange('live')}
                className={`py-1 rounded text-xs font-semibold cursor-pointer flex items-center justify-center gap-1 border transition-all ${
                  tradingMode === 'live'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold'
                    : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                }`}
              >
                <Lock className="w-3 h-3" />
                Live
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Form de Execução de Ordem Manual */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5 shadow-xl space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-white flex items-center gap-2 font-mono">
          <Wallet className="w-4 h-4 text-emerald-400" />
          Envio Manual de Ordem ({tradingMode === 'paper' ? 'Paper Trading' : 'Live Real'})
        </h2>

        <form onSubmit={handleSendOrder} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-slate-400 font-mono uppercase block">Contrato</label>
              {liveSymbolPrice && (
                <span className="text-[10px] font-mono font-bold text-amber-400">
                  ${liveSymbolPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                </span>
              )}
            </div>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs font-mono font-bold uppercase focus:outline-none focus:border-emerald-500/60"
              required
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Lado</label>
            <select
              value={side}
              onChange={(e) => setSide(e.target.value as any)}
              className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs font-mono font-bold focus:outline-none focus:border-emerald-500/60"
            >
              <option value="BUY">COMPRAR (LONG)</option>
              <option value="SELL">VENDER (SHORT)</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Quantidade</label>
            <input
              type="number"
              step="0.001"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-emerald-500/60"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-slate-400 font-mono uppercase block">Preço Limit (Opcional)</label>
              {liveSymbolPrice && (
                <button
                  type="button"
                  onClick={() => setPrice(liveSymbolPrice)}
                  className="text-[9px] font-mono text-emerald-400 hover:underline cursor-pointer"
                  title="Usar preço atual de mercado"
                >
                  USAR ATUAL
                </button>
              )}
            </div>
            <input
              type="number"
              step="0.01"
              placeholder="Mercado"
              value={price}
              onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-emerald-500/60 placeholder-slate-600"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Stop Loss ($)</label>
            <input
              type="number"
              step="0.01"
              value={slPrice}
              onChange={(e) => setSlPrice(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs font-mono text-rose-400 focus:outline-none focus:border-rose-500/60"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Take Profit ($)</label>
            <input
              type="number"
              step="0.01"
              value={tpPrice}
              onChange={(e) => setTpPrice(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500/60"
            />
          </div>

          <div className="md:col-span-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-white/5">
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
                className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-emerald-500/60"
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
                className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-emerald-500/60"
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
                onChange={(e) => setPositionSizeValue(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-emerald-500/60"
              />
            </div>
          </div>

          <div className="md:col-span-6 flex items-center justify-between pt-2">
            <span className="text-[11px] font-mono text-amber-400/80">
              {paperState.positions?.length >= (paperState.max_simultaneous_trades || 3) && (
                <span>⚠️ Limite máximo de trades simultâneos atingido ({paperState.positions.length}/{paperState.max_simultaneous_trades}).</span>
              )}
            </span>

            <button
              type="submit"
              disabled={loading || paperState.positions?.length >= (paperState.max_simultaneous_trades || 3)}
              className={`px-5 py-2 rounded-lg text-xs font-bold font-mono text-white transition-all shadow-md cursor-pointer tracking-wider disabled:opacity-40 disabled:cursor-not-allowed ${
                side === 'BUY'
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                  : 'bg-rose-600 hover:bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.25)]'
              }`}
            >
              {loading ? 'PROCESSANDO ORDEM...' : `ENVIAR ORDEM ${side} (${tradingMode.toUpperCase()})`}
            </button>
          </div>
        </form>
      </div>

      {/* Tabela de Ordens / Posições Abertas */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-white font-mono">
              Ordens e Posições Abertas
            </h3>
            <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-bold">
              {paperState.positions?.length || 0} de {paperState.max_simultaneous_trades || 3} max
            </span>
          </div>

          <button
            onClick={fetchPaperStatus}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-mono cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            Atualizar Cotações
          </button>
        </div>

        {paperState.positions?.length === 0 ? (
          <div className="py-8 text-center space-y-1">
            <p className="text-xs text-slate-500 font-mono">Nenhuma posição aberta no momento.</p>
            <p className="text-[11px] text-slate-600 font-mono">Envie uma ordem manual acima ou ative o robô para abrir ordens automáticas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 border-collapse font-mono">
              <thead>
                <tr className="border-b border-white/10 text-[10px] text-slate-400 uppercase tracking-wider bg-white/[0.01]">
                  <th className="py-2.5 px-3">ID</th>
                  <th className="py-2.5 px-3">Modo</th>
                  <th className="py-2.5 px-3">Símbolo</th>
                  <th className="py-2.5 px-3">Lado</th>
                  <th className="py-2.5 px-3">Preço Entrada</th>
                  <th className="py-2.5 px-3">Preço Atual</th>
                  <th className="py-2.5 px-3">PnL (USDT)</th>
                  <th className="py-2.5 px-3">PnL (%)</th>
                  <th className="py-2.5 px-3">Data / Hora</th>
                  <th className="py-2.5 px-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {paperState.positions.map((pos) => {
                  const pnlUsdt = pos.pnl_usdt ?? 0;
                  const pnlPct = pos.pnl_pct ?? 0;
                  const isProfitable = pnlUsdt >= 0;

                  return (
                    <tr key={pos.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{pos.id}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${pos.mode === 'LIVE' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'}`}>
                          {pos.mode || 'PAPER'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-white">{pos.symbol}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${
                            pos.side === 'LONG'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {pos.side}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-200">${Number(pos.entry_price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                      <td className="py-2.5 px-3 text-amber-300 font-bold">${Number(pos.current_price || pos.entry_price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                      <td className={`py-2.5 px-3 font-bold ${isProfitable ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfitable ? '+' : ''}${pnlUsdt.toFixed(2)}
                      </td>
                      <td className={`py-2.5 px-3 font-bold ${isProfitable ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfitable ? '+' : ''}{pnlPct.toFixed(2)}%
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">{pos.time}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleClosePosition(pos.id)}
                          disabled={closingId === pos.id}
                          className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition-all disabled:opacity-50"
                        >
                          {closingId === pos.id ? 'FECHANDO...' : 'FECHAR POSIÇÃO'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Histórico: Ordens Fechadas e Logs de Envio */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-indigo-400" />
            <div className="flex items-center gap-2 bg-black/50 p-1 rounded-lg border border-white/5 font-mono">
              <button
                onClick={() => setActiveHistoryTab('closed')}
                className={`px-3 py-1 rounded text-xs font-bold cursor-pointer transition-all ${
                  activeHistoryTab === 'closed'
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Ordens Fechadas ({paperState.closed_positions?.length || 0})
              </button>
              <button
                onClick={() => setActiveHistoryTab('logs')}
                className={`px-3 py-1 rounded text-xs font-bold cursor-pointer transition-all ${
                  activeHistoryTab === 'logs'
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Log Geral de Envios ({paperState.history?.length || 0})
              </button>
            </div>
          </div>
        </div>

        {activeHistoryTab === 'closed' ? (
          paperState.closed_positions?.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center font-mono">Nenhuma ordem fechada registrada ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300 border-collapse font-mono">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] text-slate-400 uppercase tracking-wider bg-white/[0.01]">
                    <th className="py-2.5 px-3">ID</th>
                    <th className="py-2.5 px-3">Modo</th>
                    <th className="py-2.5 px-3">Símbolo</th>
                    <th className="py-2.5 px-3">Lado</th>
                    <th className="py-2.5 px-3">Entrada</th>
                    <th className="py-2.5 px-3">Saída</th>
                    <th className="py-2.5 px-3">PnL (USDT)</th>
                    <th className="py-2.5 px-3">PnL (%)</th>
                    <th className="py-2.5 px-3">Motivo Encerramento</th>
                    <th className="py-2.5 px-3">Data Fechamento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {paperState.closed_positions.map((cp) => {
                    const isWin = cp.pnl_usdt >= 0;
                    return (
                      <tr key={cp.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">{cp.id}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${cp.mode === 'LIVE' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'}`}>
                            {cp.mode || 'PAPER'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-white">{cp.symbol}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${
                              cp.side === 'LONG'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {cp.side}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">${cp.entry_price}</td>
                        <td className="py-2.5 px-3 text-white font-bold">${cp.exit_price}</td>
                        <td className={`py-2.5 px-3 font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isWin ? '+' : ''}${cp.pnl_usdt?.toFixed(2)}
                        </td>
                        <td className={`py-2.5 px-3 font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isWin ? '+' : ''}{cp.pnl_pct?.toFixed(2)}%
                        </td>
                        <td className="py-2.5 px-3 text-amber-300 font-bold text-[10px]">
                          {cp.exit_reason || 'MANUAL_CLOSE'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px]">{cp.exit_time || cp.time}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          paperState.history?.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center font-mono">Nenhum log de envio registrado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300 border-collapse font-mono">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] text-slate-400 uppercase tracking-wider bg-white/[0.01]">
                    <th className="py-2.5 px-3">ID Ordem</th>
                    <th className="py-2.5 px-3">Modo</th>
                    <th className="py-2.5 px-3">Símbolo</th>
                    <th className="py-2.5 px-3">Lado</th>
                    <th className="py-2.5 px-3">Preço</th>
                    <th className="py-2.5 px-3">Qtd</th>
                    <th className="py-2.5 px-3">Data</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {paperState.history.map((ord) => (
                    <tr key={ord.order_id} className="hover:bg-white/5 transition-colors">
                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">{ord.order_id}</td>
                      <td className="py-2.5 px-3 font-bold text-indigo-300">{ord.mode}</td>
                      <td className="py-2.5 px-3 font-bold text-white">{ord.symbol}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${
                            ord.side === 'BUY'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {ord.side}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-white">${ord.price}</td>
                      <td className="py-2.5 px-3">{ord.quantity}</td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">{ord.timestamp}</td>
                      <td className="py-2.5 px-3 font-bold text-emerald-400">{ord.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Modal de Confirmação Obrigatória para Execução Real */}
      {showLiveConfirmModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-950 border border-rose-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <ShieldAlert className="w-7 h-7 shrink-0" />
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">Confirmação de Execução Real</h3>
                <p className="text-[11px] text-rose-300 font-mono">Esta ordem será enviada para a Binance Futures em modo REAL!</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-mono text-[11px]">
              Digite <span className="font-bold text-amber-400">CONFIRMAR</span> no campo abaixo:
            </p>

            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder="Digite CONFIRMAR"
              className="w-full bg-black/60 border border-white/10 text-slate-100 rounded-lg p-2.5 text-xs font-mono font-bold text-center uppercase focus:outline-none focus:border-rose-500"
            />

            <div className="flex justify-end gap-2 pt-2 font-mono">
              <button
                onClick={() => {
                  setShowLiveConfirmModal(false);
                  setConfirmInput('');
                }}
                className="bg-white/5 hover:bg-white/10 text-slate-300 text-xs px-4 py-2 rounded-lg border border-white/10 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                disabled={confirmInput !== 'CONFIRMAR'}
                onClick={() => executeOrderRequest(true)}
                className="bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer shadow-[0_0_12px_rgba(244,63,94,0.3)]"
              >
                Confirmar Ordem Real
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
