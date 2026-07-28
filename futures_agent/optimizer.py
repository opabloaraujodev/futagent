import itertools
from typing import List, Dict, Any, Optional
from futures_agent.backtester import Backtester
from futures_agent.models import OptimizationResult
from futures_agent.data_loader import load_historical_klines_from_json

class StrategyOptimizer:
    def __init__(self, backtester: Optional[Backtester] = None):
        self.backtester = backtester or Backtester()

    def optimize(
        self,
        symbol: str = "BTCUSDT",
        timeframe: str = "15m",
        initial_capital: float = 10000.0,
        strategy: str = "rsi_volume",
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
        data_dir: str = "/mnt/e/datadown/data/monthly/15m",
        periods: Optional[List[str]] = None,
        start_period: Optional[str] = None,
        end_period: Optional[str] = None
    ) -> Any:
        """
        Grid search determinístico de parâmetros com suporte a múltiplos símbolos.
        """
        if isinstance(symbol, str) and "," in symbol:
            sym_list = [s.strip().upper() for s in symbol.split(",") if s.strip()]
            multi_opt = []
            for sym in sym_list:
                res = self.optimize(
                    symbol=sym,
                    timeframe=timeframe,
                    initial_capital=initial_capital,
                    strategy=strategy,
                    rsi_periods=rsi_periods,
                    rsi_oversolds=rsi_oversolds,
                    rsi_overboughts=rsi_overboughts,
                    volume_ratios=volume_ratios,
                    donchian_periods=donchian_periods,
                    cmf_periods=cmf_periods,
                    cmf_thresholds=cmf_thresholds,
                    ema_filter_periods=ema_filter_periods,
                    stop_losses=stop_losses,
                    take_profits=take_profits,
                    use_trailing_stop=use_trailing_stop,
                    trailing_activation_pct=trailing_activation_pct,
                    trailing_distance_pct=trailing_distance_pct,
                    trailing_type=trailing_type,
                    trailing_atr_mult=trailing_atr_mult,
                    leverage=leverage,
                    margin_type=margin_type,
                    position_sizing_type=position_sizing_type,
                    position_size_value=position_size_value,
                    ranking_metric=ranking_metric,
                    top_n=top_n,
                    candle_limit=candle_limit,
                    use_local_json=use_local_json,
                    data_dir=data_dir,
                    periods=periods,
                    start_period=start_period,
                    end_period=end_period
                )
                multi_opt.append(res)
            return {
                "is_multi": True,
                "symbols": sym_list,
                "multi_results": [r.__dict__ if hasattr(r, '__dict__') else r for r in multi_opt]
            }

        s_upper = str(strategy).upper()
        if "DONCHIAN" in s_upper or "CMF" in s_upper:
            strat_mode = "donchian_cmf"
        elif "EMA" in s_upper or "CROSS" in s_upper:
            strat_mode = "ema_cross"
        elif "BOLLINGER" in s_upper or "BB" in s_upper:
            strat_mode = "bollinger_rsi"
        elif "MACD" in s_upper:
            strat_mode = "macd_volume"
        elif "SUPER" in s_upper or "SUPERTREND" in s_upper:
            strat_mode = "supertrend_atr"
        elif "CRT" in s_upper or "CANDLE" in s_upper or "RANGE" in s_upper or "SWEEP" in s_upper:
            strat_mode = "crt_sweep"
        elif "PO3" in s_upper or "POWER" in s_upper or "ACCUM" in s_upper:
            strat_mode = "po3_trailing"
        else:
            strat_mode = "rsi_volume"

        stop_losses = stop_losses or [1.0, 2.0]
        take_profits = take_profits or [2.0, 3.0]

        if strat_mode == "donchian_cmf":
            donchian_periods = donchian_periods or [20, 55]
            cmf_periods = cmf_periods or [20]
            cmf_thresholds = cmf_thresholds or [0.0, 0.05]
            ema_filter_periods = ema_filter_periods or [0, 200]

            param_combinations = [
                {"strategy": "donchian_cmf", "donchian_period": p_donch, "cmf_period": p_cmf, "cmf_threshold": p_thresh, "ema_filter_period": p_ema, "stop_loss_pct": p_sl, "take_profit_pct": p_tp}
                for (p_donch, p_cmf, p_thresh, p_ema, p_sl, p_tp) in itertools.product(
                    donchian_periods, cmf_periods, cmf_thresholds, ema_filter_periods, stop_losses, take_profits
                )
            ]
        elif strat_mode == "ema_cross":
            ema_fast_list = [7, 9, 12]
            ema_slow_list = [21, 26]
            param_combinations = [
                {"strategy": "ema_cross", "ema_fast": p_fast, "ema_slow": p_slow, "stop_loss_pct": p_sl, "take_profit_pct": p_tp}
                for (p_fast, p_slow, p_sl, p_tp) in itertools.product(ema_fast_list, ema_slow_list, stop_losses, take_profits)
            ]
        elif strat_mode == "bollinger_rsi":
            bb_periods = [14, 20]
            bb_stds = [1.8, 2.0]
            rsi_periods = rsi_periods or [14]
            rsi_oversolds = rsi_oversolds or [25.0, 30.0]
            rsi_overboughts = rsi_overboughts or [70.0, 75.0]
            param_combinations = [
                {"strategy": "bollinger_rsi", "bb_period": p_bb, "bb_std_dev": p_std, "rsi_period": p_rsi, "rsi_oversold": p_os, "rsi_overbought": p_ob, "stop_loss_pct": p_sl, "take_profit_pct": p_tp}
                for (p_bb, p_std, p_rsi, p_os, p_ob, p_sl, p_tp) in itertools.product(
                    bb_periods, bb_stds, rsi_periods, rsi_oversolds, rsi_overboughts, stop_losses, take_profits
                )
            ]
        elif strat_mode == "macd_volume":
            volume_ratios = volume_ratios or [1.5, 2.0]
            macd_fasts = [10, 12]
            macd_slows = [24, 26]
            param_combinations = [
                {"strategy": "macd_volume", "macd_fast": p_mf, "macd_slow": p_ms, "volume_threshold_ratio": p_vol, "stop_loss_pct": p_sl, "take_profit_pct": p_tp}
                for (p_mf, p_ms, p_vol, p_sl, p_tp) in itertools.product(macd_fasts, macd_slows, volume_ratios, stop_losses, take_profits)
            ]
        elif strat_mode == "supertrend_atr":
            st_periods = [7, 10]
            st_mults = [2.0, 3.0]
            param_combinations = [
                {"strategy": "supertrend_atr", "supertrend_period": p_stp, "supertrend_multiplier": p_stm, "stop_loss_pct": p_sl, "take_profit_pct": p_tp}
                for (p_stp, p_stm, p_sl, p_tp) in itertools.product(st_periods, st_mults, stop_losses, take_profits)
            ]
        elif strat_mode == "crt_sweep":
            crt_lookbacks = [1, 2, 3]
            param_combinations = [
                {"strategy": "crt_sweep", "crt_lookback": p_crt, "stop_loss_pct": p_sl, "take_profit_pct": p_tp}
                for (p_crt, p_sl, p_tp) in itertools.product(crt_lookbacks, stop_losses, take_profits)
            ]
        elif strat_mode == "po3_trailing":
            param_combinations = [
                {"strategy": "po3_trailing", "stop_loss_pct": p_sl, "take_profit_pct": p_tp}
                for (p_sl, p_tp) in itertools.product(stop_losses, take_profits)
            ]
        else:
            rsi_periods = rsi_periods or [10, 14]
            rsi_oversolds = rsi_oversolds or [25.0, 30.0]
            rsi_overboughts = rsi_overboughts or [70.0, 75.0]
            volume_ratios = volume_ratios or [1.5, 2.0]

            param_combinations = [
                {"strategy": "rsi_volume", "rsi_period": p_rsi, "rsi_oversold": p_os, "rsi_overbought": p_ob, "volume_threshold_ratio": p_vol, "stop_loss_pct": p_sl, "take_profit_pct": p_tp}
                for (p_rsi, p_os, p_ob, p_vol, p_sl, p_tp) in itertools.product(
                    rsi_periods, rsi_oversolds, rsi_overboughts, volume_ratios, stop_losses, take_profits
                )
            ]

        results = []

        # Pré-carregar klines uma única vez para acelerar o grid search
        try:
            if use_local_json:
                cached_klines = load_historical_klines_from_json(
                    symbol=symbol,
                    timeframe=timeframe,
                    data_dir=data_dir,
                    periods=periods,
                    start_period=start_period,
                    end_period=end_period
                )
                if not cached_klines or len(cached_klines) < 30:
                    cached_klines = self.backtester.client.get_klines(symbol=symbol, interval=timeframe, limit=candle_limit)
            else:
                cached_klines = self.backtester.client.get_klines(symbol=symbol, interval=timeframe, limit=candle_limit)

            if not cached_klines or len(cached_klines) < 30:
                cached_klines = self.backtester.client._generate_synthetic_klines(symbol, timeframe, candle_limit or 500)
        except Exception:
            cached_klines = self.backtester.client._generate_synthetic_klines(symbol, timeframe, candle_limit or 500)

        for combo in param_combinations:
            try:
                res = self.backtester.run_backtest(
                    symbol=symbol,
                    timeframe=timeframe,
                    initial_capital=initial_capital,
                    strategy=combo["strategy"],
                    rsi_period=combo.get("rsi_period", 14),
                    rsi_oversold=combo.get("rsi_oversold", 30.0),
                    rsi_overbought=combo.get("rsi_overbought", 70.0),
                    volume_threshold_ratio=combo.get("volume_threshold_ratio", 2.0),
                    donchian_period=combo.get("donchian_period", 20),
                    cmf_period=combo.get("cmf_period", 20),
                    cmf_threshold=combo.get("cmf_threshold", 0.05),
                    ema_filter_period=combo.get("ema_filter_period", 0),
                    stop_loss_pct=combo["stop_loss_pct"],
                    take_profit_pct=combo["take_profit_pct"],
                    use_trailing_stop=use_trailing_stop,
                    trailing_activation_pct=trailing_activation_pct,
                    trailing_distance_pct=trailing_distance_pct,
                    trailing_type=trailing_type,
                    trailing_atr_mult=trailing_atr_mult,
                    leverage=leverage,
                    margin_type=margin_type,
                    position_sizing_type=position_sizing_type,
                    position_size_value=position_size_value,
                    limit=candle_limit,
                    klines_input=cached_klines
                )

                if res.total_trades > 0:
                    params_item = {
                        "strategy": combo["strategy"],
                        "stop_loss_pct": combo["stop_loss_pct"],
                        "take_profit_pct": combo["take_profit_pct"],
                        "leverage": leverage,
                        "margin_type": margin_type,
                        "position_sizing_type": position_sizing_type,
                        "position_size_value": position_size_value
                    }
                    if "rsi_period" in combo: params_item["rsi_period"] = combo["rsi_period"]
                    if "rsi_oversold" in combo: params_item["rsi_oversold"] = combo["rsi_oversold"]
                    if "rsi_overbought" in combo: params_item["rsi_overbought"] = combo["rsi_overbought"]
                    if "volume_threshold_ratio" in combo: params_item["volume_ratio"] = combo["volume_threshold_ratio"]
                    if "donchian_period" in combo: params_item["donchian_period"] = combo["donchian_period"]
                    if "cmf_period" in combo: params_item["cmf_period"] = combo["cmf_period"]
                    if "cmf_threshold" in combo: params_item["cmf_threshold"] = combo["cmf_threshold"]

                    results.append({
                        "params": params_item,
                        "total_pnl_pct": res.total_pnl_pct,
                        "win_rate_pct": res.win_rate_pct,
                        "profit_factor": res.profit_factor,
                        "max_drawdown_pct": res.max_drawdown_pct,
                        "sharpe_ratio": res.sharpe_ratio,
                        "total_trades": res.total_trades
                    })
            except Exception:
                continue

        # Ordenar pelo parâmetro selecionado
        if ranking_metric == "win_rate_pct":
            sorted_results = sorted(results, key=lambda x: (x["win_rate_pct"], x["total_pnl_pct"]), reverse=True)
        elif ranking_metric == "sharpe_ratio":
            sorted_results = sorted(results, key=lambda x: (x["sharpe_ratio"], x["total_pnl_pct"]), reverse=True)
        else:  # "total_pnl_pct" por padrão
            sorted_results = sorted(results, key=lambda x: x["total_pnl_pct"], reverse=True)

        return OptimizationResult(
            symbol=symbol,
            timeframe=timeframe,
            tested_combinations=len(param_combinations),
            top_strategies=sorted_results[:top_n],
            ranking_metric=ranking_metric
        )
