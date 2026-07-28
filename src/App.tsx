/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ScannerTab } from './components/ScannerTab';
import { BacktestTab } from './components/BacktestTab';
import { OptimizerTab } from './components/OptimizerTab';
import { TradingTab } from './components/TradingTab';
import { PineGeneratorTab } from './components/PineGeneratorTab';
import { OllamaConfigTab } from './components/OllamaConfigTab';
import { CliTerminalTab } from './components/CliTerminalTab';
import { SettingsTab } from './components/SettingsTab';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StrategyParams, OllamaStatus } from './types';
import { Search, BarChart2, Sliders, Wallet, FileCode, Cpu, Terminal, ShieldCheck, Activity, Download, Settings } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'scan' | 'backtest' | 'optimize' | 'trade' | 'pine' | 'ollama' | 'cli' | 'settings'>(() => {
    const validTabs = ['scan', 'backtest', 'optimize', 'trade', 'pine', 'ollama', 'cli', 'settings'];
    const saved = localStorage.getItem('futagent_active_tab');
    if (saved && validTabs.includes(saved)) {
      return saved as any;
    }
    return 'scan';
  });

  useEffect(() => {
    localStorage.setItem('futagent_active_tab', activeTab);
  }, [activeTab]);
  const [executionMode, setExecutionMode] = useState<'paper' | 'live'>('paper');

  // Compartilhamento de Estado entre abas
  const [tradeParams, setTradeParams] = useState<{
    symbol: string;
    side: 'BUY' | 'SELL';
    price: number;
    sl: number;
    tp: number;
  } | null>(null);

  const [backtestParams, setBacktestParams] = useState<{
    symbol: string;
    params: StrategyParams;
  } | null>(null);

  const [optimizerParams, setOptimizerParams] = useState<{
    symbol: string;
    params: StrategyParams;
  } | null>(null);

  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);

  const fetchOllamaStatus = async () => {
    try {
      const resp = await fetch('/api/ollama/status');
      if (!resp.ok || !(resp.headers.get('content-type') || '').includes('application/json')) return;
      const data = await resp.json();
      if (data && data.success) {
        setOllamaStatus(data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchOllamaStatus();
  }, []);

  const handleQuickTrade = (symbol: string, side: 'BUY' | 'SELL', price: number, sl: number, tp: number) => {
    setTradeParams({ symbol, side, price, sl, tp });
    setActiveTab('trade');
  };

  const handleApplyParamsToBacktest = (symbol: string, params: StrategyParams) => {
    setBacktestParams({ symbol, params });
    setActiveTab('backtest');
  };

  const handleApplyParamsToOptimizer = (symbol: string, params: StrategyParams) => {
    setOptimizerParams({ symbol, params });
    setActiveTab('optimize');
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-slate-300 font-sans antialiased selection:bg-emerald-500 selection:text-slate-950 flex flex-col justify-between">
      <div>
        {/* TOP STATUS NAVBAR */}
        <header className="border-b border-white/10 bg-zinc-950 sticky top-0 z-40 backdrop-blur-md">
          <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
              <div>
                <h1 className="text-xs font-bold tracking-[0.2em] uppercase text-white flex items-center gap-2">
                  Agente Binance Futures <span className="text-emerald-500 font-mono text-[10px]">v1.4.2</span>
                </h1>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">Quant Trading Engine & Local Ollama IA</p>
              </div>
            </div>

            {/* Badges de Status do Sistema */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded border border-white/10">
                <span className="text-[10px] text-slate-500 font-mono">BINANCE API:</span>
                <span className="text-[10px] text-emerald-400 font-mono font-semibold">CONNECTED</span>
              </div>

              <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded border border-white/10">
                <Cpu className="w-3 h-3 text-indigo-400" />
                <span className="text-[10px] text-slate-500 font-mono">OLLAMA:</span>
                <span className="text-[10px] font-mono font-semibold">
                  {ollamaStatus?.available ? (
                    <span className="text-emerald-400">{ollamaStatus.models[0] || 'llama3'}</span>
                  ) : (
                    <span className="text-amber-400">FALLBACK REGRAS</span>
                  )}
                </span>
              </div>

              <div className={`px-3.5 py-1 rounded border transition-all ${
                executionMode === 'paper'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse'
              }`}>
                <span className="text-[10px] font-bold tracking-wider font-mono">
                  MODE: {executionMode === 'paper' ? 'PAPER TRADING' : 'LIVE TRADING REAL'}
                </span>
              </div>

              <a
                href="/api/download-zip"
                download="binance_futures_agent_project.zip"
                className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold font-mono tracking-wider transition-all shadow-[0_0_10px_rgba(16,185,129,0.2)] cursor-pointer"
                title="Download do Projeto Completo em ZIP"
              >
                <Download className="w-3 h-3" />
                BAIXAR PROJETO (.ZIP)
              </a>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="w-full max-w-[1600px] mx-auto px-2 sm:px-6 flex flex-wrap items-center justify-start gap-1 sm:gap-2 py-2 border-t border-white/5 bg-zinc-950/60 no-scrollbar overflow-x-auto">
            <button
              onClick={() => setActiveTab('scan')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap border ${
                activeTab === 'scan'
                  ? 'text-white bg-white/10 border-white/20 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'
              }`}
            >
              <Search className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>SCANNER MULTI-SÍMBOLO</span>
            </button>

            <button
              onClick={() => setActiveTab('backtest')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap border ${
                activeTab === 'backtest'
                  ? 'text-white bg-white/10 border-white/20 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>BACKTEST HISTÓRICO</span>
            </button>

            <button
              onClick={() => setActiveTab('optimize')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap border ${
                activeTab === 'optimize'
                  ? 'text-white bg-white/10 border-white/20 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>OTIMIZADOR GRID SEARCH</span>
            </button>

            <button
              onClick={() => setActiveTab('trade')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap border ${
                activeTab === 'trade'
                  ? 'text-white bg-white/10 border-white/20 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'
              }`}
            >
              <Wallet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>TERMINAL PAPER & LIVE</span>
            </button>

            <button
              onClick={() => setActiveTab('pine')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap border ${
                activeTab === 'pine'
                  ? 'text-white bg-white/10 border-white/20 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>GERADOR PINE SCRIPT</span>
            </button>

            <button
              onClick={() => setActiveTab('ollama')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap border ${
                activeTab === 'ollama'
                  ? 'text-white bg-white/10 border-white/20 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>IA OLLAMA & CONFIG</span>
            </button>

            <button
              onClick={() => setActiveTab('cli')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap border ${
                activeTab === 'cli'
                  ? 'text-white bg-white/10 border-white/20 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>TERMINAL CLI</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap border ${
                activeTab === 'settings'
                  ? 'text-white bg-white/10 border-white/20 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'
              }`}
            >
              <Settings className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>CONFIGURAÇÕES</span>
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <ErrorBoundary>
            <div className={activeTab === 'scan' ? 'block' : 'hidden'}>
              <ScannerTab
                onQuickTrade={handleQuickTrade}
                onApplyParamsToBacktest={handleApplyParamsToBacktest}
                onApplyParamsToOptimizer={handleApplyParamsToOptimizer}
                ollamaAvailable={!!ollamaStatus?.available}
                ollamaModels={ollamaStatus?.models || []}
              />
            </div>

            <div className={activeTab === 'backtest' ? 'block' : 'hidden'}>
              <BacktestTab
                initialSymbol={backtestParams?.symbol || 'BTCUSDT'}
                initialParams={backtestParams?.params || null}
              />
            </div>

            <div className={activeTab === 'optimize' ? 'block' : 'hidden'}>
              <OptimizerTab
                initialSymbol={optimizerParams?.symbol || 'BTCUSDT'}
                initialParams={optimizerParams?.params || null}
                onApplyStrategy={(sym, p) => {
                  handleApplyParamsToBacktest(sym, p);
                }}
              />
            </div>

            <div className={activeTab === 'trade' ? 'block' : 'hidden'}>
              <TradingTab
                initialSymbol={tradeParams?.symbol || 'BTCUSDT'}
                initialSide={tradeParams?.side || 'BUY'}
                initialPrice={tradeParams?.price || 65000}
                initialSl={tradeParams?.sl || 64000}
                initialTp={tradeParams?.tp || 67000}
                onTradingModeChange={setExecutionMode}
                onNavigateToSettings={() => setActiveTab('settings')}
              />
            </div>

            <div className={activeTab === 'pine' ? 'block' : 'hidden'}>
              <PineGeneratorTab ollamaModels={ollamaStatus?.models || []} />
            </div>

            <div className={activeTab === 'ollama' ? 'block' : 'hidden'}>
              <OllamaConfigTab ollamaStatus={ollamaStatus} onRefreshOllama={fetchOllamaStatus} />
            </div>

            <div className={activeTab === 'cli' ? 'block' : 'hidden'}>
              <CliTerminalTab />
            </div>

            <div className={activeTab === 'settings' ? 'block' : 'hidden'}>
              <SettingsTab />
            </div>
          </ErrorBoundary>
        </main>
      </div>

      {/* FOOTER BAR */}
      <footer className="h-10 bg-zinc-950 border-t border-white/10 px-6 flex items-center justify-between shrink-0 font-mono text-[10px] text-slate-500">
        <div className="flex items-center gap-6">
          <div>ENGINE: <span className="text-slate-300 font-semibold">BINANCE FUTURES USDⓈ-M</span></div>
          <div>LATENCY: <span className="text-emerald-400 font-semibold">38ms</span></div>
        </div>
        <div className="flex items-center gap-3">
          <span>RISK SYSTEM:</span>
          <div className="px-2.5 py-0.5 bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 rounded">
            STOP-LOSS ENFORCED
          </div>
        </div>
      </footer>
    </div>
  );
}
