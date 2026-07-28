import { GlobalSettings } from '../types';

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  margin_type: 'ISOLATED',
  position_sizing_type: 'PERCENT',
  position_size_value: 10.0,
  position_size_value_fixed: 100.0,
  use_trailing_stop: false,
  trailing_type: 'PERCENT',
  trailing_activation_pct: 1.0,
  trailing_distance_pct: 1.0,
  trailing_atr_mult: 2.0,
  data_dir: '/mnt/e/datadown/data/monthly/15m',
  use_local_json: false,
  capital: 10000,
  leverage: 10,
  auto_refresh_interval: 5,
};

const STORAGE_KEY = 'binance_futures_agent_global_settings_v1';

export function loadGlobalSettings(): GlobalSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_GLOBAL_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.error('Erro ao carregar configurações do localStorage:', e);
  }
  return { ...DEFAULT_GLOBAL_SETTINGS };
}

export function saveGlobalSettings(settings: GlobalSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    // Notifica servidor para sincronizar se a API estiver disponível
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    }).catch(() => {});
  } catch (e) {
    console.error('Erro ao salvar configurações:', e);
  }
}
