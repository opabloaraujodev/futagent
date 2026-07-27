import datetime
import math
from typing import List, Dict, Any, Optional
from futures_agent.binance_client import BinanceFuturesClient
from futures_agent.indicators import (
    calculate_rsi, calculate_volume_spike, calculate_donchian_channels,
    calculate_cmf, calculate_ema, calculate_atr, calculate_vwap,
    calculate_choppiness_index, calculate_adx_dmi, calculate_supertrend,
    calculate_stochastic_rsi, calculate_bollinger_bands, calculate_keltner_channel,
    calculate_cvd, calculate_obv, calculate_pivot_points, calculate_ichimoku,
    calculate_support_resistance
)
from futures_agent.models import BacktestResult, Trade, Candle
from futures_agent.data_loader import load_historical_klines_from_json


class Backtester:
    def __init__(self, client: Optional[BinanceFuturesClient] = None):
        self.client = client or BinanceFuturesClient()

    def run_backtest(
        self,
        symbol: str = "BTCUSDT",
        timeframe: str = "15m",
        initial_capital: float = 10000.0,
        strategy: str = "rsi_volume",
        rsi_period: int = 14,
        rsi_oversold: float = 30.0,
        rsi_overbought: float = 70.0,
        volume_threshold_ratio: float = 2.0,
        donchian_period: int = 20,
        cmf_period: int = 20,
        cmf_threshold: float = 0.05,
        ema_filter_period: int = 0,
        use_atr_stop: bool = False,
        atr_period: int = 14,
        atr_multiplier: float = 2.0,
        use_trailing_stop: bool = False,
        trailing_activation_pct: float = 1.0,
        trailing_distance_pct: float = 1.0,
        trailing_type: str = "PERCENT",
        trailing_atr_mult: float = 2.0,
        stop_loss_pct: float = 1.5,
        take_profit_pct: float = 3.0,
        vwap_deviation_pct: float = 0.3,
        chop_threshold: float = 61.0,
        leverage: float = 10.0,
        margin_type: str = "ISOLATED",
        position_sizing_type: str = "PERCENT",
        position_size_value: float = 10.0,
        limit: int = 500,
        supertrend_period: int = 10,
        supertrend_multiplier: float = 3.0,
        stoch_rsi_period: int = 14,
        bb_period: int = 20,
        bb_std_dev: float = 2.0,
        kc_atr_period: int = 10,
        kc_atr_mult: float = 2.0,
        orderflow_lookback: int = 20,
        funding_threshold: float = 0.0005,
        ichimoku_tenkan: int = 9,
        ichimoku_kijun: int = 26,
        ichimoku_senkou_b: int = 52,
        pivot_vol_period: int = 20,
        pivot_exit_pct: float = 1.0,
        crt_lookback: int = 50,
        crt_range_lookback: int = 5,
        crt_min_range_pct: float = 0.2,
        crt_sweep_confirmation_bars: int = 3,
        klines_input: Optional[List] = None,
        use_local_json: bool = False,
        data_dir: str = "/home/pablo/datadown/data/monthly",
        periods: Optional[List[str]] = None,
        start_period: Optional[str] = None,
        end_period: Optional[str] = None
    ) -> BacktestResult:
        lev = max(1.0, float(leverage))
        m_type = "ISOLATED" if "ISO" in str(margin_type).upper() else "CROSS"
        pos_type = "FIXED" if "FIX" in str(position_sizing_type).upper() else "PERCENT"
        pos_val = max(0.01, float(position_size_value))
        strat = strategy

        if klines_input is not None:
            klines = klines_input
        elif use_local_json:
            klines = load_historical_klines_from_json(
                symbol=symbol, timeframe=timeframe, data_dir=data_dir,
                periods=periods, start_period=start_period, end_period=end_period
            )
        else:
            klines = self.client.get_klines(symbol=symbol, interval=timeframe, limit=limit)

        min_required = max(60, donchian_period + 20, cmf_period + 20, ema_filter_period + 5)
        if len(klines) < min_required:
            return BacktestResult(
                symbol=symbol, timeframe=timeframe, initial_capital=initial_capital,
                final_capital=initial_capital, total_pnl=0.0, total_pnl_pct=0.0,
                win_rate_pct=0.0, total_trades=0, winning_trades=0, losing_trades=0,
                max_drawdown_pct=0.0, profit_factor=0.0, sharpe_ratio=0.0,
                parameters={"strategy": strat}, trades=[]
            )

        close_prices = [k.close for k in klines]
        volumes = [k.volume for k in klines]

        atr_series = calculate_atr(klines, period=atr_period) if (use_atr_stop or (use_trailing_stop and trailing_type == "ATR_DYNAMIC")) else []
        don_up, don_low, _ = calculate_donchian_channels(klines, period=donchian_period) if strat in ("donchian_cmf", "donchian_breakout", "vwap_reversion", "squeeze_breakout", "supertrend_pullback", "orderflow_divergence") else ([], [], [])
        cmf_series = calculate_cmf(klines, period=cmf_period) if strat in ("donchian_cmf", "orderflow_divergence") else []
        ema_series = calculate_ema(close_prices, period=ema_filter_period) if (ema_filter_period > 0) else []
        rsi_series = calculate_rsi(close_prices, period=rsi_period) if strat in ("rsi_volume", "vwap_reversion", "ichimoku_cloud") else []
        vwap_series = calculate_vwap(klines) if strat == "vwap_reversion" else []
        chop_series = calculate_choppiness_index(klines, period=14) if strat == "vwap_reversion" else []
        adx_series, plus_di, minus_di = ([], [], []) if strat != "donchian_breakout" else calculate_adx_dmi(klines, period=14)
        st_line, st_dir = ([], []) if strat != "supertrend_pullback" else calculate_supertrend(klines, period=supertrend_period, multiplier=supertrend_multiplier)
        stoch_k, stoch_d = ([], []) if strat != "supertrend_pullback" else calculate_stochastic_rsi(close_prices, rsi_period=stoch_rsi_period, stoch_period=stoch_rsi_period)
        bb_upper, bb_mid, bb_lower = ([], [], []) if strat != "squeeze_breakout" else calculate_bollinger_bands(close_prices, period=bb_period, std_dev=bb_std_dev)
        kc_upper, kc_mid, kc_lower = ([], [], []) if strat != "squeeze_breakout" else calculate_keltner_channel(klines, period=bb_period, atr_period=kc_atr_period, atr_mult=kc_atr_mult)
        cvd_series = calculate_cvd(klines) if strat in ("orderflow_divergence", "funding_sentiment") else []
        obv_series = calculate_obv(klines) if strat in ("orderflow_divergence", "obv") else []
        ich = calculate_ichimoku(klines, tenkan_period=ichimoku_tenkan, kijun_period=ichimoku_kijun, senkou_b_period=ichimoku_senkou_b) if strat == "ichimoku_cloud" else {}
        pivots_list = [calculate_pivot_points(klines[i - 1:i]) for i in range(len(klines))] if strat == "pivot_points" else []

        capital = initial_capital
        peak_capital = initial_capital
        max_drawdown_pct = 0.0
        position = None
        trades: List[Trade] = []
        gross_profit = 0.0
        gross_loss = 0.0
        returns_list = []
        start_idx = max(60, donchian_period + 1, cmf_period + 1, supertrend_period + 5, ichimoku_senkou_b + 1, pivot_vol_period + 1, 30)

        for i in range(start_idx, len(klines)):
            if capital <= 0:
                break

            k = klines[i]
            cur_price = k.close
            timestamp_str = datetime.datetime.fromtimestamp(k.timestamp / 1000).strftime("%Y-%m-%d %H:%M")

            if position:
                p_type = position["type"]
                entry_p = position["entry_price"]
                margin_allocated = position["margin_allocated"]
                qty = position["qty"]
                liq_p = position["liq_price"]

                if use_trailing_stop:
                    if p_type == "LONG":
                        highest_price = max(position.get("highest_price", entry_p), k.high)
                        position["highest_price"] = highest_price
                        gain_pct = ((highest_price - entry_p) / entry_p) * 100.0
                        if gain_pct >= trailing_activation_pct:
                            position["trailing_active"] = True
                            if trailing_type == "ATR_DYNAMIC" and len(atr_series) > i and atr_series[i] > 0:
                                dist = atr_series[i] * trailing_atr_mult
                            elif trailing_type == "STEP_RATCHET":
                                if gain_pct >= trailing_activation_pct * 2.0:
                                    dist = highest_price * (trailing_distance_pct * 0.5 / 100.0)
                                else:
                                    dist = highest_price * (trailing_distance_pct / 100.0)
                                    position["sl"] = max(position["sl"], entry_p * 1.001)
                            else:
                                dist = highest_price * (trailing_distance_pct / 100.0)
                            new_sl = max(position["sl"], highest_price - dist)
                            position["sl"] = new_sl
                    elif p_type == "SHORT":
                        lowest_price = min(position.get("lowest_price", entry_p), k.low)
                        position["lowest_price"] = lowest_price
                        gain_pct = ((entry_p - lowest_price) / entry_p) * 100.0
                        if gain_pct >= trailing_activation_pct:
                            position["trailing_active"] = True
                            if trailing_type == "ATR_DYNAMIC" and len(atr_series) > i and atr_series[i] > 0:
                                dist = atr_series[i] * trailing_atr_mult
                            elif trailing_type == "STEP_RATCHET":
                                if gain_pct >= trailing_activation_pct * 2.0:
                                    dist = lowest_price * (trailing_distance_pct * 0.5 / 100.0)
                                else:
                                    dist = lowest_price * (trailing_distance_pct / 100.0)
                                    position["sl"] = min(position["sl"], entry_p * 0.999)
                            else:
                                dist = lowest_price * (trailing_distance_pct / 100.0)
                            new_sl = min(position["sl"], lowest_price + dist)
                            position["sl"] = new_sl

                sl_p = position["sl"]
                tp_p = position["tp"]
                exit_triggered = False
                exit_price = cur_price
                exit_reason = ""
                pnl_val = 0.0

                if p_type == "LONG":
                    if k.low <= liq_p:
                        exit_triggered, exit_price, pnl_val = True, liq_p, -margin_allocated if m_type == "ISOLATED" else -capital
                        exit_reason = "LIQUIDATION" if m_type == "ISOLATED" else "MARGIN_CALL_LIQUIDATION"
                    elif k.low <= sl_p:
                        exit_triggered, exit_price, exit_reason = True, sl_p, "TRAILING_STOP" if position.get("trailing_active") else "STOP_LOSS"
                        pnl_val = (exit_price - entry_p) * qty
                    elif k.high >= tp_p:
                        exit_triggered, exit_price, exit_reason = True, tp_p, "TAKE_PROFIT"
                        pnl_val = (exit_price - entry_p) * qty
                    else:
                        exit_signal = self._check_exit_signal(strat, i, "LONG", cur_price, k, close_prices, rsi_series, rsi_overbought, rsi_oversold, don_up, don_low, cmf_series, adx_series, ema_series, stoch_k, cvd_series, obv_series, vwap_series, chop_series, bb_lower, kc_lower, st_dir, plus_di, minus_di)
                        if exit_signal:
                            exit_triggered, exit_price, exit_reason, pnl_val = True, cur_price, exit_signal, (exit_price - entry_p) * qty
                    if exit_triggered:
                        if m_type == "ISOLATED": pnl_val = max(pnl_val, -margin_allocated)
                        else: pnl_val = max(pnl_val, -capital)
                elif p_type == "SHORT":
                    if k.high >= liq_p:
                        exit_triggered, exit_price, pnl_val = True, liq_p, -margin_allocated if m_type == "ISOLATED" else -capital
                        exit_reason = "LIQUIDATION" if m_type == "ISOLATED" else "MARGIN_CALL_LIQUIDATION"
                    elif k.high >= sl_p:
                        exit_triggered, exit_price, exit_reason = True, sl_p, "TRAILING_STOP" if position.get("trailing_active") else "STOP_LOSS"
                        pnl_val = (entry_p - exit_price) * qty
                    elif k.low <= tp_p:
                        exit_triggered, exit_price, exit_reason = True, tp_p, "TAKE_PROFIT"
                        pnl_val = (entry_p - exit_price) * qty
                    else:
                        exit_signal = self._check_exit_signal(strat, i, "SHORT", cur_price, k, close_prices, rsi_series, rsi_oversold, rsi_overbought, don_up, don_low, cmf_series, adx_series, ema_series, stoch_k, cvd_series, obv_series, vwap_series, chop_series, bb_upper, kc_upper, st_dir, plus_di, minus_di)
                        if exit_signal:
                            exit_triggered, exit_price, exit_reason, pnl_val = True, cur_price, exit_signal, (entry_p - exit_price) * qty
                    if exit_triggered:
                        if m_type == "ISOLATED": pnl_val = max(pnl_val, -margin_allocated)
                        else: pnl_val = max(pnl_val, -capital)

                if exit_triggered:
                    pnl_pct = (pnl_val / margin_allocated) * 100.0 if margin_allocated > 0 else 0.0
                    capital += pnl_val
                    if capital < 0: capital = 0.0
                    returns_list.append(pnl_pct)
                    if pnl_val > 0: gross_profit += pnl_val
                    else: gross_loss += abs(pnl_val)
                    trades.append(Trade(
                        id=f"T-{len(trades)+1}", symbol=symbol, side="BUY" if p_type == "LONG" else "SELL",
                        entry_price=round(entry_p, 4), exit_price=round(exit_price, 4),
                        entry_time=position["time"], exit_time=timestamp_str,
                        quantity=round(qty, 4), pnl=round(pnl_val, 2), pnl_pct=round(pnl_pct, 2),
                        exit_reason=exit_reason
                    ))
                    position = None

            if capital > peak_capital: peak_capital = capital
            dd = ((peak_capital - capital) / peak_capital) * 100.0 if peak_capital > 0 else 100.0
            if dd > max_drawdown_pct: max_drawdown_pct = dd

            if not position and capital > 0:
                is_long, is_short = self._check_entry_signal(strat, i, cur_price, k, close_prices, rsi_series, rsi_oversold, rsi_overbought, volumes, volume_threshold_ratio, don_up, don_low, cmf_series, cmf_threshold, ema_series, ema_filter_period, adx_series, plus_di, minus_di, st_dir, stoch_k, bb_upper, bb_lower, kc_upper, kc_lower, st_line, cvd_series, obv_series, vwap_series, chop_series, ich, klines, pivots_list, crt_lookback, crt_range_lookback, crt_min_range_pct, crt_sweep_confirmation_bars)

                if is_long or is_short:
                    if pos_type == "PERCENT": margin_allocated = capital * (pos_val / 100.0)
                    else: margin_allocated = min(pos_val, capital)
                    if margin_allocated <= 0: continue

                    notional_val = margin_allocated * lev
                    qty = notional_val / cur_price

                    if is_long:
                        if use_atr_stop and len(atr_series) > i and atr_series[i] > 0:
                            cur_atr = atr_series[i]
                            sl = cur_price - (cur_atr * atr_multiplier)
                            tp = cur_price + (cur_atr * atr_multiplier * (take_profit_pct / max(0.1, stop_loss_pct)))
                        else:
                            sl = cur_price * (1.0 - (stop_loss_pct / 100.0))
                            tp = cur_price * (1.0 + (take_profit_pct / 100.0))
                        liq_p = cur_price * (1.0 - (1.0 / lev)) if m_type == "ISOLATED" else max(0.0, cur_price - (capital / qty))
                        position = {"type": "LONG", "entry_price": cur_price, "highest_price": cur_price,
                                     "lowest_price": cur_price, "trailing_active": False, "time": timestamp_str,
                                     "margin_allocated": margin_allocated, "qty": qty, "liq_price": liq_p, "sl": sl, "tp": tp}
                    elif is_short:
                        if use_atr_stop and len(atr_series) > i and atr_series[i] > 0:
                            cur_atr = atr_series[i]
                            sl = cur_price + (cur_atr * atr_multiplier)
                            tp = cur_price - (cur_atr * atr_multiplier * (take_profit_pct / max(0.1, stop_loss_pct)))
                        else:
                            sl = cur_price * (1.0 + (stop_loss_pct / 100.0))
                            tp = cur_price * (1.0 - (take_profit_pct / 100.0))
                        liq_p = cur_price * (1.0 + (1.0 / lev)) if m_type == "ISOLATED" else cur_price + (capital / qty)
                        position = {"type": "SHORT", "entry_price": cur_price, "highest_price": cur_price,
                                     "lowest_price": cur_price, "trailing_active": False, "time": timestamp_str,
                                     "margin_allocated": margin_allocated, "qty": qty, "liq_price": liq_p, "sl": sl, "tp": tp}

        total_pnl = capital - initial_capital
        total_pnl_pct = (total_pnl / initial_capital) * 100.0
        total_trades = len(trades)
        winning_trades = sum(1 for t in trades if t.pnl > 0)
        losing_trades = sum(1 for t in trades if t.pnl <= 0)
        win_rate_pct = (winning_trades / total_trades * 100.0) if total_trades > 0 else 0.0
        profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else (gross_profit if gross_profit > 0 else 1.0)

        if returns_list and len(returns_list) > 1:
            avg_ret = sum(returns_list) / len(returns_list)
            variance = sum((r - avg_ret) ** 2 for r in returns_list) / (len(returns_list) - 1)
            std_dev = math.sqrt(variance)
            sharpe = (avg_ret / std_dev) * math.sqrt(252) if std_dev > 0 else 0.0
        else:
            sharpe = 0.0

        params_dict = {
            "strategy": strat, "rsi_period": rsi_period, "rsi_oversold": rsi_oversold,
            "rsi_overbought": rsi_overbought, "volume_threshold_ratio": volume_threshold_ratio,
            "donchian_period": donchian_period, "cmf_period": cmf_period, "cmf_threshold": cmf_threshold,
            "ema_filter_period": ema_filter_period, "use_atr_stop": use_atr_stop, "atr_period": atr_period,
            "atr_multiplier": atr_multiplier, "use_trailing_stop": use_trailing_stop,
            "trailing_activation_pct": trailing_activation_pct, "trailing_distance_pct": trailing_distance_pct,
            "trailing_type": trailing_type, "trailing_atr_mult": trailing_atr_mult,
            "stop_loss_pct": stop_loss_pct, "take_profit_pct": take_profit_pct, "leverage": lev,
            "margin_type": m_type, "position_sizing_type": pos_type, "position_size_value": pos_val,
            "candle_limit": limit
        }

        return BacktestResult(
            symbol=symbol, timeframe=timeframe, initial_capital=round(initial_capital, 2),
            final_capital=round(capital, 2), total_pnl=round(total_pnl, 2),
            total_pnl_pct=round(total_pnl_pct, 2), win_rate_pct=round(win_rate_pct, 2),
            total_trades=total_trades, winning_trades=winning_trades, losing_trades=losing_trades,
            max_drawdown_pct=round(max_drawdown_pct, 2), profit_factor=round(profit_factor, 2),
            sharpe_ratio=round(sharpe, 2), parameters=params_dict, trades=trades
        )

    def _check_entry_signal(self, strat, i, cur_price, k, close_prices, rsi_series,
                             rsi_oversold, rsi_overbought, volumes, volume_threshold_ratio,
                             don_up, don_low, cmf_series, cmf_threshold, ema_series, ema_filter_period,
                             adx_series, plus_di, minus_di, st_dir, stoch_k, bb_upper, bb_lower,
                             kc_upper, kc_lower, st_line, cvd_series, obv_series, vwap_series,
                             chop_series, ich, klines, pivots_list,
                             crt_lookback=50, crt_range_lookback=5, crt_min_range_pct=0.2,
                             crt_sweep_confirmation_bars=3) -> tuple:
        is_long, is_short = False, False

        if strat == "rsi_volume":
            hist_vols = volumes[max(0, i - 20):i]
            avg_vol = sum(hist_vols) / len(hist_vols) if hist_vols else 1.0
            is_vol_spike = volumes[i] >= (avg_vol * volume_threshold_ratio) if i < len(volumes) else False
            cur_rsi = rsi_series[i] if i < len(rsi_series) else 50.0
            if cur_rsi <= rsi_oversold and is_vol_spike: is_long = True
            elif cur_rsi >= rsi_overbought and is_vol_spike: is_short = True

        elif strat == "donchian_cmf":
            if i >= len(don_up) or i >= len(cmf_series): return False, False
            cur_cmf = cmf_series[i]
            ema_v = ema_series[i] if (ema_filter_period > 0 and len(ema_series) > i) else None
            if cur_price > don_up[i] and cur_cmf >= cmf_threshold:
                if ema_v is None or cur_price > ema_v: is_long = True
            elif cur_price < don_low[i] and cur_cmf <= -cmf_threshold:
                if ema_v is None or cur_price < ema_v: is_short = True

        elif strat == "vwap_reversion":
            if i >= len(vwap_series) or i >= len(rsi_series) or i >= len(chop_series): return False, False
            pct_below = (cur_price - vwap_series[i]) / vwap_series[i] * 100.0 if vwap_series[i] > 0 else 0
            if pct_below <= -vwap_deviation_pct and rsi_series[i] < rsi_oversold and chop_series[i] > chop_threshold: is_long = True
            elif pct_below >= vwap_deviation_pct and rsi_series[i] > rsi_overbought and chop_series[i] > chop_threshold: is_short = True

        elif strat == "donchian_breakout":
            if i >= len(don_up) or i >= len(adx_series) or i >= len(plus_di) or i >= len(minus_di): return False, False
            if cur_price > don_up[i] and adx_series[i] > 20 and plus_di[i] > minus_di[i]: is_long = True
            elif cur_price < don_low[i] and adx_series[i] > 20 and minus_di[i] > plus_di[i]: is_short = True

        elif strat == "supertrend_pullback":
            if i >= len(st_dir) or i >= len(stoch_k): return False, False
            cur_dir = st_dir[i]
            if i > 0 and stoch_k[i - 1] < 20 and stoch_k[i] >= 20 and cur_dir == "BULL": is_long = True
            elif i > 0 and stoch_k[i - 1] > 80 and stoch_k[i] <= 80 and cur_dir == "BEAR": is_short = True

        elif strat == "squeeze_breakout":
            if i >= len(bb_upper) or i >= len(bb_lower) or i >= len(kc_upper) or i >= len(kc_lower) or i < 2: return False, False
            prev_squeeze = bb_lower[i - 1] > kc_lower[i - 1] and bb_upper[i - 1] < kc_upper[i - 1]
            cur_squeeze = bb_lower[i] > kc_lower[i] and bb_upper[i] < kc_upper[i]
            if prev_squeeze and not cur_squeeze and cur_price > bb_upper[i]: is_long = True
            elif prev_squeeze and not cur_squeeze and cur_price < bb_lower[i]: is_short = True

        elif strat == "orderflow_divergence":
            if i >= len(cvd_series) or i >= len(obv_series): return False, False
            lookback = min(orderflow_lookback, i)
            if lookback < 5: return False, False
            price_min_idx = min(range(lookback + 1), key=lambda j: close_prices[i - lookback + j])
            abs_min_idx = i - lookback + price_min_idx
            if close_prices[i] <= close_prices[abs_min_idx] and cvd_series[i] > cvd_series[abs_min_idx] and obv_series[i] > obv_series[abs_min_idx]: is_long = True
            price_max_idx = max(range(lookback + 1), key=lambda j: close_prices[i - lookback + j])
            abs_max_idx = i - lookback + price_max_idx
            if close_prices[i] >= close_prices[abs_max_idx] and cvd_series[i] < cvd_series[abs_max_idx] and obv_series[i] < obv_series[abs_max_idx]: is_short = True

        elif strat == "funding_sentiment":
            if i >= len(cvd_series) or i < 2: return False, False
            if cvd_series[i] > cvd_series[i - 1]: is_long = True
            elif cvd_series[i] < cvd_series[i - 1]: is_short = True

        elif strat == "ichimoku_cloud":
            if not ich or i < ichimoku_kijun: return False, False
            tk_vals = ich.get("tenkan", [])
            kj_vals = ich.get("kijun", [])
            sa_vals = ich.get("senkou_a", [])
            sb_vals = ich.get("senkou_b", [])
            if i >= len(tk_vals) or i >= len(sa_vals) or i >= len(sb_vals): return False, False
            cloud_top = max(sa_vals[i], sb_vals[i])
            cloud_bot = min(sa_vals[i], sb_vals[i])
            tk_cross_up = tk_vals[i - 1] <= kj_vals[i - 1] and tk_vals[i] > kj_vals[i]
            tk_cross_down = tk_vals[i - 1] >= kj_vals[i - 1] and tk_vals[i] < kj_vals[i]
            if cur_price > cloud_top and tk_cross_up and sa_vals[i] > sb_vals[i]: is_long = True
            elif cur_price < cloud_bot and tk_cross_down and sa_vals[i] < sb_vals[i]: is_short = True

        elif strat == "pivot_points":
            if i >= len(pivots_list) or not pivots_list[i]: return False, False
            piv = pivots_list[i]
            r1, s1 = piv.get("R1", 0), piv.get("S1", 0)
            hist_vols = volumes[max(0, i - 20):i]
            avg_vol = sum(hist_vols) / len(hist_vols) if hist_vols else 1.0
            above_avg = volumes[i] > avg_vol if i < len(volumes) else False
            if r1 > 0 and cur_price > r1 and above_avg: is_long = True
            elif s1 > 0 and cur_price < s1 and above_avg: is_short = True

        elif strat == "candle_range_theory":
            if i < crt_lookback + crt_range_lookback + crt_sweep_confirmation_bars + 5:
                return False, False

            supports, resistances = calculate_support_resistance(klines, lookback=crt_lookback, num_levels=3)

            for rb_start in range(max(0, i - crt_lookback - crt_range_lookback - crt_sweep_confirmation_bars - 10), i - crt_lookback - 5):
                range_end = rb_start + crt_range_lookback
                if range_end >= i:
                    continue

                range_highs = [klines[j].high for j in range(rb_start, range_end + 1)]
                range_lows = [klines[j].low for j in range(rb_start, range_end + 1)]
                range_high = max(range_highs)
                range_low = min(range_lows)
                range_pct = (range_high - range_low) / range_low * 100 if range_low > 0 else 0

                if range_pct < crt_min_range_pct:
                    continue

                in_important_zone = False
                for sup in supports:
                    if abs(range_low - sup) / sup < 0.01 or abs(range_high - sup) / sup < 0.01:
                        in_important_zone = True
                        break
                for res in resistances:
                    if abs(range_low - res) / res < 0.01 or abs(range_high - res) / res < 0.01:
                        in_important_zone = True
                        break

                if not in_important_zone:
                    continue

                breakout_high = False
                breakout_low = False
                for j in range(range_end + 1, min(i + 1, range_end + crt_sweep_confirmation_bars + 5)):
                    if j < len(klines):
                        if klines[j].high > range_high:
                            breakout_high = True
                        if klines[j].low < range_low:
                            breakout_low = True

                if not breakout_high and not breakout_low:
                    continue

                if breakout_high:
                    sweep_reverted = False
                    for j in range(range_end + 1, min(i + 1, range_end + crt_sweep_confirmation_bars + 1)):
                        if j < len(klines) and klines[j].low <= range_low:
                            sweep_reverted = True
                            break
                    if sweep_reverted:
                        is_short = True

                if breakout_low:
                    sweep_reverted = False
                    for j in range(range_end + 1, min(i + 1, range_end + crt_sweep_confirmation_bars + 1)):
                        if j < len(klines) and klines[j].high >= range_high:
                            sweep_reverted = True
                            break
                    if sweep_reverted:
                        is_long = True

        return is_long, is_short

    def _check_exit_signal(self, strat, i, pos_type, cur_price, k, close_prices,
                            rsi_series, rsi_overbought, rsi_oversold, don_up, don_low,
                            cmf_series, adx_series, ema_series, stoch_k, cvd_series, obv_series,
                            vwap_series, chop_series, band_extremes, kc_extremes, st_dir,
                            plus_di=None, minus_di=None) -> Optional[str]:
        if strat == "rsi_volume":
            if i < len(rsi_series):
                if pos_type == "LONG" and rsi_series[i] >= rsi_overbought: return "SIGNAL_CHANGE"
                elif pos_type == "SHORT" and rsi_series[i] <= rsi_oversold: return "SIGNAL_CHANGE"

        elif strat == "donchian_cmf":
            if i < len(don_low) and i < len(cmf_series):
                if pos_type == "LONG" and (cur_price < don_low[i] or cmf_series[i] < 0): return "DONCHIAN_EXIT"
                elif pos_type == "SHORT" and (cur_price > don_up[i] or cmf_series[i] > 0): return "DONCHIAN_EXIT"

        elif strat == "donchian_breakout":
            if i < len(don_low) and i < len(adx_series) and i < len(plus_di) and i < len(minus_di):
                if pos_type == "LONG" and (cur_price < don_low[i] or (adx_series[i] > 20 and minus_di[i] > plus_di[i])): return "DONCHIAN_EXIT"
                elif pos_type == "SHORT" and (cur_price > don_up[i] or (adx_series[i] > 20 and plus_di[i] > minus_di[i])): return "DONCHIAN_EXIT"

        elif strat == "vwap_reversion":
            if i < len(vwap_series) and i < len(rsi_series):
                pct = (cur_price - vwap_series[i]) / vwap_series[i] * 100 if vwap_series[i] > 0 else 0
                if pos_type == "LONG" and pct >= vwap_deviation_pct: return "VWAP_EXIT"
                elif pos_type == "SHORT" and pct <= -vwap_deviation_pct: return "VWAP_EXIT"

        elif strat == "supertrend_pullback":
            if i < len(st_dir):
                if pos_type == "LONG" and st_dir[i] == "BEAR": return "STREND_EXIT"
                elif pos_type == "SHORT" and st_dir[i] == "BULL": return "STREND_EXIT"

        elif strat == "squeeze_breakout":
            if i < len(band_extremes) and i < len(kc_extremes):
                if pos_type == "LONG" and cur_price < band_extremes[i]: return "SQUEEZE_EXIT"
                elif pos_type == "SHORT" and cur_price > band_extremes[i]: return "SQUEEZE_EXIT"

        elif strat == "orderflow_divergence":
            if i > 0 and i < len(cvd_series) and i < len(obv_series):
                if pos_type == "LONG" and cvd_series[i] < cvd_series[i - 1] and obv_series[i] < obv_series[i - 1]: return "FLOW_EXIT"
                elif pos_type == "SHORT" and cvd_series[i] > cvd_series[i - 1] and obv_series[i] > obv_series[i - 1]: return "FLOW_EXIT"

        elif strat == "funding_sentiment":
            if i > 0 and i < len(cvd_series):
                if pos_type == "LONG" and cvd_series[i] < cvd_series[i - 1]: return "FLOW_EXIT"
                elif pos_type == "SHORT" and cvd_series[i] > cvd_series[i - 1]: return "FLOW_EXIT"

        elif strat == "ichimoku_cloud":
            pass

        elif strat == "pivot_points":
            if i < len(close_prices) and i >= pivot_vol_period:
                hist = close_prices[max(0, i - pivot_vol_period):i]
                avg = sum(hist) / len(hist) if hist else cur_price
                exit_mult = pivot_exit_pct / 100.0
                if pos_type == "LONG" and cur_price < avg * (1 - exit_mult): return "PIVOT_EXIT"
                elif pos_type == "SHORT" and cur_price > avg * (1 + exit_mult): return "PIVOT_EXIT"

        return None
