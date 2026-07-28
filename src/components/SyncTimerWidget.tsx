import React, { useEffect, useState } from 'react';
import { Clock, RefreshCw, Activity, ShieldCheck } from 'lucide-react';
import { getCandleCountdown, getPriceTickSync, CandleCountdownInfo, PriceTickSyncInfo } from '../utils/timeSync';

interface SyncTimerWidgetProps {
  timeframe: string;
  refreshInterval: number;
  onCandleCloseTrigger?: () => void;
  onPriceTickTrigger?: () => void;
  loading?: boolean;
  compact?: boolean;
}

export const SyncTimerWidget: React.FC<SyncTimerWidgetProps> = ({
  timeframe,
  refreshInterval,
  onCandleCloseTrigger,
  onPriceTickTrigger,
  loading = false,
  compact = false,
}) => {
  const [candleInfo, setCandleInfo] = useState<CandleCountdownInfo>(() =>
    getCandleCountdown(timeframe)
  );
  const [priceSync, setPriceSync] = useState<PriceTickSyncInfo>(() =>
    getPriceTickSync(refreshInterval)
  );

  useEffect(() => {
    let lastSecond = -1;

    const interval = setInterval(() => {
      const now = Date.now();
      const currentSec = Math.floor(now / 1000);

      // Evita execuções duplicadas no mesmo segundo
      if (currentSec === lastSecond) return;
      lastSecond = currentSec;

      const newCandleInfo = getCandleCountdown(timeframe, now);
      const newPriceSync = getPriceTickSync(refreshInterval, now);

      setCandleInfo(newCandleInfo);
      setPriceSync(newPriceSync);

      // Gatilho de Fechamento da Vela para Análise de Estratégia
      if (newCandleInfo.isCandleClose && onCandleCloseTrigger) {
        onCandleCloseTrigger();
      }

      // Gatilho de Tick de Preço Sequencial
      if (newPriceSync.isTickBoundary && onPriceTickTrigger) {
        onPriceTickTrigger();
      }
    }, 500); // 500ms polling para precisão sub-segundo no relógio

    return () => clearInterval(interval);
  }, [timeframe, refreshInterval, onCandleCloseTrigger, onPriceTickTrigger]);

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
        <div className="flex items-center gap-1.5 bg-zinc-950/80 border border-emerald-500/30 px-2.5 py-1 rounded-lg text-emerald-300">
          <Clock className="w-3 h-3 text-emerald-400" />
          <span>Vela ({timeframe}):</span>
          <span className="font-bold text-white">{candleInfo.formattedTime}</span>
        </div>
        {refreshInterval > 0 && (
          <div className="flex items-center gap-1.5 bg-zinc-950/80 border border-cyan-500/30 px-2.5 py-1 rounded-lg text-cyan-300">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-amber-400' : 'text-cyan-400'}`} />
            <span>Preço ({refreshInterval}s):</span>
            <span className="font-bold text-white">{priceSync.formattedTime}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-black border border-emerald-500/25 rounded-xl p-4 shadow-xl space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
            Sincronização de Tempo & Estratégia (Timeframe {timeframe})
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
          <ShieldCheck className="w-3 h-3" />
          <span>Análise Técnica: Somente no Fechamento do Candle</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Painel do Fechamento da Vela */}
        <div className="bg-black/50 border border-emerald-500/20 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-300 font-mono flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              Fechamento da Vela ({timeframe})
            </span>
            <span className="text-sm font-bold font-mono text-emerald-400">
              {candleInfo.formattedTime}
            </span>
          </div>

          {/* Barra de Progresso da Vela */}
          <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden border border-white/5">
            <div
              className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full transition-all duration-500 rounded-full"
              style={{ width: `${candleInfo.percentProgress.toFixed(1)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-slate-400">
            <span>Início do Candle</span>
            <span>{candleInfo.percentProgress.toFixed(0)}% concluído</span>
            <span>Fechamento (:00s)</span>
          </div>
        </div>

        {/* Painel da Atualização Sequencial de Preço */}
        <div className="bg-black/50 border border-cyan-500/20 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-300 font-mono flex items-center gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
              Preço Sequencial ({refreshInterval > 0 ? `${refreshInterval}s` : 'Manual'})
            </span>
            <span className="text-sm font-bold font-mono text-cyan-400">
              {refreshInterval > 0 ? `em ${priceSync.formattedTime}` : 'Pausado'}
            </span>
          </div>

          <div className="text-[10px] font-mono text-slate-400 bg-zinc-950/60 p-1.5 rounded border border-white/5">
            {refreshInterval > 0 ? (
              <span>
                Pontos de sincronia no minuto:{' '}
                <span className="text-cyan-300 font-bold">{priceSync.syncPointsText}</span>
              </span>
            ) : (
              <span className="text-slate-500">
                Apenas atualização manual ativada.
              </span>
            )}
          </div>
          <div className="text-[10px] font-mono text-slate-400">
            Atualização contínua de cotações em tempo real sem distorcer o sinal oficial da vela.
          </div>
        </div>
      </div>
    </div>
  );
};
