import React, { useState } from 'react';
import { Terminal, Play, CornerDownLeft, RefreshCw, Trash2 } from 'lucide-react';

export const CliTerminalTab: React.FC = () => {
  const [commandInput, setCommandInput] = useState('scan --symbols BTCUSDT,ETHUSDT,SOLUSDT --all');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const presets = [
    'scan --symbols BTCUSDT,ETHUSDT,SOLUSDT --all',
    'backtest --symbol BTCUSDT --timeframe 15m --limit 500',
    'optimize --symbol SOLUSDT --top-n 5',
    'trade --status',
    'generate-indicator --prompt "Estratégia RSI e Volume Spike v5"',
  ];

  const handleRunCommand = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commandInput.trim()) return;

    const cmdToRun = commandInput.trim();
    setLoading(true);
    setLogs((prev) => [...prev, `$ python -m futures_agent.main ${cmdToRun}`]);

    try {
      const resp = await fetch('/api/cli/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ args: cmdToRun }),
      });
      const data = await resp.json();
      const output = data.stdout || data.stderr || 'Sem saída de terminal.';
      setLogs((prev) => [...prev, output]);
    } catch (err: any) {
      setLogs((prev) => [...prev, `Erro de execução: ${err.message}`]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3 font-mono">
          <div className="flex items-center gap-3">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-white">Terminal de Linha de Comando (CLI)</h2>
              <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                Execute subcomandos diretamente via <code className="text-emerald-400 font-mono">python3 -m futures_agent.main</code>.
              </p>
            </div>
          </div>
          <button
            onClick={() => setLogs([])}
            className="text-xs bg-white/5 hover:bg-white/10 text-slate-300 px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Limpar Saída
          </button>
        </div>

        {/* Presets de Comandos */}
        <div>
          <span className="text-[10px] text-slate-400 font-mono uppercase block mb-2">Atalhos de Comandos CLI:</span>
          <div className="flex flex-wrap gap-2 font-mono">
            {presets.map((p, idx) => (
              <button
                key={idx}
                onClick={() => setCommandInput(p)}
                className="bg-black/60 hover:bg-white/5 text-emerald-400/90 border border-white/10 text-[11px] px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Form Input do Comando */}
        <form onSubmit={handleRunCommand} className="flex gap-2 font-mono">
          <div className="relative flex-1">
            <span className="absolute left-3 top-2.5 text-xs text-emerald-400 font-bold">$ python -m futures_agent.main</span>
            <input
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              className="w-full bg-black/60 border border-white/10 text-slate-100 rounded-lg pl-64 pr-4 py-2.5 text-xs focus:outline-none focus:border-emerald-500/60"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-bold text-xs px-5 py-2.5 rounded-lg transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            {loading ? 'EXECUTANDO...' : 'EXECUTAR'}
          </button>
        </form>
      </div>

      {/* Janela do Console do Terminal */}
      <div className="bg-black/90 border border-white/10 rounded-xl p-5 shadow-2xl font-mono text-xs text-emerald-400 min-h-[350px] max-h-[600px] overflow-y-auto space-y-3 leading-relaxed">
        {logs.length === 0 ? (
          <p className="text-slate-600 italic">O terminal está pronto. Execute um subcomando acima para visualizar a saída.</p>
        ) : (
          logs.map((log, idx) => (
            <div key={idx} className="whitespace-pre-wrap border-b border-white/5 pb-2">
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
