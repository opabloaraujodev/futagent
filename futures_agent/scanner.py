import datetime
from typing import List, Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor
from futures_agent.binance_client import BinanceFuturesClient
from futures_agent.indicators import (
    calculate_rsi,
    calculate_volume_spike,
    calculate_support_resistance,
    calculate_entry_zones,
    calculate_donchian_channels,
    calculate_cmf,
    calculate_ema,
    calculate_bollinger_bands,
    calculate_macd,
    calculate_supertrend,
    calculate_candle_range_theory
)
from futures_agent.models import ScanResult
from futures_agent.ollama_advisor import OllamaAdvisor
from futures_agent.data_loader import load_historical_klines_from_json
from futures_agent.config import (
    DEFAULT_SYMBOLS,
    DEFAULT_RSI_PERIOD,
    DEFAULT_RSI_OVERSOLD,
    DEFAULT_RSI_OVERBOUGHT,
    DEFAULT_VOLUME_RATIO,
    DEFAULT_TIMEFRAME
)

class MarketScanner:
    def __init__(self, client: Optional[BinanceFuturesClient] = None, advisor: Optional[OllamaAdvisor] = None):
        self.client = client or BinanceFuturesClient()
        self.advisor = advisor or OllamaAdvisor()

    def scan_symbol(
        self,
        symbol: str,
        timeframe: str = DEFAULT_TIMEFRAME,
        strategy: str = "rsi_volume",
        rsi_period: int = DEFAULT_RSI_PERIOD,
        rsi_oversold: float = DEFAULT_RSI_OVERSOLD,
        rsi_overbought: float = DEFAULT_RSI_OVERBOUGHT,
        volume_threshold_ratio: float = DEFAULT_VOLUME_RATIO,
        donchian_period: int = 20,
        cmf_period: int = 20,
        cmf_threshold: float = 0.05,
        ema_fast_period: int = 9,
        ema_slow_period: int = 21,
        bb_period: int = 20,
        bb_std_dev: float = 2.0,
        macd_fast: int = 12,
        macd_slow: int = 26,
        macd_signal: int = 9,
        supertrend_period: int = 10,
        supertrend_multiplier: float = 3.0,
        crt_lookback: int = 1,
        with_ollama: bool = False,
        ollama_model: str = "",
        use_local_json: bool = False,
        data_dir: str = "/mnt/e/datadown/data/monthly/15m",
        periods: Optional[List[str]] = None,
        start_period: Optional[str] = None,
        end_period: Optional[str] = None
    ) -> Optional[ScanResult]:
        """Varre um símbolo individual e calcula seus indicadores técnicos"""
        try:
            if use_local_json:
                klines = load_historical_klines_from_json(
                    symbol=symbol,
                    timeframe=timeframe,
                    data_dir=data_dir,
                    periods=periods,
                    start_period=start_period,
                    end_period=end_period
                )
            else:
                klines = self.client.get_klines(symbol, interval=timeframe, limit=100)

            if len(klines) < rsi_period + 5:
                return None

            close_prices = [k.close for k in klines]
            volumes = [k.volume for k in klines]
            current_price = close_prices[-1]

            rsi_series = calculate_rsi(close_prices, period=rsi_period)
            current_rsi = round(rsi_series[-1], 2)

            is_spike, cur_vol, avg_vol, ratio_pct = calculate_volume_spike(
                volumes, period=20, threshold_ratio=volume_threshold_ratio
            )

            is_oversold = current_rsi <= rsi_oversold
            is_overbought = current_rsi >= rsi_overbought

            supports, resistances = calculate_support_resistance(klines, lookback=50, num_levels=3)
            entry_zone = calculate_entry_zones(current_price, current_rsi, supports, resistances)

            don_up, don_low, don_mid = calculate_donchian_channels(klines, period=donchian_period)
            cmf_vals = calculate_cmf(klines, period=cmf_period)
            cur_don_up = don_up[-1] if don_up else current_price
            cur_don_low = don_low[-1] if don_low else current_price
            cur_cmf = cmf_vals[-1] if cmf_vals else 0.0

            ema_fast = calculate_ema(close_prices, ema_fast_period)
            ema_slow = calculate_ema(close_prices, ema_slow_period)
            bb_up, bb_low, bb_mid = calculate_bollinger_bands(close_prices, bb_period, bb_std_dev)
            macd_l, macd_s, macd_h = calculate_macd(close_prices, macd_fast, macd_slow, macd_signal)
            st_line, st_dir = calculate_supertrend(klines, supertrend_period, supertrend_multiplier)
            crt_sigs, crt_h, crt_l = calculate_candle_range_theory(klines, crt_lookback)

            s_upper = str(strategy).upper()
            signal = "NEUTRAL"

            if "DONCHIAN" in s_upper or "CMF" in s_upper:
                if current_price > cur_don_up and cur_cmf >= 0.05:
                    signal = "LONG_ALERT"
                elif current_price < cur_don_low and cur_cmf <= -0.05:
                    signal = "SHORT_ALERT"
            elif "EMA" in s_upper or "CROSS" in s_upper:
                if len(ema_fast) > 1 and ema_fast[-1] > ema_slow[-1] and ema_fast[-2] <= ema_slow[-2]:
                    signal = "LONG_ALERT"
                elif len(ema_fast) > 1 and ema_fast[-1] < ema_slow[-1] and ema_fast[-2] >= ema_slow[-2]:
                    signal = "SHORT_ALERT"
            elif "BOLLINGER" in s_upper or "BB" in s_upper:
                if current_price <= bb_low[-1] and current_rsi <= rsi_oversold:
                    signal = "LONG_ALERT"
                elif current_price >= bb_up[-1] and current_rsi >= rsi_overbought:
                    signal = "SHORT_ALERT"
            elif "MACD" in s_upper:
                if len(macd_h) > 1 and macd_h[-1] > 0 and macd_h[-2] <= 0 and is_spike:
                    signal = "LONG_ALERT"
                elif len(macd_h) > 1 and macd_h[-1] < 0 and macd_h[-2] >= 0 and is_spike:
                    signal = "SHORT_ALERT"
            elif "SUPER" in s_upper or "SUPERTREND" in s_upper:
                if len(st_dir) > 1 and st_dir[-1] == 1 and st_dir[-2] == -1:
                    signal = "LONG_ALERT"
                elif len(st_dir) > 1 and st_dir[-1] == -1 and st_dir[-2] == 1:
                    signal = "SHORT_ALERT"
            elif "CRT" in s_upper or "CANDLE" in s_upper or "RANGE" in s_upper or "SWEEP" in s_upper:
                if len(crt_sigs) > 0 and crt_sigs[-1] == 1:
                    signal = "LONG_ALERT"
                elif len(crt_sigs) > 0 and crt_sigs[-1] == -1:
                    signal = "SHORT_ALERT"
            else:  # rsi_volume
                if is_oversold and is_spike:
                    signal = "LONG_ALERT"
                elif is_overbought and is_spike:
                    signal = "SHORT_ALERT"
                elif is_oversold:
                    signal = "LONG_ALERT"
                elif is_overbought:
                    signal = "SHORT_ALERT"

            scan_res = ScanResult(
                symbol=symbol.upper(),
                price=current_price,
                rsi=current_rsi,
                volume_current=round(cur_vol, 2),
                volume_avg=round(avg_vol, 2),
                volume_ratio_pct=ratio_pct,
                is_volume_spike=is_spike,
                is_rsi_oversold=is_oversold,
                is_rsi_overbought=is_overbought,
                support_levels=supports,
                resistance_levels=resistances,
                entry_zone=entry_zone,
                signal=signal,
                timestamp=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                donchian_upper=cur_don_up,
                donchian_lower=cur_don_low,
                cmf=cur_cmf
            )

            if with_ollama:
                rec = self.advisor.analyze(scan_res.to_dict(), model_override=ollama_model)
                scan_res.recommendation = rec

            return scan_res
        except Exception as e:
            return None

    def scan_markets(
        self,
        symbols: Optional[List[str]] = None,
        timeframe: str = DEFAULT_TIMEFRAME,
        strategy: str = "rsi_volume",
        rsi_period: int = DEFAULT_RSI_PERIOD,
        rsi_oversold: float = DEFAULT_RSI_OVERSOLD,
        rsi_overbought: float = DEFAULT_RSI_OVERBOUGHT,
        volume_threshold_ratio: float = DEFAULT_VOLUME_RATIO,
        donchian_period: int = 20,
        cmf_period: int = 20,
        cmf_threshold: float = 0.05,
        ema_fast_period: int = 9,
        ema_slow_period: int = 21,
        bb_period: int = 20,
        bb_std_dev: float = 2.0,
        macd_fast: int = 12,
        macd_slow: int = 26,
        macd_signal: int = 9,
        supertrend_period: int = 10,
        supertrend_multiplier: float = 3.0,
        crt_lookback: int = 1,
        only_filtered: bool = True,
        with_ollama: bool = False,
        ollama_model: str = "",
        use_local_json: bool = False,
        data_dir: str = "/mnt/e/datadown/data/monthly/15m",
        periods: Optional[List[str]] = None,
        start_period: Optional[str] = None,
        end_period: Optional[str] = None
    ) -> List[ScanResult]:
        """
        Varre múltiplos símbolos em paralelo e retorna os contratos que atendem aos critérios.
        """
        symbols_to_scan = symbols or DEFAULT_SYMBOLS

        def _do_scan(sym: str) -> Optional[ScanResult]:
            return self.scan_symbol(
                symbol=sym,
                timeframe=timeframe,
                strategy=strategy,
                rsi_period=rsi_period,
                rsi_oversold=rsi_oversold,
                rsi_overbought=rsi_overbought,
                volume_threshold_ratio=volume_threshold_ratio,
                donchian_period=donchian_period,
                cmf_period=cmf_period,
                cmf_threshold=cmf_threshold,
                ema_fast_period=ema_fast_period,
                ema_slow_period=ema_slow_period,
                bb_period=bb_period,
                bb_std_dev=bb_std_dev,
                macd_fast=macd_fast,
                macd_slow=macd_slow,
                macd_signal=macd_signal,
                supertrend_period=supertrend_period,
                supertrend_multiplier=supertrend_multiplier,
                crt_lookback=crt_lookback,
                with_ollama=with_ollama,
                ollama_model=ollama_model,
                use_local_json=use_local_json,
                data_dir=data_dir,
                periods=periods,
                start_period=start_period,
                end_period=end_period
            )

        results = []
        max_workers = min(12, len(symbols_to_scan))
        if max_workers > 1:
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                scanned_items = list(executor.map(_do_scan, symbols_to_scan))
            for res in scanned_items:
                if res is not None:
                    if only_filtered:
                        if res.signal in ["LONG_ALERT", "SHORT_ALERT"]:
                            results.append(res)
                    else:
                        results.append(res)
        else:
            for sym in symbols_to_scan:
                res = _do_scan(sym)
                if res is not None:
                    if only_filtered:
                        if res.signal in ["LONG_ALERT", "SHORT_ALERT"]:
                            results.append(res)
                    else:
                        results.append(res)

        return results
