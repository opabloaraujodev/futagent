import React, { useState } from 'react';
import { FileCode, Sparkles, Copy, Download, Check, RefreshCw } from 'lucide-react';

interface PineGeneratorTabProps {
  ollamaModels: string[];
}

export const PineGeneratorTab: React.FC<PineGeneratorTabProps> = ({ ollamaModels }) => {
  const [prompt, setPrompt] = useState(
    'Estratégia de cruzamento de RSI (14) com filtro de Volume Spike e pivôs de suporte/resistência para Binance Futures'
  );
  const [model, setModel] = useState('llama3');

  const [loading, setLoading] = useState(false);
  const [generatedPine, setGeneratedPine] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const presets = [
    'Estratégia HTF Power of 3 (PO3) com Trailing Stop e Fases de Acumulação/Manipulação/Distribuição',
    'Estratégia Donchian CMF Breakout (Canal de 20 períodos + Chaikin Money Flow > 0.05 + EMA 200 + Stop ATR)',
    'Estratégia de RSI e Volume Spike para scalp 5m',
    'Rompimento de suporte e resistência com filtro ATR e Stop Móvel',
    'Indicador visual de Divergência de RSI e Picos de Volume',
  ];

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const resp = await fetch('/api/generate-pine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model }),
      });
      if (!resp.ok || !(resp.headers.get('content-type') || '').includes('application/json')) return;
      const data = await resp.json();
      if (data.success) {
        setGeneratedPine(data.data.pine_code || '');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!generatedPine) return;
    navigator.clipboard.writeText(generatedPine);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!generatedPine) return;
    const blob = new Blob([generatedPine], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'agente_futures_strategy.pine';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Form de Prompt */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-white flex items-center gap-2 font-mono">
              <FileCode className="w-4 h-4 text-sky-400" />
              Gerador de Pine Script v5 (TradingView)
            </h2>
            <p className="text-[11px] text-slate-400 mt-1 font-sans">
              Descreva sua estratégia em linguagem natural para gerar código v5 pronto para uso ou exportar em arquivo <code className="text-sky-400 font-mono">.pine</code>.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {ollamaModels.length > 0 && (
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="bg-black/60 border border-white/10 text-xs font-mono text-slate-200 rounded-lg p-2 focus:outline-none focus:border-sky-500/60"
              >
                {ollamaModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => handleGenerate()}
              disabled={loading}
              className="flex items-center gap-2 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 px-4 py-2 rounded-lg text-xs font-semibold font-mono tracking-wide transition-all shadow-[0_0_12px_rgba(56,189,248,0.15)] disabled:opacity-50 cursor-pointer"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {loading ? 'GERANDO PINE SCRIPT...' : 'GERAR CÓDIGO .PINE'}
            </button>
          </div>
        </div>

        {/* Presets Rápidos */}
        <div>
          <span className="text-[10px] text-slate-400 font-mono uppercase block mb-2">Prompts de Exemplo Rápidos:</span>
          <div className="flex flex-wrap gap-2 font-mono">
            {presets.map((p, idx) => (
              <button
                key={idx}
                onClick={() => setPrompt(p)}
                className="bg-black/60 hover:bg-white/5 text-slate-300 border border-white/10 text-[11px] px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Input Text Area */}
        <textarea
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Descreva as regras da estratégia em linguagem natural..."
          className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-sky-500/60 font-sans"
        />
      </div>

      {/* Editor / Visualizador de Código */}
      {generatedPine && (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <span className="text-xs font-semibold text-slate-300 font-mono">strategy.pine (Pine Script v5)</span>
            <div className="flex items-center gap-2 font-mono">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-slate-200 text-xs px-3 py-1.5 rounded-lg border border-white/10 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copiado!' : 'Copiar Código'}
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-xs px-3 py-1.5 rounded-lg font-bold cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Baixar .pine
              </button>
            </div>
          </div>

          <pre className="bg-black/80 border border-white/10 rounded-xl p-4 text-xs font-mono text-sky-200 leading-relaxed overflow-x-auto max-h-[500px]">
            {generatedPine}
          </pre>
        </div>
      )}
    </div>
  );
};
