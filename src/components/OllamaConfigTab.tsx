import React, { useState } from 'react';
import { OllamaStatus } from '../types';
import { Cpu, Server, Key, CheckCircle2, AlertCircle, RefreshCw, Terminal, Send } from 'lucide-react';

interface OllamaConfigTabProps {
  ollamaStatus: OllamaStatus | null;
  onRefreshOllama: () => void;
}

export const OllamaConfigTab: React.FC<OllamaConfigTabProps> = ({ ollamaStatus, onRefreshOllama }) => {
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [keysSaved, setKeysSaved] = useState(false);

  // Test prompt sandbox state
  const [testModel, setTestModel] = useState(ollamaStatus?.default_model || 'llama3');
  const [testPrompt, setTestPrompt] = useState(
    'Analise este contrato: BTCUSDT preco=$65000 RSI=28 VolumeSpike=220%. Qual a recomendação?'
  );
  const [testLoading, setTestLoading] = useState(false);
  const [testResponse, setTestResponse] = useState('');

  const handleSaveKeys = (e: React.FormEvent) => {
    e.preventDefault();
    setKeysSaved(true);
    setTimeout(() => setKeysSaved(false), 3000);
  };

  const handleRunSandbox = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestLoading(true);
    try {
      const resp = await fetch('/api/cli/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          args: `scan --symbols BTCUSDT --rsi-low 35 --all --with-ollama --model "${testModel}" --json`,
        }),
      });
      if (!resp.ok || !(resp.headers.get('content-type') || '').includes('application/json')) {
        setTestResponse(`Erro HTTP (${resp.status}): ${resp.statusText}`);
        return;
      }
      const data = await resp.json();
      setTestResponse(data.stdout || data.stderr || 'Sem resposta');
    } catch (err: any) {
      setTestResponse(`Erro: ${err.message}`);
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Servidor Ollama Local Status */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-white font-mono">Status do Modelo Ollama Local</h2>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">Host: {ollamaStatus?.host || 'http://localhost:11434'}</p>
            </div>
          </div>
          <button
            onClick={onRefreshOllama}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-slate-300 text-xs px-3 py-1.5 rounded-lg border border-white/10 font-mono cursor-pointer transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Verificar Conexão
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-black/60 p-4 rounded-xl border border-white/10 space-y-2">
            <span className="text-[10px] text-slate-400 font-mono uppercase block">Conectividade:</span>
            <div className="flex items-center gap-2">
              {ollamaStatus?.available ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-400 font-mono">Serviço Ollama Online</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-amber-400 font-mono">Ollama Indisponível (Modo Regras)</span>
                </>
              )}
            </div>
            <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
              O agente é 100% desacoplado: mesmo se o Ollama estiver offline, o scanner, backtest, otimizador e paper trading funcionam perfeitamente.
            </p>
          </div>

          <div className="bg-black/60 p-4 rounded-xl border border-white/10 space-y-2">
            <span className="text-[10px] text-slate-400 font-mono uppercase block">Modelos Instalados Localmente ({ollamaStatus?.models.length || 0}):</span>
            <div className="flex flex-wrap gap-1.5">
              {ollamaStatus?.models.length ? (
                ollamaStatus.models.map((m) => (
                  <span key={m} className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 text-[10px] font-mono px-2 py-0.5 rounded">
                    {m}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-500 font-mono">Nenhum modelo detectado. Executar 'ollama pull llama3'.</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Test Prompt Sandbox */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5 shadow-xl space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300 flex items-center gap-2 font-mono">
          <Terminal className="w-4 h-4 text-indigo-400" />
          Testar Recomendação Estruturada do Ollama
        </h3>

        <form onSubmit={handleRunSandbox} className="space-y-3 font-mono">
          <div className="flex items-center gap-3">
            <label className="text-[10px] text-slate-400 uppercase">Modelo:</label>
            <select
              value={testModel}
              onChange={(e) => setTestModel(e.target.value)}
              className="bg-black/60 border border-white/10 text-xs text-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500/60"
            >
              {(ollamaStatus?.models.length ? ollamaStatus.models : ['llama3', 'mistral']).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={testLoading}
            className="flex items-center gap-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-xs px-4 py-2 rounded-lg font-semibold tracking-wide cursor-pointer disabled:opacity-50 transition-all shadow-[0_0_12px_rgba(99,102,241,0.15)]"
          >
            {testLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {testLoading ? 'PROCESSANDO...' : 'EXECUTAR ANÁLISE DE TESTE'}
          </button>
        </form>

        {testResponse && (
          <pre className="bg-black/80 border border-white/10 rounded-xl p-4 text-xs font-mono text-indigo-200 max-h-60 overflow-y-auto leading-relaxed">
            {testResponse}
          </pre>
        )}
      </div>

      {/* Configuração de Chaves de API Binance (Opcional para Live) */}
      <form onSubmit={handleSaveKeys} className="bg-zinc-900/50 border border-white/10 rounded-xl p-5 shadow-xl space-y-4 font-mono">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <Key className="w-4 h-4 text-emerald-400" />
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-200 font-mono">Chaves de API Binance Futures (Live Trading)</h3>
              <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                Necessárias apenas para ordens reais. O scanner, backtest e paper trading funcionam sem chave.
              </p>
            </div>
          </div>
          {keysSaved && (
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 font-mono">
              <CheckCircle2 className="w-4 h-4" /> Salvo!
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] text-slate-400 uppercase block mb-1">BINANCE_API_KEY</label>
            <input
              type="password"
              placeholder="Sua Binance API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:border-emerald-500/60"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 uppercase block mb-1">BINANCE_SECRET_KEY</label>
            <input
              type="password"
              placeholder="Sua Binance Secret Key"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              className="w-full bg-black/60 border border-white/10 text-slate-200 rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:border-emerald-500/60"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs px-5 py-2 rounded-lg font-bold cursor-pointer transition-colors tracking-wider">
            SALVAR CHAVES NO AMBIENTE
          </button>
        </div>
      </form>
    </div>
  );
};
