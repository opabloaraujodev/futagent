import datetime
from typing import List, Dict, Any, Optional
from futures_agent.binance_client import BinanceFuturesClient
from futures_agent.indicators import (
    calculate_rsi, calculate_volume_spike, calculate_support_resistance,
    calculate_entry_zones, calculate_donchian_channels, calculate_cmf,
    calculate_ema, calculate_atr, calculate_vwap, calculate_choppiness_index,
    calculate_adx_dmi, calculate_supertrend, calculate_stochastic_rsi,
    calculate_bollinger_bands, calculate_keltner_channel, calculate_cvd,
    calculate_obv, calculate_pivot_points, calculate_ichimoku
)
from futures_agent.models import ScanResult
from futures_agent.ollama_advisor import OllamaAdvisor
from futures_agent.data_loader import load_historical_klines_from_json
from futures_agent.config import (
    DEFAULT_SYMBOLS, DEFAULT_RSI_PERIOD, DEFAULT_RSI_OVERSOLD,
    DEFAULT_RSI_OVERBOUGHT, DEFAULT_VOLUME_RATIO, DEFAULT_TIMEFRAME
)

STRATEGY_MIN_CANDLES = {
    "rsi_volume": 20, "donchian_cmf": 25, "vwap_reversion": 20,
    "donchian_breakout": 25, "supertrend_pullback": 30,
    "squeeze_breakout": 25, "orderflow_divergence": 30,
    "funding_sentiment": 25, "ichimoku_cloud": 60, "pivot_points": 10,
    "candle_range_theory": 50,
}


