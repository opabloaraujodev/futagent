export interface Recommendation {
  acao: 'COMPRA' | 'VENDA' | 'AGUARDAR';
  preco_entrada: number;
  stop: number;
  alvo: number;
  confianca: number;
  justificativa: string;
}

export interface EntryZone {
  low: number;
  high: number;
  type: 'LONG' | 'SHORT' | 'NEUTRAL';
  nearest_support: number;
  nearest_resistance: number;
}

export interface ScanResult {
  symbol: string;
  price: number;
  rsi: number;
  volume_current: number;
  volume_avg: number;
  volume_ratio_pct: number;
  is_volume_spike: boolean;
  is_rsi_oversold: boolean;
  is_rsi_overbought: boolean;
  support_levels: number[];
  resistance_levels: number[];
  entry_zone: EntryZone;
  signal: 'LONG_ALERT' | 'SHORT_ALERT' | 'NEUTRAL';
  timestamp: string;
  donchian_upper?: number | null;
  donchian_lower?: number | null;
  cmf?: number | null;
  recommendation?: Recommendation | null;
}

export interface Trade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  entry_price: number;
  exit_price: number;
  entry_time: string;
  exit_time: string;
  quantity: number;
  pnl: number;
  pnl_pct: number;
  exit_reason: string;
}

export interface BacktestResult {
  symbol: string;
  timeframe: string;
  initial_capital: number;
  final_capital: number;
  total_pnl: number;
  total_pnl_pct: number;
  win_rate_pct: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  max_drawdown_pct: number;
  profit_factor: number;
  sharpe_ratio: number;
  parameters: {
    strategy?: string;
    rsi_period?: number;
    rsi_oversold?: number;
    rsi_overbought?: number;
    volume_threshold_ratio?: number;
    donchian_period?: number;
    cmf_period?: number;
    cmf_threshold?: number;
    ema_filter_period?: number;
    use_atr_stop?: boolean;
    atr_period?: number;
    atr_multiplier?: number;
    stop_loss_pct: number;
    take_profit_pct: number;
    leverage?: number;
    margin_type?: 'ISOLATED' | 'CROSS' | 'CROSSED';
    position_sizing_type?: 'PERCENT' | 'FIXED';
    position_size_value?: number;
    candle_limit: number;
  };
  trades: Trade[];
  disclaimer: string;
}

export interface StrategyParams {
  strategy?: string;
  rsi_period?: number;
  rsi_oversold?: number;
  rsi_overbought?: number;
  volume_ratio?: number;
  donchian_period?: number;
  cmf_period?: number;
  cmf_threshold?: number;
  ema_filter_period?: number;
  ema_fast?: number;
  ema_slow?: number;
  bb_period?: number;
  bb_std_dev?: number;
  macd_fast?: number;
  macd_slow?: number;
  macd_signal?: number;
  supertrend_period?: number;
  supertrend_multiplier?: number;
  crt_lookback?: number;
  use_atr_stop?: boolean;
  atr_period?: number;
  atr_multiplier?: number;
  stop_loss_pct?: number;
  take_profit_pct?: number;
  leverage?: number;
  margin_type?: 'ISOLATED' | 'CROSS' | 'CROSSED';
  position_sizing_type?: 'PERCENT' | 'FIXED';
  position_size_value?: number;
}

export interface RankedStrategy {
  params: StrategyParams;
  total_pnl_pct: number;
  win_rate_pct: number;
  profit_factor: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
  total_trades: number;
}

export interface OptimizationResult {
  symbol: string;
  timeframe: string;
  tested_combinations: number;
  top_strategies: RankedStrategy[];
  ranking_metric: string;
}

export interface Position {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entry_price: number;
  current_price?: number;
  quantity: number;
  leverage?: number;
  margin_type?: string;
  pnl_usdt?: number;
  pnl_pct?: number;
  sl: number | null;
  tp: number | null;
  time: string;
  mode?: 'PAPER' | 'LIVE';
}

export interface ClosedPosition {
  id: string;
  mode: 'PAPER' | 'LIVE';
  symbol: string;
  side: 'LONG' | 'SHORT';
  entry_price: number;
  exit_price: number;
  quantity: number;
  pnl_usdt: number;
  pnl_pct: number;
  exit_reason?: string;
  time: string;
  exit_time?: string;
}

export interface Order {
  order_id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: string;
  price: number;
  quantity: number;
  status: string;
  mode: 'PAPER' | 'LIVE';
  timestamp: string;
  leverage?: number;
  margin_type?: string;
  position_sizing_type?: string;
  position_size_value?: number | null;
  sl_price?: number | null;
  tp_price?: number | null;
  notes?: string;
}

export interface PaperState {
  initial_balance: number;
  balance: number;
  real_wallet_balance?: number;
  api_connected?: boolean;
  api_has_keys?: boolean;
  equity: number;
  pnl_usdt: number;
  pnl_pct: number;
  open_orders_count: number;
  max_simultaneous_trades: number;
  positions: Position[];
  closed_positions: ClosedPosition[];
  history: Order[];
}

export interface OllamaStatus {
  available: boolean;
  models: string[];
  host: string;
  default_model: string;
}

export interface GlobalSettings {
  binance_api_key?: string;
  binance_secret_key?: string;
  margin_type: 'ISOLATED' | 'CROSS';
  position_sizing_type: 'PERCENT' | 'FIXED';
  position_size_value: number;
  position_size_value_fixed: number;
  use_trailing_stop: boolean;
  trailing_type: 'PERCENT' | 'ATR_DYNAMIC' | 'STEP_RATCHET';
  trailing_activation_pct: number;
  trailing_distance_pct: number;
  trailing_atr_mult: number;
  data_dir: string;
  use_local_json: boolean;
  capital: number;
  leverage: number;
  auto_refresh_interval: number;
}
