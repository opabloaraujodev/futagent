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
  price_source?: 'live' | 'kline' | 'kline_stale';
  strategy_name?: string | null;
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
  vwap_deviation_pct?: number;
  chop_threshold?: number;
  supertrend_period?: number;
  supertrend_multiplier?: number;
  stoch_rsi_period?: number;
  bb_period?: number;
  bb_std_dev?: number;
  kc_atr_period?: number;
  kc_atr_mult?: number;
  orderflow_lookback?: number;
  funding_threshold?: number;
  ichimoku_tenkan?: number;
  ichimoku_kijun?: number;
  ichimoku_senkou_b?: number;
  pivot_vol_period?: number;
  pivot_exit_pct?: number;
  use_atr_stop?: boolean;
  atr_period?: number;
  atr_multiplier?: number;
  stop_loss_pct: number;
  take_profit_pct: number;
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
  origin?: string;
  price_update_failed?: boolean;
  price_error?: string;
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
  origin?: string;
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
  origin?: string;
}

export interface PaperState {
  initial_balance: number;
  balance: number;
  real_wallet_balance?: number | null;
  real_wallet_available?: boolean;
  equity: number;
  pnl_usdt: number;
  pnl_pct: number;
  live_equity?: number | null;
  live_pnl_usdt?: number;
  live_pnl_pct?: number;
  open_orders_count: number;
  max_simultaneous_trades: number;
  positions: Position[];
  closed_positions: ClosedPosition[];
  history: Order[];
  _parse_error?: string;
}

export interface OllamaStatus {
  available: boolean;
  models: string[];
  host: string;
  default_model: string;
}

export interface GlobalSettings {
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
}
