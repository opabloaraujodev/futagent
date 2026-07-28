import React, { useState, useEffect } from 'react';
import { GlobalSettings } from '../types';
import { loadGlobalSettings, saveGlobalSettings } from '../utils/settings';
import { Sliders, Save, CheckCircle2, Shield, DollarSign, Folder, Zap, RefreshCw, Lock, Sparkles, Key, Eye, EyeOff, AlertCircle } from 'lucide-react';

export const SettingsTab: React.FC<{ onSettingsUpdated?: () => void }> = ({ onSettingsUpdated }) => {
  const [settings, setSettings] = useState<GlobalSettings>(loadGlobalSettings());
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    // Tenta carregar do servidor se existir
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setSettings((prev) => ({ ...prev, ...data.data }));
        }
      })
      .catch((err) => console.log('Uso de configurações salvas locais', err));
  }, []);

  const handleChange = (field: keyof GlobalSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setSaveSuccess(false);
  };

  const handleSave = () => {
    setLoading(true);
    saveGlobalSettings(settings);
    setTimeout(() => {
      setLoading(false);
      setSaveSuccess(true);
      if (onSettingsUpdated) onSettingsUpdated();
      setTimeout(() => setSaveSuccess(false), 4000);
    }, 300);
  };

  const handleReset = () => {
    if (confirm('Deseja redefinir as configurações globais para os valores padrão do sistema?')) {
      const defaults = loadGlobalSettings();
      setSettings(defaults);
      saveGlobalSettings(defaults);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner da Seção */}
      <div className="bg-gradient-to-r from-indigo-950/60 via-zinc-900 to-zinc-950 p-6 rounded-2xl border border-indigo-500/20 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/30 text-indigo-400">
              <Sliders className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-wide uppercase font-mono">
              Configurações Globais do Agente
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1.5 font-mono">
            Defina os parâmetros mestres de gerenciamento de risco, dimensionamento, trailing stop e caminhos de dados. Suas alterações são persistidas e aplicadas a <span className="text-indigo-300 font-semibold">TODOS OS MODOS</span> (Scanner, Backtest, Otimizador e Trading).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl text-xs font-mono border border-white/10 transition-all cursor-pointer"
            title="Redefinir para os padrões do sistema"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            REDEFINIR
          </button>

          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold rounded-xl text-xs font-mono tracking-wider shadow-lg shadow-indigo-600/30 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : saveSuccess ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{saveSuccess ? 'CONFIGURAÇÕES SALVAS!' : 'SALVAR CONFIGURAÇÕES'}</span>
          </button>
        </div>
      </div>

      {/* Alerta de Confirmação */}
      {saveSuccess && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-mono flex items-center justify-between gap-3 animate-fade-in shadow-lg">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Configurações salvas com sucesso no navegador e no servidor backend! Aplicadas a todos os módulos ativos.</span>
          </div>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-200 px-2.5 py-1 rounded font-bold uppercase tracking-wider">
            Sincronizado
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BLOCO 0: CHAVES DE API BINANCE FUTURES */}
        <div className="lg:col-span-2 bg-zinc-950 border border-indigo-500/30 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <Key className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold font-mono text-white tracking-wider uppercase">
                Credenciais de API Binance Futures (USDⓈ-M Live)
              </h3>
            </div>
            <span
              className={`text-[10px] font-mono px-2.5 py-1 rounded font-bold uppercase tracking-wider ${
                settings.binance_api_key && settings.binance_secret_key
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}
            >
              {settings.binance_api_key && settings.binance_secret_key
                ? 'CHAVES SALVAS'
                : 'CHAVES NÃO CONFIGURADAS'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] text-slate-300 font-mono font-semibold block mb-1.5 flex items-center justify-between">
                <span>API Key (Binance Futures)</span>
                <span className="text-[10px] text-slate-500 font-normal">Futuros / Leitura e Leitura de Saldo</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Insira sua API Key da Binance..."
                  value={settings.binance_api_key || ''}
                  onChange={(e) => handleChange('binance_api_key', e.target.value)}
                  className="w-full bg-black/60 border border-white/15 text-slate-200 rounded-xl p-2.5 pr-8 text-xs font-mono focus:outline-none focus:border-amber-500 font-semibold"
                />
                <Key className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-3" />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-300 font-mono font-semibold block mb-1.5 flex items-center justify-between">
                <span>Secret Key (Binance Futures)</span>
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-normal cursor-pointer flex items-center gap-1"
                >
                  {showSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showSecret ? 'Ocultar' : 'Mostrar'}</span>
                </button>
              </label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  placeholder="Insira sua Secret Key da Binance..."
                  value={settings.binance_secret_key || ''}
                  onChange={(e) => handleChange('binance_secret_key', e.target.value)}
                  className="w-full bg-black/60 border border-white/15 text-slate-200 rounded-xl p-2.5 pr-8 text-xs font-mono focus:outline-none focus:border-amber-500 font-semibold"
                />
                <Lock className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-3" />
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 font-mono flex items-start gap-1.5 bg-white/5 p-3 rounded-xl border border-white/5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              <strong>Importante para o Modo Live:</strong> Suas chaves são persistidas localmente no seu ambiente e usadas pelo agente backend exclusivamente para consultar o saldo real em USDT da carteira de Futuros e enviar ordens em modo Live quando confirmado por você. Verifique se a chave possui permissão para <strong>Enable Futures</strong> na sua conta Binance.
            </span>
          </p>
        </div>

        {/* BLOCO 1: MODO DE MARGEM, CAPITAL & ALAVANCAGEM */}
        <div className="bg-zinc-950 border border-white/10 rounded-2xl p-5 space-y-4 shadow-md">
          <div className="flex items-center gap-2.5 pb-3 border-b border-white/5">
            <Shield className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold font-mono text-white tracking-wider uppercase">
              1. Modo de Margem & Capital Base
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] text-slate-300 font-mono font-semibold block mb-1.5">
                Modo de Margem
              </label>
              <select
                value={settings.margin_type}
                onChange={(e) => handleChange('margin_type', e.target.value as any)}
                className="w-full bg-black/60 border border-white/15 text-slate-200 rounded-xl p-2.5 text-xs font-mono font-semibold focus:outline-none focus:border-indigo-500"
              >
                <option value="ISOLATED">ISOLATED (Margem Isolada - Recomendado)</option>
                <option value="CROSS">CROSS (Margem Cruzada)</option>
              </select>
              <p className="text-[10px] text-slate-500 font-mono mt-1">
                Isolada limita o risco de liquidação apenas ao saldo alocado na posição.
              </p>
            </div>

            <div>
              <label className="text-[11px] text-slate-300 font-mono font-semibold block mb-1.5">
                Alavancagem Padrão (x)
              </label>
              <input
                type="number"
                min="1"
                max="125"
                value={settings.leverage}
                onChange={(e) => handleChange('leverage', Number(e.target.value))}
                className="w-full bg-black/60 border border-white/15 text-emerald-400 font-bold rounded-xl p-2.5 text-xs font-mono focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[10px] text-slate-500 font-mono mt-1">
                Multiplicador de poder de compra nas operações de futuros.
              </p>
            </div>

            <div className="sm:col-span-2">
              <label className="text-[11px] text-slate-300 font-mono font-semibold block mb-1.5">
                Capital Inicial Simulação (USDT)
              </label>
              <input
                type="number"
                step="100"
                value={settings.capital}
                onChange={(e) => handleChange('capital', Number(e.target.value))}
                className="w-full bg-black/60 border border-white/15 text-slate-200 rounded-xl p-2.5 text-xs font-mono focus:outline-none focus:border-indigo-500 font-bold"
              />
              <p className="text-[10px] text-slate-500 font-mono mt-1">
                Capital em carteira utilizado nos cálculos de backtest, otimizador e paper trading.
              </p>
            </div>
          </div>
        </div>

        {/* BLOCO 2: DIMENSIONAMENTO DE POSIÇÃO */}
        <div className="bg-zinc-950 border border-white/10 rounded-2xl p-5 space-y-4 shadow-md">
          <div className="flex items-center gap-2.5 pb-3 border-b border-white/5">
            <DollarSign className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-bold font-mono text-white tracking-wider uppercase">
              2. Dimensionamento da Posição (Position Sizing)
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[11px] text-slate-300 font-mono font-semibold block mb-1.5">
                Tipo de Dimensionamento
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleChange('position_sizing_type', 'PERCENT')}
                  className={`p-3 rounded-xl border text-xs font-mono font-bold transition-all text-left flex items-center justify-between cursor-pointer ${
                    settings.position_sizing_type === 'PERCENT'
                      ? 'bg-indigo-950/50 border-indigo-500 text-indigo-200'
                      : 'bg-black/40 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  <div>
                    <div className="text-white">PERCENTUAL DA BANCA</div>
                    <div className="text-[10px] text-slate-500 font-normal font-sans mt-0.5">
                      % proporcional da carteira
                    </div>
                  </div>
                  {settings.position_sizing_type === 'PERCENT' && (
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleChange('position_sizing_type', 'FIXED')}
                  className={`p-3 rounded-xl border text-xs font-mono font-bold transition-all text-left flex items-center justify-between cursor-pointer ${
                    settings.position_sizing_type === 'FIXED'
                      ? 'bg-indigo-950/50 border-indigo-500 text-indigo-200'
                      : 'bg-black/40 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  <div>
                    <div className="text-white">VALOR FIXO USDT</div>
                    <div className="text-[10px] text-slate-500 font-normal font-sans mt-0.5">
                      Montante fixo em USDT
                    </div>
                  </div>
                  {settings.position_sizing_type === 'FIXED' && (
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className={settings.position_sizing_type === 'PERCENT' ? 'opacity-100' : 'opacity-40'}>
                <label className="text-[11px] text-slate-300 font-mono font-semibold block mb-1.5">
                  Tamanho da Margem (% da Banca)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="100"
                    disabled={settings.position_sizing_type !== 'PERCENT'}
                    value={settings.position_size_value}
                    onChange={(e) => handleChange('position_size_value', Number(e.target.value))}
                    className="w-full bg-black/60 border border-white/15 text-indigo-300 font-bold rounded-xl p-2.5 text-xs font-mono focus:outline-none focus:border-indigo-500 pr-8"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-mono font-bold text-slate-500">%</span>
                </div>
                <p className="text-[10px] text-slate-500 font-mono mt-1">Exemplo: 10% de uma banca de $10.000 = $1.000 de margem.</p>
              </div>

              <div className={settings.position_sizing_type === 'FIXED' ? 'opacity-100' : 'opacity-40'}>
                <label className="text-[11px] text-slate-300 font-mono font-semibold block mb-1.5">
                  Valor Fixo por Ordem (USDT)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="10"
                    min="1"
                    disabled={settings.position_sizing_type !== 'FIXED'}
                    value={settings.position_size_value_fixed}
                    onChange={(e) => handleChange('position_size_value_fixed', Number(e.target.value))}
                    className="w-full bg-black/60 border border-white/15 text-emerald-300 font-bold rounded-xl p-2.5 text-xs font-mono focus:outline-none focus:border-indigo-500 pr-12"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-mono font-bold text-slate-500">USDT</span>
                </div>
                <p className="text-[10px] text-slate-500 font-mono mt-1">Valor fixo alocado por entrada, independente do tamanho do saldo.</p>
              </div>
            </div>
          </div>
        </div>

        {/* BLOCO 3: CONFIGURAÇÕES DE TRAILING STOP INTELIGENTE */}
        <div className="lg:col-span-2 bg-zinc-950 border border-white/10 rounded-2xl p-5 space-y-4 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <Zap className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold font-mono text-white tracking-wider uppercase">
                3. Trailing Stop Inteligente
              </h3>
            </div>

            {/* Toggle Principal de Ativação */}
            <label className="flex items-center gap-3 cursor-pointer bg-amber-500/10 border border-amber-500/30 px-3.5 py-1.5 rounded-xl hover:bg-amber-500/20 transition-all">
              <span className="text-xs font-mono font-bold text-amber-300">
                {settings.use_trailing_stop ? 'TRAILING STOP ATIVADO' : 'TRAILING STOP DESATIVADO'}
              </span>
              <input
                type="checkbox"
                checked={settings.use_trailing_stop}
                onChange={(e) => handleChange('use_trailing_stop', e.target.checked)}
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
            </label>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-4 gap-4 transition-all ${settings.use_trailing_stop ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <div>
              <label className="text-[11px] text-slate-300 font-mono font-semibold block mb-1.5">
                Tipo de Algoritmo Trailing
              </label>
              <select
                value={settings.trailing_type}
                onChange={(e) => handleChange('trailing_type', e.target.value as any)}
                className="w-full bg-black/60 border border-white/15 text-amber-300 font-mono font-bold rounded-xl p-2.5 text-xs focus:outline-none focus:border-amber-500"
              >
                <option value="PERCENT">PERCENT (Distância Fixa %)</option>
                <option value="ATR_DYNAMIC">ATR_DYNAMIC (Adaptativo à Volatilidade)</option>
                <option value="STEP_RATCHET">STEP_RATCHET (Proteção Escalonada em Rali)</option>
              </select>
              <p className="text-[10px] text-slate-500 font-mono mt-1">
                {settings.trailing_type === 'PERCENT' && 'Move o stop mantendo uma distância percentual fixa do topo.'}
                {settings.trailing_type === 'ATR_DYNAMIC' && 'Ajusta a distância do stop dinamicamente com base no indicador ATR.'}
                {settings.trailing_type === 'STEP_RATCHET' && 'Protege o preço de entrada rapidamente e aperta o stop conforme o ganho aumenta.'}
              </p>
            </div>

            <div>
              <label className="text-[11px] text-slate-300 font-mono font-semibold block mb-1.5">
                Gatilho de Ativação (% Lucro)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={settings.trailing_activation_pct}
                  onChange={(e) => handleChange('trailing_activation_pct', Number(e.target.value))}
                  className="w-full bg-black/60 border border-white/15 text-slate-200 rounded-xl p-2.5 text-xs font-mono font-bold focus:outline-none focus:border-amber-500 pr-8"
                />
                <span className="absolute right-3 top-2.5 text-xs font-mono font-bold text-slate-500">%</span>
              </div>
              <p className="text-[10px] text-slate-500 font-mono mt-1">
                Lucro necessário no trade para o trailing acionar e começar a mover o stop.
              </p>
            </div>

            <div>
              <label className="text-[11px] text-slate-300 font-mono font-semibold block mb-1.5">
                Distância do Trailing (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={settings.trailing_distance_pct}
                  onChange={(e) => handleChange('trailing_distance_pct', Number(e.target.value))}
                  className="w-full bg-black/60 border border-white/15 text-slate-200 rounded-xl p-2.5 text-xs font-mono font-bold focus:outline-none focus:border-amber-500 pr-8"
                />
                <span className="absolute right-3 top-2.5 text-xs font-mono font-bold text-slate-500">%</span>
              </div>
              <p className="text-[10px] text-slate-500 font-mono mt-1">
                Folga mantida abaixo do preço mais alto atingido no trade.
              </p>
            </div>

            <div>
              <label className="text-[11px] text-slate-300 font-mono font-semibold block mb-1.5">
                Multiplicador ATR (Dynamic)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.5"
                disabled={settings.trailing_type !== 'ATR_DYNAMIC'}
                value={settings.trailing_atr_mult}
                onChange={(e) => handleChange('trailing_atr_mult', Number(e.target.value))}
                className={`w-full bg-black/60 border border-white/15 text-slate-200 rounded-xl p-2.5 text-xs font-mono font-bold focus:outline-none focus:border-amber-500 ${
                  settings.trailing_type !== 'ATR_DYNAMIC' ? 'opacity-40' : ''
                }`}
              />
              <p className="text-[10px] text-slate-500 font-mono mt-1">
                Multiplicador aplicado ao valor ATR para determinar a folga dinâmica em volatilidade.
              </p>
            </div>
          </div>
        </div>

        {/* BLOCO 4: CAMINHO DA PASTA DE ARQUIVOS HISTÓRICOS */}
        <div className="lg:col-span-2 bg-zinc-950 border border-white/10 rounded-2xl p-5 space-y-4 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <Folder className="w-4 h-4 text-sky-400" />
              <h3 className="text-xs font-bold font-mono text-white tracking-wider uppercase">
                4. Diretório de Dados Históricos Local
              </h3>
            </div>

            <label className="flex items-center gap-3 cursor-pointer bg-sky-500/10 border border-sky-500/30 px-3.5 py-1.5 rounded-xl hover:bg-sky-500/20 transition-all">
              <span className="text-xs font-mono font-bold text-sky-300">
                {settings.use_local_json ? 'HISTÓRICO LOCAL JSON ATIVO' : 'HISTÓRICO LOCAL DESATIVADO (API BINANCE)'}
              </span>
              <input
                type="checkbox"
                checked={settings.use_local_json}
                onChange={(e) => handleChange('use_local_json', e.target.checked)}
                className="w-4 h-4 accent-sky-500 rounded cursor-pointer"
              />
            </label>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-slate-300 font-mono font-semibold block mb-1.5">
                Caminho da Pasta dos Arquivos Históricos (`data_dir`)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={settings.data_dir}
                  onChange={(e) => handleChange('data_dir', e.target.value)}
                  placeholder="/mnt/e/datadown/data/monthly/15m"
                  className="w-full bg-black/60 border border-white/15 text-sky-200 font-mono text-xs rounded-xl p-3 focus:outline-none focus:border-sky-500 font-semibold"
                />
              </div>
              <p className="text-[10px] text-slate-500 font-mono mt-1.5">
                Caminho absoluto ou relativo onde estão armazenados os arquivos de klines/candles em formato JSON (ex: <code className="text-sky-300">BTCUSDT_15m.json</code>).
              </p>
            </div>
          </div>
        </div>

        {/* BLOCO 5: FREQUÊNCIA DE ATUALIZAÇÃO AUTOMÁTICA */}
        <div className="lg:col-span-2 bg-zinc-950 border border-white/10 rounded-2xl p-5 space-y-4 shadow-md">
          <div className="flex items-center gap-2.5 pb-3 border-b border-white/5">
            <RefreshCw className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold font-mono text-white tracking-wider uppercase">
              5. Atualização Automática de Cotações (Auto-Refresh)
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] text-slate-300 font-mono font-semibold block mb-1.5">
                Intervalo Padrão em Segundos
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="3600"
                  value={settings.auto_refresh_interval ?? 5}
                  onChange={(e) => handleChange('auto_refresh_interval', Number(e.target.value))}
                  className="w-full bg-black/60 border border-white/15 text-emerald-300 font-mono text-xs font-bold rounded-xl p-3 focus:outline-none focus:border-emerald-500"
                />
                <span className="text-xs font-mono font-bold text-slate-400">segundos</span>
              </div>
              <p className="text-[10px] text-slate-500 font-mono mt-1.5">
                Defina <code className="text-emerald-300">0</code> para desativar o auto-refresh automático ou escolha entre 1 e 3600 segundos (Padrão: 5s).
              </p>
            </div>

            <div className="bg-black/40 border border-white/5 rounded-xl p-3 flex flex-col justify-center">
              <span className="text-xs font-mono text-slate-300 font-bold block mb-1">
                Estado Atual do Auto-Refresh:
              </span>
              <span className="text-xs font-mono text-emerald-400 font-semibold">
                {(settings.auto_refresh_interval ?? 5) > 0
                  ? `Atualizando a cada ${settings.auto_refresh_interval ?? 5} segundos`
                  : 'Desativado (Somente atualização manual)'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER SALVAR CONFIGURAÇÕES */}
      <div className="pt-4 border-t border-white/10 flex items-center justify-between">
        <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Configurações atualizadas são propagadas em tempo real para os módulos de análise e trading.</span>
        </div>

        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold rounded-xl text-xs font-mono tracking-wider shadow-lg shadow-emerald-600/30 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : saveSuccess ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>{saveSuccess ? 'CONFIGURAÇÕES SALVAS COM SUCESSO!' : 'SALVAR E APLICAR CONFIGURAÇÕES'}</span>
        </button>
      </div>
    </div>
  );
};
