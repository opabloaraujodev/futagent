import itertools
from typing import List, Dict, Any, Optional
from futures_agent.backtester import Backtester
from futures_agent.models import OptimizationResult
from futures_agent.data_loader import load_historical_klines_from_json
from futures_agent.config import STRATEGIES


class StrategyOptimizer:
    def __init__(self, backtester: Optional[Backtester] = None):
        self.backtester = backtester or Backtester()

    def _build_param_grid(self, strategy: str, stop_losses, take_profits,
                          rsi_periods, rsi_oversolds, rsi_overboughts,
                          volume_ratios, donchian_periods, cmf_periods,
                          cmf_thresholds, ema_filter_periods,
                          supertrend_periods, supertrend_multipliers, stoch_rsi_periods,
                          bb_periods, bb_std_devs, kc_atr_periods, kc_atr_mults,
                          orderflow_lookbacks, funding_thresholds,
                          ichimoku_tenkans, ichimoku_kijuns, ichimoku_senkou_bs,
                          pivot_vol_periods, vwap_deviation_pcts, chop_thresholds,
                          crt_lookbacks, crt_range_lookbacks, crt_min_range_pcts,
                          crt_sweep_confirmation_bars_list):

        stop_losses = stop_losses or [1.0, 2.0, 3.0]
        take_profits = take_profits or [1.5, 2.5, 3.5]

        if strategy == "rsi_volume":
            rsi_periods = rsi_periods or [10, 14, 21]
            rsi_oversolds = rsi_oversolds or [25.0, 30.0, 35.0]
            rsi_overboughts = rsi_overboughts or [65.0, 70.0, 75.0]
            volume_ratios = volume_ratios or [1.5, 2.0, 3.0]
            combos = list(itertools.product(
                rsi_periods, rsi_oversolds, rsi_overboughts, volume_ratios, stop_losses, take_profits
            ))
            def make_params(combo):
                p_rsi, p_os, p_ob, p_vol, p_sl, p_tp = combo
                return {
                    "strategy": "rsi_volume", "rsi_period": p_rsi,
                    "rsi_oversold": p_os, "rsi_overbought": p_ob,
                    "volume_ratio": p_vol, "stop_loss_pct": p_sl, "take_profit_pct": p_tp
                }

        elif strategy == "donchian_cmf":
            donchian_periods = donchian_periods or [20, 55]
            cmf_periods = cmf_periods or [14, 20]
            cmf_thresholds = cmf_thresholds or [0.0, 0.05, 0.1]
            ema_filter_periods = ema_filter_periods or [0, 200]
            combos = list(itertools.product(
                donchian_periods, cmf_periods, cmf_thresholds, ema_filter_periods, stop_losses, take_profits
            ))
            def make_params(combo):
                p_donch, p_cmf, p_thresh, p_ema, p_sl, p_tp = combo
                return {
                    "strategy": "donchian_cmf", "donchian_period": p_donch,
                    "cmf_period": p_cmf, "cmf_threshold": p_thresh,
                    "ema_filter_period": p_ema, "stop_loss_pct": p_sl, "take_profit_pct": p_tp
                }

        elif strategy == "vwap_reversion":
            rsi_periods = rsi_periods or [10, 14, 21]
            rsi_oversolds = rsi_oversolds or [25.0, 30.0, 35.0]
            rsi_overboughts = rsi_overboughts or [65.0, 70.0, 75.0]
            vwap_deviations = vwap_deviation_pcts or [0.2, 0.3, 0.5, 0.8]
            chop_thresholds_list = chop_thresholds or [55.0, 61.0, 65.0]
            combos = list(itertools.product(
                rsi_periods, rsi_oversolds, rsi_overboughts,
                vwap_deviations, chop_thresholds_list, stop_losses, take_profits
            ))
            def make_params(combo):
                p_rsi, p_os, p_ob, p_dev, p_chop, p_sl, p_tp = combo
                return {
                    "strategy": "vwap_reversion", "rsi_period": p_rsi,
                    "rsi_oversold": p_os, "rsi_overbought": p_ob,
                    "vwap_deviation_pct": p_dev, "chop_threshold": p_chop,
                    "stop_loss_pct": p_sl, "take_profit_pct": p_tp
                }
            chop_thresholds = chop_thresholds_list

        elif strategy == "donchian_breakout":
            donchian_periods = donchian_periods or [15, 20, 30, 55]
            combos = list(itertools.product(donchian_periods, stop_losses, take_profits))
            def make_params(combo):
                p_donch, p_sl, p_tp = combo
                return {
                    "strategy": "donchian_breakout", "donchian_period": p_donch,
                    "stop_loss_pct": p_sl, "take_profit_pct": p_tp
                }

        elif strategy == "supertrend_pullback":
            st_periods = supertrend_periods or [7, 10, 14]
            st_mults = supertrend_multipliers or [2.0, 3.0, 4.0]
            stoch_periods = stoch_rsi_periods or [10, 14, 21]
            combos = list(itertools.product(st_periods, st_mults, stoch_periods, stop_losses, take_profits))
            def make_params(combo):
                p_period, p_mult, p_stoch, p_sl, p_tp = combo
                return {
                    "strategy": "supertrend_pullback", "supertrend_period": p_period,
                    "supertrend_multiplier": p_mult, "stoch_rsi_period": p_stoch,
                    "stop_loss_pct": p_sl, "take_profit_pct": p_tp
                }

        elif strategy == "squeeze_breakout":
            bb_periods = bb_periods or [15, 20, 25]
            bb_stds = bb_std_devs or [1.5, 2.0, 2.5]
            kc_atr_periods = kc_atr_periods or [10, 15]
            kc_mults = kc_atr_mults or [1.5, 2.0, 2.5]
            combos = list(itertools.product(bb_periods, bb_stds, kc_atr_periods, kc_mults, stop_losses, take_profits))
            def make_params(combo):
                p_bb, p_std, p_kc_atr, p_kc_m, p_sl, p_tp = combo
                return {
                    "strategy": "squeeze_breakout", "bb_period": p_bb,
                    "bb_std_dev": p_std, "kc_atr_period": p_kc_atr,
                    "kc_atr_mult": p_kc_m,
                    "stop_loss_pct": p_sl, "take_profit_pct": p_tp
                }

        elif strategy == "orderflow_divergence":
            lookbacks = orderflow_lookbacks or [10, 15, 20, 30]
            combos = list(itertools.product(lookbacks, stop_losses, take_profits))
            def make_params(combo):
                p_lb, p_sl, p_tp = combo
                return {
                    "strategy": "orderflow_divergence", "orderflow_lookback": p_lb,
                    "stop_loss_pct": p_sl, "take_profit_pct": p_tp
                }

        elif strategy == "funding_sentiment":
            thresholds = funding_thresholds or [0.0001, 0.0005, 0.001]
            combos = list(itertools.product(thresholds, stop_losses, take_profits))
            def make_params(combo):
                p_th, p_sl, p_tp = combo
                return {
                    "strategy": "funding_sentiment", "funding_threshold": p_th,
                    "stop_loss_pct": p_sl, "take_profit_pct": p_tp
                }

        elif strategy == "ichimoku_cloud":
            tenkans = ichimoku_tenkans or [7, 9, 12]
            kijuns = ichimoku_kijuns or [20, 26, 34]
            senkous = ichimoku_senkou_bs or [40, 52, 60]
            combos = list(itertools.product(tenkans, kijuns, senkous, stop_losses, take_profits))
            def make_params(combo):
                p_tk, p_kj, p_sb, p_sl, p_tp = combo
                return {
                    "strategy": "ichimoku_cloud", "ichimoku_tenkan": p_tk,
                    "ichimoku_kijun": p_kj, "ichimoku_senkou_b": p_sb,
                    "stop_loss_pct": p_sl, "take_profit_pct": p_tp
                }

        elif strategy == "pivot_points":
            vol_periods = pivot_vol_periods or [10, 20, 30]
            exit_pcts = [0.5, 1.0, 1.5, 2.0]
            combos = list(itertools.product(vol_periods, exit_pcts, stop_losses, take_profits))
            def make_params(combo):
                p_vp, p_ep, p_sl, p_tp = combo
                return {
                    "strategy": "pivot_points", "pivot_vol_period": p_vp,
                    "pivot_exit_pct": p_ep,
                    "stop_loss_pct": p_sl, "take_profit_pct": p_tp
                }

        elif strategy == "candle_range_theory":
            crt_lookbacks = crt_lookbacks or [30, 50, 80]
            crt_range_lookbacks = crt_range_lookbacks or [3, 5, 7]
            crt_min_range_pcts = crt_min_range_pcts or [0.15, 0.2, 0.3]
            crt_confirmation_bars = crt_sweep_confirmation_bars_list or [2, 3, 4]
            combos = list(itertools.product(
                crt_lookbacks, crt_range_lookbacks, crt_min_range_pcts,
                crt_confirmation_bars, stop_losses, take_profits
            ))
            def make_params(combo):
                p_lb, p_rlb, p_mrp, p_cb, p_sl, p_tp = combo
                return {
                    "strategy": "candle_range_theory",
                    "crt_lookback": p_lb, "crt_range_lookback": p_rlb,
                    "crt_min_range_pct": p_mrp, "crt_sweep_confirmation_bars": p_cb,
                    "stop_loss_pct": p_sl, "take_profit_pct": p_tp
                }

        else:
            combos = list(itertools.product(stop_losses, take_profits))
            def make_params(combo):
                p_sl, p_tp = combo
                return {
                    "strategy": strategy, "stop_loss_pct": p_sl, "take_profit_pct": p_tp
                }

        return combos, make_params

    def _run_single_strategy(self, strategy, symbol, timeframe, initial_capital,
                             leverage, margin_type, position_sizing_type, position_size_value,
                             use_trailing_stop, trailing_activation_pct, trailing_distance_pct,
                             trailing_type, trailing_atr_mult, candle_limit, cached_klines,
                             stop_losses, take_profits, rsi_periods, rsi_oversolds,
                             rsi_overboughts, volume_ratios, donchian_periods, cmf_periods,
                             cmf_thresholds, ema_filter_periods,
                             supertrend_periods, supertrend_multipliers, stoch_rsi_periods,
                             bb_periods, bb_std_devs, kc_atr_periods, kc_atr_mults,
                             orderflow_lookbacks, funding_thresholds,
                             ichimoku_tenkans, ichimoku_kijuns, ichimoku_senkou_bs,
                             pivot_vol_periods, vwap_deviation_pcts, chop_thresholds,
                             crt_lookbacks=None, crt_range_lookbacks=None, crt_min_range_pcts=None,
                             crt_sweep_confirmation_bars_list=None):
        combos, make_params = self._build_param_grid(
            strategy, stop_losses, take_profits,
            rsi_periods, rsi_oversolds, rsi_overboughts,
            volume_ratios, donchian_periods, cmf_periods,
            cmf_thresholds, ema_filter_periods,
            supertrend_periods, supertrend_multipliers, stoch_rsi_periods,
            bb_periods, bb_std_devs, kc_atr_periods, kc_atr_mults,
            orderflow_lookbacks, funding_thresholds,
            ichimoku_tenkans, ichimoku_kijuns, ichimoku_senkou_bs,
            pivot_vol_periods, vwap_deviation_pcts, chop_thresholds,
            crt_lookbacks, crt_range_lookbacks, crt_min_range_pcts,
            crt_sweep_confirmation_bars_list
        )

        results = []
        for combo in combos:
            try:
                params = make_params(combo)
                res = self.backtester.run_backtest(
                    symbol=symbol, timeframe=timeframe, initial_capital=initial_capital,
                    strategy=strategy,
                    rsi_period=params.get("rsi_period", 14),
                    rsi_oversold=params.get("rsi_oversold", 30.0),
                    rsi_overbought=params.get("rsi_overbought", 70.0),
                    volume_threshold_ratio=params.get("volume_ratio", 2.0),
                    stop_loss_pct=params["stop_loss_pct"],
                    take_profit_pct=params["take_profit_pct"],
                    donchian_period=params.get("donchian_period", 20),
                    cmf_period=params.get("cmf_period", 20),
                    cmf_threshold=params.get("cmf_threshold", 0.05),
                    ema_filter_period=params.get("ema_filter_period", 0),
                    vwap_deviation_pct=params.get("vwap_deviation_pct", 0.3),
                    chop_threshold=params.get("chop_threshold", 61.0),
                    supertrend_period=params.get("supertrend_period", 10),
                    supertrend_multiplier=params.get("supertrend_multiplier", 3.0),
                    stoch_rsi_period=params.get("stoch_rsi_period", 14),
                    bb_period=params.get("bb_period", 20),
                    bb_std_dev=params.get("bb_std_dev", 2.0),
                    kc_atr_period=params.get("kc_atr_period", 10),
                    kc_atr_mult=params.get("kc_atr_mult", 2.0),
                    orderflow_lookback=params.get("orderflow_lookback", 20),
                    funding_threshold=params.get("funding_threshold", 0.0005),
                    ichimoku_tenkan=params.get("ichimoku_tenkan", 9),
                    ichimoku_kijun=params.get("ichimoku_kijun", 26),
                    ichimoku_senkou_b=params.get("ichimoku_senkou_b", 52),
                    pivot_vol_period=params.get("pivot_vol_period", 20),
                    pivot_exit_pct=params.get("pivot_exit_pct", 1.0),
                    crt_lookback=params.get("crt_lookback", 50),
                    crt_range_lookback=params.get("crt_range_lookback", 5),
                    crt_min_range_pct=params.get("crt_min_range_pct", 0.2),
                    crt_sweep_confirmation_bars=params.get("crt_sweep_confirmation_bars", 3),
                    use_trailing_stop=use_trailing_stop,
                    trailing_activation_pct=trailing_activation_pct,
                    trailing_distance_pct=trailing_distance_pct,
                    trailing_type=trailing_type, trailing_atr_mult=trailing_atr_mult,
                    leverage=leverage, margin_type=margin_type,
                    position_sizing_type=position_sizing_type,
                    position_size_value=position_size_value,
                    limit=candle_limit, klines_input=cached_klines
                )
                if res.total_trades > 0:
                    full_params = {**params, "leverage": leverage, "margin_type": margin_type,
                                   "position_sizing_type": position_sizing_type,
                                   "position_size_value": position_size_value, "symbol": symbol}
                    results.append({
                        "params": full_params,
                        "total_pnl_pct": res.total_pnl_pct, "win_rate_pct": res.win_rate_pct,
                        "profit_factor": res.profit_factor, "max_drawdown_pct": res.max_drawdown_pct,
                        "sharpe_ratio": res.sharpe_ratio, "total_trades": res.total_trades
                    })
            except Exception:
                continue

        return results, len(combos)

    def optimize(
        self,
        symbols: Optional[List[str]] = None,
        symbol: str = "BTCUSDT",
        timeframe: str = "15m",
        initial_capital: float = 10000.0,
        strategy: str = "rsi_volume",
        all_strategies: bool = False,
        rsi_periods: Optional[List[int]] = None,
        rsi_oversolds: Optional[List[float]] = None,
        rsi_overboughts: Optional[List[float]] = None,
        volume_ratios: Optional[List[float]] = None,
        donchian_periods: Optional[List[int]] = None,
        cmf_periods: Optional[List[int]] = None,
        cmf_thresholds: Optional[List[float]] = None,
        ema_filter_periods: Optional[List[int]] = None,
        stop_losses: Optional[List[float]] = None,
        take_profits: Optional[List[float]] = None,
        supertrend_periods: Optional[List[int]] = None,
        supertrend_multipliers: Optional[List[float]] = None,
        stoch_rsi_periods: Optional[List[int]] = None,
        bb_periods: Optional[List[int]] = None,
        bb_std_devs: Optional[List[float]] = None,
        kc_atr_periods: Optional[List[int]] = None,
        kc_atr_mults: Optional[List[float]] = None,
        orderflow_lookbacks: Optional[List[int]] = None,
        funding_thresholds: Optional[List[float]] = None,
        ichimoku_tenkans: Optional[List[int]] = None,
        ichimoku_kijuns: Optional[List[int]] = None,
        ichimoku_senkou_bs: Optional[List[int]] = None,
        pivot_vol_periods: Optional[List[int]] = None,
        vwap_deviation_pcts: Optional[List[float]] = None,
        chop_thresholds: Optional[List[float]] = None,
        crt_lookbacks: Optional[List[int]] = None,
        crt_range_lookbacks: Optional[List[int]] = None,
        crt_min_range_pcts: Optional[List[float]] = None,
        crt_sweep_confirmation_bars_list: Optional[List[int]] = None,
        use_trailing_stop: bool = False,
        trailing_activation_pct: float = 1.0,
        trailing_distance_pct: float = 1.0,
        trailing_type: str = "PERCENT",
        trailing_atr_mult: float = 2.0,
        leverage: float = 10.0,
        margin_type: str = "ISOLATED",
        position_sizing_type: str = "PERCENT",
        position_size_value: float = 10.0,
        ranking_metric: str = "total_pnl_pct",
        top_n: int = 10,
        candle_limit: int = 500,
        use_local_json: bool = False,
        data_dir: str = "/home/pablo/datadown/data/monthly",
        periods: Optional[List[str]] = None,
        start_period: Optional[str] = None,
        end_period: Optional[str] = None
    ) -> OptimizationResult:
        strategies_to_run = STRATEGIES if all_strategies else [strategy]
        symbols_to_run = symbols or [symbol]

        all_results = []
        total_combos = 0

        for sym in symbols_to_run:
            try:
                if use_local_json:
                    cached_klines = load_historical_klines_from_json(
                        symbol=sym, timeframe=timeframe, data_dir=data_dir,
                        periods=periods, start_period=start_period, end_period=end_period
                    )
                else:
                    cached_klines = self.backtester.client.get_klines(symbol=sym, interval=timeframe, limit=candle_limit)
            except Exception:
                cached_klines = None

            for strat in strategies_to_run:
                results, combos = self._run_single_strategy(
                    strategy=strat, symbol=sym, timeframe=timeframe,
                    initial_capital=initial_capital, leverage=leverage,
                    margin_type=margin_type, position_sizing_type=position_sizing_type,
                    position_size_value=position_size_value,
                    use_trailing_stop=use_trailing_stop,
                    trailing_activation_pct=trailing_activation_pct,
                    trailing_distance_pct=trailing_distance_pct,
                    trailing_type=trailing_type, trailing_atr_mult=trailing_atr_mult,
                    candle_limit=candle_limit, cached_klines=cached_klines,
                    stop_losses=stop_losses, take_profits=take_profits,
                    rsi_periods=rsi_periods, rsi_oversolds=rsi_oversolds,
                    rsi_overboughts=rsi_overboughts, volume_ratios=volume_ratios,
                    donchian_periods=donchian_periods, cmf_periods=cmf_periods,
                    cmf_thresholds=cmf_thresholds, ema_filter_periods=ema_filter_periods,
                    supertrend_periods=supertrend_periods,
                    supertrend_multipliers=supertrend_multipliers,
                    stoch_rsi_periods=stoch_rsi_periods,
                    bb_periods=bb_periods, bb_std_devs=bb_std_devs,
                    kc_atr_periods=kc_atr_periods, kc_atr_mults=kc_atr_mults,
                    orderflow_lookbacks=orderflow_lookbacks,
                    funding_thresholds=funding_thresholds,
                    ichimoku_tenkans=ichimoku_tenkans,
                    ichimoku_kijuns=ichimoku_kijuns,
                    ichimoku_senkou_bs=ichimoku_senkou_bs,
                    pivot_vol_periods=pivot_vol_periods,
                    vwap_deviation_pcts=vwap_deviation_pcts,
                    chop_thresholds=chop_thresholds,
                    crt_lookbacks=crt_lookbacks,
                    crt_range_lookbacks=crt_range_lookbacks,
                    crt_min_range_pcts=crt_min_range_pcts,
                    crt_sweep_confirmation_bars_list=crt_sweep_confirmation_bars_list,
                )
                all_results.extend(results)
                total_combos += combos

        if ranking_metric == "win_rate_pct":
            sorted_results = sorted(all_results, key=lambda x: (x["win_rate_pct"], x["total_pnl_pct"]), reverse=True)
        elif ranking_metric == "sharpe_ratio":
            sorted_results = sorted(all_results, key=lambda x: (x["sharpe_ratio"], x["total_pnl_pct"]), reverse=True)
        else:
            sorted_results = sorted(all_results, key=lambda x: x["total_pnl_pct"], reverse=True)

        return OptimizationResult(
            symbol=", ".join(symbols_to_run), timeframe=timeframe,
            tested_combinations=total_combos,
            top_strategies=sorted_results[:top_n],
            ranking_metric=ranking_metric
        )