class MarketScanner:
    def __init__(self, client: Optional[BinanceFuturesClient] = None, advisor: Optional[OllamaAdvisor] = None):
        self.client = client or BinanceFuturesClient()
        self.advisor = advisor or OllamaAdvisor()
        self.last_errors: List[Dict[str, str]] = []

    def scan_symbol(
        self,
        symbol: str,
        timeframe: str = DEFAULT_TIMEFRAME,
        rsi_period: int = DEFAULT_RSI_PERIOD,
        rsi_oversold: float = DEFAULT_RSI_OVERSOLD,
        rsi_overbought: float = DEFAULT_RSI_OVERBOUGHT,
        volume_threshold_ratio: float = DEFAULT_VOLUME_RATIO,
        with_ollama: bool = False,
        ollama_model: str = "",
        use_local_json: bool = False,
        data_dir: str = "/home/pablo/datadown/data/monthly",
        periods: Optional[List[str]] = None,
        start_period: Optional[str] = None,
        end_period: Optional[str] = None,
        strategy: str = "rsi_volume",
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
        donchian_period: int = 20,
        cmf_period: int = 20,
        cmf_threshold: float = 0.05,
        vwap_deviation_pct: float = 0.3,
        chop_threshold: float = 61.0,
        crt_lookback: int = 50,
        crt_range_lookback: int = 5,
        crt_min_range_pct: float = 0.2,
        crt_sweep_confirmation_bars: int = 3,
    ) -> Optional[ScanResult]:
        try:
            min_candles = STRATEGY_MIN_CANDLES.get(strategy, 30)

            klines = []
            try:
                klines = self.client.get_klines(symbol, interval=timeframe, limit=150)
            except Exception:
                pass

            if len(klines) < min_candles and use_local_json:
                klines = load_historical_klines_from_json(
                    symbol=symbol, timeframe=timeframe, data_dir=data_dir,
                    periods=periods, start_period=start_period, end_period=end_period
                )

            if len(klines) < min_candles:
                return None

            close_prices = [k.close for k in klines]
            volumes = [k.volume for k in klines]

            current_price = close_prices[-1]
            price_source = "kline"
            try:
                current_price = self.client.get_current_price(symbol)
                price_source = "live"
            except Exception:
                current_price = close_prices[-1]
                price_source = "kline_stale"

            rsi_series = calculate_rsi(close_prices, period=rsi_period)
            current_rsi = round(rsi_series[-1], 2)
            is_spike, cur_vol, avg_vol, ratio_pct = calculate_volume_spike(
                volumes, period=20, threshold_ratio=volume_threshold_ratio
            )
            is_oversold = current_rsi <= rsi_oversold
            is_overbought = current_rsi >= rsi_overbought
            supports, resistances = calculate_support_resistance(klines, lookback=50, num_levels=3)
            entry_zone = calculate_entry_zones(current_price, current_rsi, supports, resistances)

            signal = self._compute_signal(
                strategy, klines, close_prices, volumes, current_price, current_rsi,
                rsi_series, is_oversold, is_overbought, is_spike, rsi_period,
                rsi_oversold, rsi_overbought, volume_threshold_ratio, symbol,
                supertrend_period=supertrend_period, supertrend_multiplier=supertrend_multiplier,
                stoch_rsi_period=stoch_rsi_period, bb_period=bb_period, bb_std_dev=bb_std_dev,
                kc_atr_period=kc_atr_period, kc_atr_mult=kc_atr_mult,
                orderflow_lookback=orderflow_lookback, funding_threshold=funding_threshold,
                ichimoku_tenkan=ichimoku_tenkan, ichimoku_kijun=ichimoku_kijun,
                ichimoku_senkou_b=ichimoku_senkou_b, pivot_vol_period=pivot_vol_period,
                donchian_period=donchian_period, cmf_period=cmf_period,
                cmf_threshold=cmf_threshold, vwap_deviation_pct=vwap_deviation_pct,
                chop_threshold=chop_threshold, crt_lookback=crt_lookback,
                crt_range_lookback=crt_range_lookback, crt_min_range_pct=crt_min_range_pct,
                crt_sweep_confirmation_bars=crt_sweep_confirmation_bars,
            )

            don_up, don_low, _ = calculate_donchian_channels(klines, period=donchian_period)
            cmf_vals = calculate_cmf(klines, period=cmf_period)
            cur_don_up = don_up[-1] if don_up else current_price
            cur_don_low = don_low[-1] if don_low else current_price
            cur_cmf = cmf_vals[-1] if cmf_vals else 0.0

            scan_res = ScanResult(
                symbol=symbol.upper(), price=current_price, rsi=current_rsi,
                volume_current=round(cur_vol, 2), volume_avg=round(avg_vol, 2),
                volume_ratio_pct=ratio_pct, is_volume_spike=is_spike,
                is_rsi_oversold=is_oversold, is_rsi_overbought=is_overbought,
                support_levels=supports, resistance_levels=resistances,
                entry_zone=entry_zone, signal=signal,
                timestamp=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                price_source=price_source, strategy_name=strategy,
                donchian_upper=cur_don_up, donchian_lower=cur_don_low, cmf=cur_cmf
            )

            if with_ollama:
                rec = self.advisor.analyze(scan_res.to_dict(), model_override=ollama_model)
                scan_res.recommendation = rec

            return scan_res
        except Exception as e:
            self.last_errors.append({"symbol": symbol, "error": str(e)})
            return None

    def _compute_signal(self, strategy, klines, close_prices, volumes, current_price,
                         current_rsi, rsi_series, is_oversold, is_overbought, is_spike,
                         rsi_period, rsi_oversold, rsi_overbought, vol_ratio, symbol,
                         supertrend_period=10, supertrend_multiplier=3.0, stoch_rsi_period=14,
                         bb_period=20, bb_std_dev=2.0, kc_atr_period=10, kc_atr_mult=2.0,
                         orderflow_lookback=20, funding_threshold=0.0005,
                         ichimoku_tenkan=9, ichimoku_kijun=26, ichimoku_senkou_b=52,
                         pivot_vol_period=20, donchian_period=20, cmf_period=20,
                         cmf_threshold=0.05, vwap_deviation_pct=0.3, chop_threshold=61.0,
                         crt_lookback=50, crt_range_lookback=5, crt_min_range_pct=0.2,
                         crt_sweep_confirmation_bars=3) -> str:
        if strategy == "rsi_volume":
            return self._signal_rsi_volume(is_oversold, is_overbought)
        elif strategy == "donchian_cmf":
            return self._signal_donchian_cmf(klines, current_price, donchian_period, cmf_period, cmf_threshold)
        elif strategy == "vwap_reversion":
            return self._signal_vwap_reversion(klines, close_prices, rsi_period, rsi_oversold, rsi_overbought, vwap_deviation_pct, chop_threshold)
        elif strategy == "donchian_breakout":
            return self._signal_donchian_breakout(klines, current_price, donchian_period)
        elif strategy == "supertrend_pullback":
            return self._signal_supertrend_pullback(close_prices, supertrend_period, supertrend_multiplier, stoch_rsi_period)
        elif strategy == "squeeze_breakout":
            return self._signal_squeeze_breakout(klines, bb_period, bb_std_dev, kc_atr_period, kc_atr_mult)
        elif strategy == "orderflow_divergence":
            return self._signal_orderflow_divergence(klines, close_prices, orderflow_lookback)
        elif strategy == "funding_sentiment":
            return self._signal_funding_sentiment(symbol, close_prices, funding_threshold)
        elif strategy == "ichimoku_cloud":
            return self._signal_ichimoku_cloud(klines, current_price, ichimoku_tenkan, ichimoku_kijun, ichimoku_senkou_b)
        elif strategy == "pivot_points":
            return self._signal_pivot_points(klines, current_price, volumes, pivot_vol_period)
        elif strategy == "candle_range_theory":
            return self._signal_candle_range_theory(klines, crt_lookback, crt_range_lookback, crt_min_range_pct, crt_sweep_confirmation_bars)
        return "NEUTRAL"

    def _signal_rsi_volume(self, is_oversold, is_overbought) -> str:
        if is_oversold:
            return "LONG_ALERT"
        elif is_overbought:
            return "SHORT_ALERT"
        return "NEUTRAL"

    def _signal_donchian_cmf(self, klines, current_price, donchian_period=20, cmf_period=20, cmf_threshold=0.05) -> str:
        don_up, don_low, _ = calculate_donchian_channels(klines, period=donchian_period)
        cmf_vals = calculate_cmf(klines, period=cmf_period)
        cur_don_up = don_up[-1] if don_up else current_price
        cur_don_low = don_low[-1] if don_low else current_price
        cur_cmf = cmf_vals[-1] if cmf_vals else 0.0
        if current_price > cur_don_up and cur_cmf > cmf_threshold:
            return "LONG_ALERT"
        elif current_price < cur_don_low and cur_cmf < -cmf_threshold:
            return "SHORT_ALERT"
        return "NEUTRAL"

    def _signal_vwap_reversion(self, klines, close_prices, rsi_period, rsi_oversold, rsi_overbought, vwap_deviation_pct=0.3, chop_threshold=61.0) -> str:
        vwap_vals = calculate_vwap(klines)
        rsi_vals = calculate_rsi(close_prices, period=rsi_period)
        chop_vals = calculate_choppiness_index(klines, period=14)
        cur_vwap = vwap_vals[-1] if vwap_vals else close_prices[-1]
        cur_rsi = rsi_vals[-1] if rsi_vals else 50.0
        cur_chop = chop_vals[-1] if chop_vals else 50.0
        pct_below_vwap = (close_prices[-1] - cur_vwap) / cur_vwap * 100.0 if cur_vwap > 0 else 0
        if pct_below_vwap <= -vwap_deviation_pct and cur_rsi < rsi_oversold and cur_chop > chop_threshold:
            return "LONG_ALERT"
        elif pct_below_vwap >= vwap_deviation_pct and cur_rsi > rsi_overbought and cur_chop > chop_threshold:
            return "SHORT_ALERT"
        return "NEUTRAL"

    def _signal_donchian_breakout(self, klines, current_price, donchian_period=20) -> str:
        don_up, don_low, _ = calculate_donchian_channels(klines, period=donchian_period)
        adx, plus_di, minus_di = calculate_adx_dmi(klines, period=14)
        cur_don_up = don_up[-1] if don_up else current_price
        cur_don_low = don_low[-1] if don_low else current_price
        cur_adx = adx[-1] if adx else 0.0
        cur_plus = plus_di[-1] if plus_di else 25.0
        cur_minus = minus_di[-1] if minus_di else 25.0
        if current_price > cur_don_up and cur_adx > 20 and cur_plus > cur_minus:
            return "LONG_ALERT"
        elif current_price < cur_don_low and cur_adx > 20 and cur_minus > cur_plus:
            return "SHORT_ALERT"
        return "NEUTRAL"

    def _signal_supertrend_pullback(self, close_prices, supertrend_period=10, supertrend_multiplier=3.0, stoch_rsi_period=14) -> str:
        from futures_agent.models import Candle
        candles_mock = [Candle(timestamp=i, open=c, high=c, low=c, close=c, volume=0) for i, c in enumerate(close_prices)]
        st_line, st_dir = calculate_supertrend(candles_mock, period=supertrend_period, multiplier=supertrend_multiplier)
        stoch_k, stoch_d = calculate_stochastic_rsi(close_prices, rsi_period=stoch_rsi_period, stoch_period=stoch_rsi_period)
        cur_dir = st_dir[-1] if st_dir else "NEUTRAL"
        cur_k = stoch_k[-1] if stoch_k else 50.0
        prev_k = stoch_k[-2] if len(stoch_k) > 1 else 50.0
        if cur_dir == "BULL" and prev_k < 20 and cur_k >= 20:
            return "LONG_ALERT"
        elif cur_dir == "BEAR" and prev_k > 80 and cur_k <= 80:
            return "SHORT_ALERT"
        return "NEUTRAL"

    def _signal_squeeze_breakout(self, klines, bb_period=20, bb_std_dev=2.0, kc_atr_period=10, kc_atr_mult=2.0) -> str:
        closes = [k.close for k in klines]
        bb_upper, bb_mid, bb_lower = calculate_bollinger_bands(closes, period=bb_period, std_dev=bb_std_dev)
        kc_upper, kc_mid, kc_lower = calculate_keltner_channel(klines, period=bb_period, atr_period=kc_atr_period, atr_mult=kc_atr_mult)
        n = len(klines)
        if n < 3:
            return "NEUTRAL"
        prev_squeeze = bb_lower[-2] > kc_lower[-2] and bb_upper[-2] < kc_upper[-2] if n >= 2 else False
        cur_squeeze = bb_lower[-1] > kc_lower[-1] and bb_upper[-1] < kc_upper[-1]
        if prev_squeeze and not cur_squeeze and closes[-1] > bb_upper[-1]:
            return "LONG_ALERT"
        elif prev_squeeze and not cur_squeeze and closes[-1] < bb_lower[-1]:
            return "SHORT_ALERT"
        return "NEUTRAL"

    def _signal_orderflow_divergence(self, klines, close_prices, lookback_bars=20) -> str:
        cvd = calculate_cvd(klines)
        obv = calculate_obv(klines)
        n = len(close_prices)
        lookback = min(lookback_bars, n - 1)
        if n < lookback + 2:
            return "NEUTRAL"
        price_min_idx = n - 1 - lookback + min(range(lookback + 1), key=lambda j: close_prices[n - 1 - lookback + j])
        cvd_at_price_min = cvd[price_min_idx] if price_min_idx < len(cvd) else 0
        obv_at_price_min = obv[price_min_idx] if price_min_idx < len(obv) else 0
        if close_prices[-1] <= close_prices[price_min_idx] and cvd[-1] > cvd_at_price_min and obv[-1] > obv_at_price_min:
            return "LONG_ALERT"
        price_max_idx = n - 1 - lookback + max(range(lookback + 1), key=lambda j: close_prices[n - 1 - lookback + j])
        cvd_at_price_max = cvd[price_max_idx] if price_max_idx < len(cvd) else 0
        obv_at_price_max = obv[price_max_idx] if price_max_idx < len(obv) else 0
        if close_prices[-1] >= close_prices[price_max_idx] and cvd[-1] < cvd_at_price_max and obv[-1] < obv_at_price_max:
            return "SHORT_ALERT"
        return "NEUTRAL"

    def _signal_funding_sentiment(self, symbol, close_prices, funding_threshold=0.0005) -> str:
        try:
            funding_data = self.client.get_funding_rate(symbol, limit=1)
            funding_rate = float(funding_data[0]["fundingRate"]) if funding_data else 0.0
        except Exception:
            funding_rate = 0.0
        cvd = calculate_cvd([__import__('futures_agent.models', fromlist=['Candle']).Candle(
            timestamp=i, open=c, high=c, low=c, close=c, volume=1000
        ) for i, c in enumerate(close_prices[-20:])])
        cur_cvd = cvd[-1] if cvd else 0
        prev_cvd = cvd[-2] if len(cvd) > 1 else 0
        if funding_rate < -funding_threshold and cur_cvd > prev_cvd:
            return "LONG_ALERT"
        elif funding_rate > funding_threshold and cur_cvd < prev_cvd:
            return "SHORT_ALERT"
        return "NEUTRAL"

    def _signal_ichimoku_cloud(self, klines, current_price, tenkan=9, kijun=26, senkou_b=52) -> str:
        ich = calculate_ichimoku(klines, tenkan_period=tenkan, kijun_period=kijun, senkou_b_period=senkou_b)
        n = len(klines)
        if n < kijun:
            return "NEUTRAL"
        cur_tenkan = ich["tenkan"][-1]
        cur_kijun = ich["kijun"][-1]
        prev_tenkan = ich["tenkan"][-2] if n >= 2 else 0
        prev_kijun = ich["kijun"][-2] if n >= 2 else 0
        senkou_a = ich["senkou_a"][-1]
        senkou_b = ich["senkou_b"][-1]
        cloud_top = max(senkou_a, senkou_b)
        cloud_bottom = min(senkou_a, senkou_b)
        tk_cross_up = prev_tenkan <= prev_kijun and cur_tenkan > cur_kijun
        tk_cross_down = prev_tenkan >= prev_kijun and cur_tenkan < cur_kijun
        future_cloud_bull = senkou_a > senkou_b
        if current_price > cloud_top and tk_cross_up and future_cloud_bull:
            return "LONG_ALERT"
        elif current_price < cloud_bottom and tk_cross_down and not future_cloud_bull:
            return "SHORT_ALERT"
        return "NEUTRAL"

    def _signal_pivot_points(self, klines, current_price, volumes, vol_sma_period=20) -> str:
        pivots = calculate_pivot_points(klines)
        avg_vol = sum(volumes[-vol_sma_period:]) / vol_sma_period if len(volumes) >= vol_sma_period else 1
        cur_vol = volumes[-1] if volumes else 0
        above_avg = cur_vol > avg_vol
        r1, s1 = pivots["R1"], pivots["S1"]
        if r1 > 0 and current_price > r1 and above_avg:
            return "LONG_ALERT"
        elif s1 > 0 and current_price < s1 and above_avg:
            return "SHORT_ALERT"
        return "NEUTRAL"

    def _signal_candle_range_theory(self, klines, lookback=50, range_lookback=5, min_range_pct=0.2, confirmation_bars=3) -> str:
        n = len(klines)
        if n < lookback + range_lookback + confirmation_bars + 5:
            return "NEUTRAL"

        closes = [k.close for k in klines]
        highs = [k.high for k in klines]
        lows = [k.low for k in klines]

        supports, resistances = calculate_support_resistance(klines, lookback=lookback, num_levels=3)

        for i in range(n - lookback - range_lookback - confirmation_bars - 1, n - lookback - 5):
            range_start = i
            range_end = i + range_lookback
            if range_end >= n:
                continue

            range_highs = highs[range_start:range_end + 1]
            range_lows = lows[range_start:range_end + 1]

            range_high = max(range_highs)
            range_low = min(range_lows)
            range_pct = (range_high - range_low) / range_low * 100 if range_low > 0 else 0

            if range_pct < min_range_pct:
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
            for j in range(range_end + 1, min(n, range_end + confirmation_bars + 5)):
                if highs[j] > range_high:
                    breakout_high = True
                if lows[j] < range_low:
                    breakout_low = True

            if not breakout_high and not breakout_low:
                continue

            if breakout_high:
                sweep_start = range_end
                sweep_end = min(n, sweep_start + confirmation_bars)
                sweep_reverted = False
                for j in range(sweep_start, sweep_end):
                    if lows[j] <= range_low:
                        sweep_reverted = True
                        break

                if sweep_reverted:
                    return "SHORT_ALERT"

            if breakout_low:
                sweep_start = range_end
                sweep_end = min(n, sweep_start + confirmation_bars)
                sweep_reverted = False
                for j in range(sweep_start, sweep_end):
                    if highs[j] >= range_high:
                        sweep_reverted = True
                        break

                if sweep_reverted:
                    return "LONG_ALERT"

        return "NEUTRAL"

    def scan_markets(
        self,
        symbols: Optional[List[str]] = None,
        timeframe: str = DEFAULT_TIMEFRAME,
        rsi_period: int = DEFAULT_RSI_PERIOD,
        rsi_oversold: float = DEFAULT_RSI_OVERSOLD,
        rsi_overbought: float = DEFAULT_RSI_OVERBOUGHT,
        volume_threshold_ratio: float = DEFAULT_VOLUME_RATIO,
        only_filtered: bool = True,
        with_ollama: bool = False,
        ollama_model: str = "",
        use_local_json: bool = False,
        data_dir: str = "/home/pablo/datadown/data/monthly",
        periods: Optional[List[str]] = None,
        start_period: Optional[str] = None,
        end_period: Optional[str] = None,
        strategy: str = "rsi_volume",
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
        donchian_period: int = 20,
        cmf_period: int = 20,
        cmf_threshold: float = 0.05,
        vwap_deviation_pct: float = 0.3,
        chop_threshold: float = 61.0,
        crt_lookback: int = 50,
        crt_range_lookback: int = 5,
        crt_min_range_pct: float = 0.2,
        crt_sweep_confirmation_bars: int = 3,
    ) -> Dict[str, Any]:
        symbols_to_scan = symbols or DEFAULT_SYMBOLS
        self.last_errors = []
        results = []

        for sym in symbols_to_scan:
            res = self.scan_symbol(
                symbol=sym, timeframe=timeframe, rsi_period=rsi_period,
                rsi_oversold=rsi_oversold, rsi_overbought=rsi_overbought,
                volume_threshold_ratio=volume_threshold_ratio, with_ollama=with_ollama,
                ollama_model=ollama_model, use_local_json=use_local_json,
                data_dir=data_dir, periods=periods, start_period=start_period,
                end_period=end_period, strategy=strategy,
                supertrend_period=supertrend_period, supertrend_multiplier=supertrend_multiplier,
                stoch_rsi_period=stoch_rsi_period, bb_period=bb_period, bb_std_dev=bb_std_dev,
                kc_atr_period=kc_atr_period, kc_atr_mult=kc_atr_mult,
                orderflow_lookback=orderflow_lookback, funding_threshold=funding_threshold,
                ichimoku_tenkan=ichimoku_tenkan, ichimoku_kijun=ichimoku_kijun,
                ichimoku_senkou_b=ichimoku_senkou_b, pivot_vol_period=pivot_vol_period,
                donchian_period=donchian_period, cmf_period=cmf_period,
                cmf_threshold=cmf_threshold, vwap_deviation_pct=vwap_deviation_pct,
                chop_threshold=chop_threshold, crt_lookback=crt_lookback,
                crt_range_lookback=crt_range_lookback, crt_min_range_pct=crt_min_range_pct,
                crt_sweep_confirmation_bars=crt_sweep_confirmation_bars,
            )
            if res:
                if only_filtered:
                    if res.is_rsi_oversold or res.is_rsi_overbought or res.is_volume_spike or res.signal != "NEUTRAL":
                        results.append(res)
                else:
                    results.append(res)

        return {
            "results": results,
            "errors": self.last_errors,
            "total_scanned": len(symbols_to_scan),
            "total_ok": len(results),
            "total_failed": len(self.last_errors)
        }
