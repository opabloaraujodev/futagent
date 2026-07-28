import datetime
import math
from typing import List, Dict, Any, Optional
from futures_agent.binance_client import BinanceFuturesClient
from futures_agent.indicators import (
    calculate_rsi,
    calculate_volume_spike,
    calculate_donchian_channels,
    calculate_cmf,
    calculate_ema,
    calculate_atr,
    calculate_bollinger_bands,
    calculate_macd,
    calculate_supertrend,
    calculate_candle_range_theory
)
from futures_agent.models import BacktestResult, Trade
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
        ema_fast: int = 9,
        ema_slow: int = 21,
        bb_period: int = 20,
        bb_std_dev: float = 2.0,
        macd_fast: int = 12,
        macd_slow: int = 26,
        macd_signal: int = 9,
        supertrend_period: int = 10,
        supertrend_multiplier: float = 3.0,
        crt_lookback: int = 1,
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
        leverage: float = 10.0,
        margin_type: str = "ISOLATED",
        position_sizing_type: str = "PERCENT",
        position_size_value: float = 10.0,
        limit: int = 500,
        klines_input: Optional[List] = None,
        use_local_json: bool = False,
        data_dir: str = "/mnt/e/datadown/data/monthly/15m",
        periods: Optional[List[str]] = None,
        start_period: Optional[str] = None,
        end_period: Optional[str] = None
    ) -> Any:
        """Executa simulação de backtest sobre klines históricas com suporte a múltiplos símbolos e parâmetros customizáveis"""
        # Suporte a múltiplos símbolos separados por vírgula
        if isinstance(symbol, str) and "," in symbol:
            sym_list = [s.strip().upper() for s in symbol.split(",") if s.strip()]
            multi_results = []
            for sym in sym_list:
                res = self.run_backtest(
                    symbol=sym,
                    timeframe=timeframe,
                    initial_capital=initial_capital,
                    strategy=strategy,
                    rsi_period=rsi_period,
                    rsi_oversold=rsi_oversold,
                    rsi_overbought=rsi_overbought,
                    volume_threshold_ratio=volume_threshold_ratio,
                    donchian_period=donchian_period,
                    cmf_period=cmf_period,
                    cmf_threshold=cmf_threshold,
                    ema_filter_period=ema_filter_period,
                    ema_fast=ema_fast,
                    ema_slow=ema_slow,
                    bb_period=bb_period,
                    bb_std_dev=bb_std_dev,
                    macd_fast=macd_fast,
                    macd_slow=macd_slow,
                    macd_signal=macd_signal,
                    supertrend_period=supertrend_period,
                    supertrend_multiplier=supertrend_multiplier,
                    crt_lookback=crt_lookback,
                    use_atr_stop=use_atr_stop,
                    atr_period=atr_period,
                    atr_multiplier=atr_multiplier,
                    use_trailing_stop=use_trailing_stop,
                    trailing_activation_pct=trailing_activation_pct,
                    trailing_distance_pct=trailing_distance_pct,
                    trailing_type=trailing_type,
                    trailing_atr_mult=trailing_atr_mult,
                    stop_loss_pct=stop_loss_pct,
                    take_profit_pct=take_profit_pct,
                    leverage=leverage,
                    margin_type=margin_type,
                    position_sizing_type=position_sizing_type,
                    position_size_value=position_size_value,
                    limit=limit,
                    use_local_json=use_local_json,
                    data_dir=data_dir,
                    periods=periods,
                    start_period=start_period,
                    end_period=end_period
                )
                multi_results.append(res)
            
            # Agregar métricas
            total_trades = sum(r.total_trades for r in multi_results)
            winning_trades = sum(r.winning_trades for r in multi_results)
            losing_trades = sum(r.losing_trades for r in multi_results)
            total_pnl = sum(r.total_pnl for r in multi_results)
            avg_pnl_pct = (total_pnl / (initial_capital * len(sym_list))) * 100 if len(sym_list) > 0 else 0.0
            win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0.0

            all_trades = []
            for r in multi_results:
                all_trades.extend(r.trades)

            return {
                "is_multi": True,
                "symbols": sym_list,
                "multi_results": [r.__dict__ if hasattr(r, '__dict__') else r for r in multi_results],
                "summary": {
                    "total_symbols": len(sym_list),
                    "total_pnl": round(total_pnl, 2),
                    "avg_pnl_pct": round(avg_pnl_pct, 2),
                    "total_trades": total_trades,
                    "winning_trades": winning_trades,
                    "losing_trades": losing_trades,
                    "win_rate_pct": round(win_rate, 2)
                },
                "all_trades": [t.__dict__ if hasattr(t, '__dict__') else t for t in all_trades]
            }

        lev = max(1.0, float(leverage))
        m_type = "ISOLATED" if "ISO" in str(margin_type).upper() else "CROSS"
        pos_type = "FIXED" if "FIX" in str(position_sizing_type).upper() else "PERCENT"
        pos_val = max(0.01, float(position_size_value))
        
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
        else:
            strat_mode = "rsi_volume"

        if klines_input is not None:
            klines = klines_input
        elif use_local_json:
            klines = load_historical_klines_from_json(
                symbol=symbol,
                timeframe=timeframe,
                data_dir=data_dir,
                periods=periods,
                start_period=start_period,
                end_period=end_period
            )
        else:
            klines = self.client.get_klines(symbol=symbol, interval=timeframe, limit=limit)

        params_dict = {
            "strategy": strat_mode,
            "rsi_period": rsi_period,
            "rsi_oversold": rsi_oversold,
            "rsi_overbought": rsi_overbought,
            "volume_threshold_ratio": volume_threshold_ratio,
            "donchian_period": donchian_period,
            "cmf_period": cmf_period,
            "cmf_threshold": cmf_threshold,
            "ema_filter_period": ema_filter_period,
            "use_atr_stop": use_atr_stop,
            "atr_period": atr_period,
            "atr_multiplier": atr_multiplier,
            "use_trailing_stop": use_trailing_stop,
            "trailing_activation_pct": trailing_activation_pct,
            "trailing_distance_pct": trailing_distance_pct,
            "trailing_type": trailing_type,
            "trailing_atr_mult": trailing_atr_mult,
            "stop_loss_pct": stop_loss_pct,
            "take_profit_pct": take_profit_pct,
            "leverage": lev,
            "margin_type": m_type,
            "position_sizing_type": pos_type,
            "position_size_value": pos_val,
            "candle_limit": limit
        }

        min_required = 30
        if len(klines) < min_required:
            return BacktestResult(
                symbol=symbol,
                timeframe=timeframe,
                initial_capital=initial_capital,
                final_capital=initial_capital,
                total_pnl=0.0,
                total_pnl_pct=0.0,
                win_rate_pct=0.0,
                total_trades=0,
                winning_trades=0,
                losing_trades=0,
                max_drawdown_pct=0.0,
                profit_factor=0.0,
                sharpe_ratio=0.0,
                parameters=params_dict,
                trades=[]
            )

        close_prices = [k.close for k in klines]
        volumes = [k.volume for k in klines]

        # Calcular séries de indicadores conforme estratégia selecionada
        rsi_series = calculate_rsi(close_prices, period=rsi_period)
        donchian_upper, donchian_lower, donchian_mid = calculate_donchian_channels(klines, period=donchian_period)
        cmf_series = calculate_cmf(klines, period=cmf_period)
        ema_series = calculate_ema(close_prices, period=ema_filter_period) if ema_filter_period > 0 else []
        ema_fast_series = calculate_ema(close_prices, period=ema_fast)
        ema_slow_series = calculate_ema(close_prices, period=ema_slow)
        bb_upper, bb_lower, bb_mid = calculate_bollinger_bands(close_prices, period=bb_period, std_dev=bb_std_dev)
        macd_line, macd_signal, macd_hist = calculate_macd(close_prices, fast_period=macd_fast, slow_period=macd_slow, signal_period=macd_signal)
        supertrend_line, supertrend_dir = calculate_supertrend(klines, period=supertrend_period, multiplier=supertrend_multiplier)
        crt_signals, crt_highs, crt_lows = calculate_candle_range_theory(klines, lookback_range=crt_lookback)
        atr_series = calculate_atr(klines, period=atr_period)

        capital = initial_capital
        peak_capital = initial_capital
        max_drawdown_pct = 0.0

        position = None  # None, or position dict
        trades: List[Trade] = []
        gross_profit = 0.0
        gross_loss = 0.0
        returns_list = []

        start_idx = max(rsi_period + 20, donchian_period + 1, cmf_period + 1)

        for i in range(start_idx, len(klines)):
            if capital <= 0:
                break

            k = klines[i]
            cur_price = k.close
            timestamp_str = datetime.datetime.fromtimestamp(k.timestamp / 1000).strftime("%Y-%m-%d %H:%M")

            # Gerenciar posição aberta
            if position:
                p_type = position["type"]
                entry_p = position["entry_price"]
                margin_allocated = position["margin_allocated"]
                qty = position["qty"]
                liq_p = position["liq_price"]

                # Smart Trailing Stop Logic
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
                            else:  # PERCENT
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
                            else:  # PERCENT
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
                    # Verificar Liquidação
                    if k.low <= liq_p:
                        exit_triggered = True
                        exit_price = liq_p
                        if m_type == "ISOLATED":
                            exit_reason = "LIQUIDATION"
                            pnl_val = -margin_allocated
                        else:  # CROSS
                            exit_reason = "MARGIN_CALL_LIQUIDATION"
                            pnl_val = -capital
                    elif k.low <= sl_p:
                        exit_triggered = True
                        exit_price = sl_p
                        exit_reason = "TRAILING_STOP" if position.get("trailing_active") else "STOP_LOSS"
                        pnl_val = (exit_price - entry_p) * qty
                    elif k.high >= tp_p:
                        exit_triggered = True
                        exit_price = tp_p
                        exit_reason = "TAKE_PROFIT"
                        pnl_val = (exit_price - entry_p) * qty
                    elif strat_mode == "rsi_volume" and rsi_series[i] >= rsi_overbought:
                        exit_triggered = True
                        exit_price = cur_price
                        exit_reason = "SIGNAL_CHANGE"
                        pnl_val = (exit_price - entry_p) * qty
                    elif strat_mode == "donchian_cmf" and (cur_price < donchian_lower[i] or cmf_series[i] < 0):
                        exit_triggered = True
                        exit_price = cur_price
                        exit_reason = "DONCHIAN_EXIT"
                        pnl_val = (exit_price - entry_p) * qty
                    elif strat_mode == "ema_cross" and i > 0 and ema_fast_series[i] < ema_slow_series[i]:
                        exit_triggered = True
                        exit_price = cur_price
                        exit_reason = "EMA_CROSS_EXIT"
                        pnl_val = (exit_price - entry_p) * qty
                    elif strat_mode == "bollinger_rsi" and (cur_price >= bb_mid[i] or rsi_series[i] >= 50):
                        exit_triggered = True
                        exit_price = cur_price
                        exit_reason = "BOLLINGER_EXIT"
                        pnl_val = (exit_price - entry_p) * qty
                    elif strat_mode == "macd_volume" and macd_hist[i] < 0:
                        exit_triggered = True
                        exit_price = cur_price
                        exit_reason = "MACD_EXIT"
                        pnl_val = (exit_price - entry_p) * qty
                    elif strat_mode == "supertrend_atr" and supertrend_dir[i] == -1:
                        exit_triggered = True
                        exit_price = cur_price
                        exit_reason = "SUPERTREND_EXIT"
                        pnl_val = (exit_price - entry_p) * qty
                    elif strat_mode == "crt_sweep" and (cur_price >= crt_highs[i] or crt_signals[i] == -1):
                        exit_triggered = True
                        exit_price = cur_price
                        exit_reason = "CRT_EXIT"
                        pnl_val = (exit_price - entry_p) * qty

                    if exit_triggered:
                        if m_type == "ISOLATED":
                            pnl_val = max(pnl_val, -margin_allocated)
                        else:
                            pnl_val = max(pnl_val, -capital)

                        pnl_pct = (pnl_val / margin_allocated) * 100.0 if margin_allocated > 0 else 0.0
                        capital += pnl_val
                        if capital < 0:
                            capital = 0.0
                        returns_list.append(pnl_pct)

                        if pnl_val > 0:
                            gross_profit += pnl_val
                        else:
                            gross_loss += abs(pnl_val)

                        trades.append(Trade(
                            id=f"T-{len(trades)+1}",
                            symbol=symbol,
                            side="BUY",
                            entry_price=round(entry_p, 4),
                            exit_price=round(exit_price, 4),
                            entry_time=position["time"],
                            exit_time=timestamp_str,
                            quantity=round(qty, 4),
                            pnl=round(pnl_val, 2),
                            pnl_pct=round(pnl_pct, 2),
                            exit_reason=exit_reason
                        ))
                        position = None

                elif p_type == "SHORT":
                    # Verificar Liquidação
                    if k.high >= liq_p:
                        exit_triggered = True
                        exit_price = liq_p
                        if m_type == "ISOLATED":
                            exit_reason = "LIQUIDATION"
                            pnl_val = -margin_allocated
                        else:  # CROSS
                            exit_reason = "MARGIN_CALL_LIQUIDATION"
                            pnl_val = -capital
                    elif k.high >= sl_p:
                        exit_triggered = True
                        exit_price = sl_p
                        exit_reason = "TRAILING_STOP" if position.get("trailing_active") else "STOP_LOSS"
                        pnl_val = (entry_p - exit_price) * qty
                    elif k.low <= tp_p:
                        exit_triggered = True
                        exit_price = tp_p
                        exit_reason = "TAKE_PROFIT"
                        pnl_val = (entry_p - exit_price) * qty
                    elif strat_mode == "rsi_volume" and rsi_series[i] <= rsi_oversold:
                        exit_triggered = True
                        exit_price = cur_price
                        exit_reason = "SIGNAL_CHANGE"
                        pnl_val = (entry_p - exit_price) * qty
                    elif strat_mode == "donchian_cmf" and (cur_price > donchian_upper[i] or cmf_series[i] > 0):
                        exit_triggered = True
                        exit_price = cur_price
                        exit_reason = "DONCHIAN_EXIT"
                        pnl_val = (entry_p - exit_price) * qty
                    elif strat_mode == "ema_cross" and i > 0 and ema_fast_series[i] > ema_slow_series[i]:
                        exit_triggered = True
                        exit_price = cur_price
                        exit_reason = "EMA_CROSS_EXIT"
                        pnl_val = (entry_p - exit_price) * qty
                    elif strat_mode == "bollinger_rsi" and (cur_price <= bb_mid[i] or rsi_series[i] <= 50):
                        exit_triggered = True
                        exit_price = cur_price
                        exit_reason = "BOLLINGER_EXIT"
                        pnl_val = (entry_p - exit_price) * qty
                    elif strat_mode == "macd_volume" and macd_hist[i] > 0:
                        exit_triggered = True
                        exit_price = cur_price
                        exit_reason = "MACD_EXIT"
                        pnl_val = (entry_p - exit_price) * qty
                    elif strat_mode == "supertrend_atr" and supertrend_dir[i] == 1:
                        exit_triggered = True
                        exit_price = cur_price
                        exit_reason = "SUPERTREND_EXIT"
                        pnl_val = (entry_p - exit_price) * qty
                    elif strat_mode == "crt_sweep" and (cur_price <= crt_lows[i] or crt_signals[i] == 1):
                        exit_triggered = True
                        exit_price = cur_price
                        exit_reason = "CRT_EXIT"
                        pnl_val = (entry_p - exit_price) * qty

                    if exit_triggered:
                        if m_type == "ISOLATED":
                            pnl_val = max(pnl_val, -margin_allocated)
                        else:
                            pnl_val = max(pnl_val, -capital)

                        pnl_pct = (pnl_val / margin_allocated) * 100.0 if margin_allocated > 0 else 0.0
                        capital += pnl_val
                        if capital < 0:
                            capital = 0.0
                        returns_list.append(pnl_pct)

                        if pnl_val > 0:
                            gross_profit += pnl_val
                        else:
                            gross_loss += abs(pnl_val)

                        trades.append(Trade(
                            id=f"T-{len(trades)+1}",
                            symbol=symbol,
                            side="SELL",
                            entry_price=round(entry_p, 4),
                            exit_price=round(exit_price, 4),
                            entry_time=position["time"],
                            exit_time=timestamp_str,
                            quantity=round(qty, 4),
                            pnl=round(pnl_val, 2),
                            pnl_pct=round(pnl_pct, 2),
                            exit_reason=exit_reason
                        ))
                        position = None

            # Atualizar pico e drawdown
            if capital > peak_capital:
                peak_capital = capital
            dd = ((peak_capital - capital) / peak_capital) * 100.0 if peak_capital > 0 else 100.0
            if dd > max_drawdown_pct:
                max_drawdown_pct = dd

            # Verificar novo sinal se sem posição e com capital disponível
            if not position and capital > 0:
                is_long_signal = False
                is_short_signal = False

                if strat_mode == "rsi_volume":
                    hist_vols = volumes[i - 20:i]
                    avg_vol = sum(hist_vols) / len(hist_vols) if hist_vols else 1.0
                    is_vol_spike = volumes[i] >= (avg_vol * volume_threshold_ratio)
                    cur_rsi = rsi_series[i]
                    if cur_rsi <= rsi_oversold and is_vol_spike:
                        is_long_signal = True
                    elif cur_rsi >= rsi_overbought and is_vol_spike:
                        is_short_signal = True

                elif strat_mode == "donchian_cmf":
                    up_band = donchian_upper[i]
                    low_band = donchian_lower[i]
                    cur_cmf = cmf_series[i]
                    ema_v = ema_series[i] if (ema_filter_period > 0 and len(ema_series) > i) else None

                    # Condição de Compra: Fechamento acima do canal superior + CMF positivo
                    if cur_price > up_band and cur_cmf >= cmf_threshold:
                        if ema_v is None or cur_price > ema_v:
                            is_long_signal = True

                    # Condição de Venda: Fechamento abaixo do canal inferior + CMF negativo
                    elif cur_price < low_band and cur_cmf <= -cmf_threshold:
                        if ema_v is None or cur_price < ema_v:
                            is_short_signal = True

                elif strat_mode == "ema_cross" and i > 0:
                    if ema_fast_series[i] > ema_slow_series[i] and ema_fast_series[i - 1] <= ema_slow_series[i - 1]:
                        is_long_signal = True
                    elif ema_fast_series[i] < ema_slow_series[i] and ema_fast_series[i - 1] >= ema_slow_series[i - 1]:
                        is_short_signal = True

                elif strat_mode == "bollinger_rsi":
                    cur_rsi = rsi_series[i]
                    if cur_price <= bb_lower[i] and cur_rsi <= rsi_oversold:
                        is_long_signal = True
                    elif cur_price >= bb_upper[i] and cur_rsi >= rsi_overbought:
                        is_short_signal = True

                elif strat_mode == "macd_volume" and i > 0:
                    hist_vols = volumes[i - 20:i]
                    avg_vol = sum(hist_vols) / len(hist_vols) if hist_vols else 1.0
                    is_vol_spike = volumes[i] >= (avg_vol * volume_threshold_ratio)
                    if macd_hist[i] > 0 and macd_hist[i - 1] <= 0 and is_vol_spike:
                        is_long_signal = True
                    elif macd_hist[i] < 0 and macd_hist[i - 1] >= 0 and is_vol_spike:
                        is_short_signal = True

                elif strat_mode == "supertrend_atr" and i > 0:
                    if supertrend_dir[i] == 1 and supertrend_dir[i - 1] == -1:
                        is_long_signal = True
                    elif supertrend_dir[i] == -1 and supertrend_dir[i - 1] == 1:
                        is_short_signal = True

                elif strat_mode == "crt_sweep":
                    if crt_signals[i] == 1:
                        is_long_signal = True
                    elif crt_signals[i] == -1:
                        is_short_signal = True

                # Se houver sinal de entrada, calcular margem e stop/tp
                if is_long_signal or is_short_signal:
                    if pos_type == "PERCENT":
                        margin_allocated = capital * (pos_val / 100.0)
                    else:  # FIXED
                        margin_allocated = min(pos_val, capital)

                    if margin_allocated > 0:
                        notional_val = margin_allocated * lev
                        qty = notional_val / cur_price

                        if is_long_signal:
                            if use_atr_stop and len(atr_series) > i:
                                cur_atr = atr_series[i]
                                sl = cur_price - (cur_atr * atr_multiplier)
                                tp = cur_price + (cur_atr * atr_multiplier * (take_profit_pct / max(0.1, stop_loss_pct)))
                            else:
                                sl = cur_price * (1.0 - (stop_loss_pct / 100.0))
                                tp = cur_price * (1.0 + (take_profit_pct / 100.0))

                            if m_type == "ISOLATED":
                                liq_p = cur_price * (1.0 - (1.0 / lev))
                            else:
                                liq_p = max(0.0, cur_price - (capital / qty))

                            position = {
                                "type": "LONG",
                                "entry_price": cur_price,
                                "highest_price": cur_price,
                                "lowest_price": cur_price,
                                "trailing_active": False,
                                "time": timestamp_str,
                                "margin_allocated": margin_allocated,
                                "qty": qty,
                                "liq_price": liq_p,
                                "sl": sl,
                                "tp": tp
                            }
                        elif is_short_signal:
                            if use_atr_stop and len(atr_series) > i:
                                cur_atr = atr_series[i]
                                sl = cur_price + (cur_atr * atr_multiplier)
                                tp = cur_price - (cur_atr * atr_multiplier * (take_profit_pct / max(0.1, stop_loss_pct)))
                            else:
                                sl = cur_price * (1.0 + (stop_loss_pct / 100.0))
                                tp = cur_price * (1.0 - (take_profit_pct / 100.0))

                            if m_type == "ISOLATED":
                                liq_p = cur_price * (1.0 + (1.0 / lev))
                            else:
                                liq_p = cur_price + (capital / qty)

                            position = {
                                "type": "SHORT",
                                "entry_price": cur_price,
                                "highest_price": cur_price,
                                "lowest_price": cur_price,
                                "trailing_active": False,
                                "time": timestamp_str,
                                "margin_allocated": margin_allocated,
                                "qty": qty,
                                "liq_price": liq_p,
                                "sl": sl,
                                "tp": tp
                            }

        total_pnl = capital - initial_capital
        total_pnl_pct = (total_pnl / initial_capital) * 100.0
        total_trades = len(trades)
        winning_trades = sum(1 for t in trades if t.pnl > 0)
        losing_trades = sum(1 for t in trades if t.pnl <= 0)
        win_rate_pct = (winning_trades / total_trades * 100.0) if total_trades > 0 else 0.0

        profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else (gross_profit if gross_profit > 0 else 1.0)

        # Sharpe ratio simplificado
        if returns_list and len(returns_list) > 1:
            avg_ret = sum(returns_list) / len(returns_list)
            variance = sum((r - avg_ret) ** 2 for r in returns_list) / (len(returns_list) - 1)
            std_dev = math.sqrt(variance)
            sharpe = (avg_ret / std_dev) * math.sqrt(252) if std_dev > 0 else 0.0
        else:
            sharpe = 0.0

        return BacktestResult(
            symbol=symbol,
            timeframe=timeframe,
            initial_capital=round(initial_capital, 2),
            final_capital=round(capital, 2),
            total_pnl=round(total_pnl, 2),
            total_pnl_pct=round(total_pnl_pct, 2),
            win_rate_pct=round(win_rate_pct, 2),
            total_trades=total_trades,
            winning_trades=winning_trades,
            losing_trades=losing_trades,
            max_drawdown_pct=round(max_drawdown_pct, 2),
            profit_factor=round(profit_factor, 2),
            sharpe_ratio=round(sharpe, 2),
            parameters=params_dict,
            trades=trades
        )
