export type ParamGroup = 'rsi' | 'volume' | 'donchian' | 'cmf' | 'ema_filter' | 'vwap' | 'chop'
  | 'supertrend' | 'squeeze' | 'orderflow' | 'funding' | 'ichimoku' | 'pivot';

const STRATEGY_PARAMS: Record<string, ParamGroup[]> = {
  rsi_volume:            ['rsi', 'volume'],
  donchian_cmf:          ['donchian', 'cmf', 'ema_filter'],
  vwap_reversion:        ['rsi', 'vwap', 'chop'],
  donchian_breakout:     ['donchian'],
  supertrend_pullback:   ['supertrend'],
  squeeze_breakout:      ['squeeze'],
  orderflow_divergence:  ['orderflow'],
  funding_sentiment:     ['funding'],
  ichimoku_cloud:        ['ichimoku'],
  pivot_points:          ['pivot'],
};

export function getStrategyParamGroups(strategy: string): ParamGroup[] {
  return STRATEGY_PARAMS[strategy] || [];
}

export function hasParamGroup(strategy: string, group: ParamGroup): boolean {
  return getStrategyParamGroups(strategy).includes(group);
}
