import math
from typing import List, Dict, Any, Tuple, Optional
from futures_agent.models import Candle

def calculate_rsi(prices: List[float], period: int = 14) -> List[float]:
    """Calcula o RSI (Relative Strength Index) com suavização de Wilder"""
    if len(prices) < period + 1:
        return [50.0] * len(prices)

    rsi_values = [50.0] * len(prices)
    gains = []
    losses = []

    for i in range(1, len(prices)):
        change = prices[i] - prices[i - 1]
        if change > 0:
            gains.append(change)
            losses.append(0.0)
        else:
            gains.append(0.0)
            losses.append(abs(change))

    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period

    if avg_loss == 0:
        rsi_values[period] = 100.0
    else:
        rs = avg_gain / avg_loss
        rsi_values[period] = 100.0 - (100.0 / (1.0 + rs))

    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period

        if avg_loss == 0:
            rsi_values[i + 1] = 100.0
        else:
            rs = avg_gain / avg_loss
            rsi_values[i + 1] = 100.0 - (100.0 / (1.0 + rs))

    return rsi_values

def calculate_volume_spike(volumes: List[float], period: int = 20, threshold_ratio: float = 2.0) -> Tuple[bool, float, float, float]:
    """
    Verifica se o último volume é um pico de volume em relação à média móvel de `period` candles.
    Retorna: (is_spike, current_volume, avg_volume, ratio_pct)
    """
    if len(volumes) < period:
        return False, volumes[-1] if volumes else 0.0, 0.0, 0.0

    current_volume = volumes[-1]
    hist_volumes = volumes[-period - 1:-1]
    avg_volume = sum(hist_volumes) / len(hist_volumes) if hist_volumes else 1.0

    if avg_volume == 0:
        ratio_pct = 100.0
    else:
        ratio_pct = (current_volume / avg_volume) * 100.0

    is_spike = current_volume >= (avg_volume * threshold_ratio)
    return is_spike, current_volume, avg_volume, round(ratio_pct, 2)

def calculate_donchian_channels(candles: List[Candle], period: int = 20) -> Tuple[List[float], List[float], List[float]]:
    """
    Calcula o Canal de Donchian (Banda Superior, Banda Inferior, Linha Central).
    Para o candle i, calcula a máxima/mínima dos 'period' candles anteriores (i-period até i-1).
    """
    n = len(candles)
    if n == 0:
        return [], [], []

    upper_bands = []
    lower_bands = []
    middle_bands = []

    for i in range(n):
        if i < period:
            window = candles[:max(1, i)]
        else:
            window = candles[i - period:i]

        max_h = max(c.high for c in window)
        min_l = min(c.low for c in window)
        mid = (max_h + min_l) / 2.0

        upper_bands.append(round(max_h, 4))
        lower_bands.append(round(min_l, 4))
        middle_bands.append(round(mid, 4))

    return upper_bands, lower_bands, middle_bands

def calculate_cmf(candles: List[Candle], period: int = 20) -> List[float]:
    """
    Calcula o Chaikin Money Flow (CMF) para um período de N candles.
    Retorna uma lista de valores CMF flutuantes entre -1.0 e +1.0.
    """
    n = len(candles)
    if n == 0:
        return []

    mf_vols = []
    vols = []

    for c in candles:
        vols.append(c.volume)
        hl_diff = c.high - c.low
        if hl_diff == 0:
            mf_mult = 0.0
        else:
            mf_mult = ((c.close - c.low) - (c.high - c.close)) / hl_diff
        mf_vols.append(mf_mult * c.volume)

    cmf_values = []
    for i in range(n):
        if i < period - 1:
            cmf_values.append(0.0)
        else:
            sum_mf_vol = sum(mf_vols[i - period + 1 : i + 1])
            sum_vol = sum(vols[i - period + 1 : i + 1])
            if sum_vol == 0:
                cmf_values.append(0.0)
            else:
                cmf_values.append(round(sum_mf_vol / sum_vol, 4))

    return cmf_values

def calculate_ema(prices: List[float], period: int = 200) -> List[float]:
    """Calcula a Média Móvel Exponencial (EMA)"""
    n = len(prices)
    if n == 0:
        return []
    if n < period:
        avg = sum(prices) / n
        return [round(avg, 4)] * n

    ema_values = [0.0] * n
    first_sma = sum(prices[:period]) / period
    for i in range(period):
        ema_values[i] = round(first_sma, 4)

    multiplier = 2.0 / (period + 1.0)
    prev_ema = first_sma

    for i in range(period, n):
        current_ema = (prices[i] - prev_ema) * multiplier + prev_ema
        ema_values[i] = round(current_ema, 4)
        prev_ema = current_ema

    return ema_values

def calculate_atr(candles: List[Candle], period: int = 14) -> List[float]:
    """Calcula o ATR (Average True Range)"""
    n = len(candles)
    if n == 0:
        return []

    tr_list = []
    for i in range(n):
        if i == 0:
            tr_list.append(candles[i].high - candles[i].low)
        else:
            c = candles[i]
            prev_close = candles[i - 1].close
            tr = max(c.high - c.low, abs(c.high - prev_close), abs(c.low - prev_close))
            tr_list.append(tr)

    atr_values = [0.0] * n
    if n < period:
        avg_tr = sum(tr_list) / n
        return [round(avg_tr, 4)] * n

    first_atr = sum(tr_list[:period]) / period
    for i in range(period):
        atr_values[i] = round(first_atr, 4)

    prev_atr = first_atr
    for i in range(period, n):
        cur_atr = (prev_atr * (period - 1) + tr_list[i]) / period
        atr_values[i] = round(cur_atr, 4)
        prev_atr = cur_atr

    return atr_values

def calculate_support_resistance(candles: List[Candle], lookback: int = 50, num_levels: int = 3) -> Tuple[List[float], List[float]]:
    """
    Calcula níveis de suporte e resistência buscando pivots locais nos candles recentes.
    """
    if not candles:
        return [0.0], [0.0]

    recent_candles = candles[-lookback:]
    current_price = candles[-1].close

    supports = []
    resistances = []

    # Detectar pivots locais (mínimas e máximas relativas)
    for i in range(2, len(recent_candles) - 2):
        c = recent_candles[i]
        # Pivô de mínima (Suporte)
        if c.low < recent_candles[i - 1].low and c.low < recent_candles[i - 2].low and c.low < recent_candles[i + 1].low and c.low < recent_candles[i + 2].low:
            supports.append(round(c.low, 4))
        # Pivô de máxima (Resistência)
        if c.high > recent_candles[i - 1].high and c.high > recent_candles[i - 2].high and c.high > recent_candles[i + 1].high and c.high > recent_candles[i + 2].high:
            resistances.append(round(c.high, 4))

    # Adicionar mínima e máxima absoluta do período como falback
    all_lows = [c.low for c in recent_candles]
    all_highs = [c.high for c in recent_candles]

    if not supports:
        supports.append(round(min(all_lows), 4))
    if not resistances:
        resistances.append(round(max(all_highs), 4))

    # Filtrar suportes que estão abaixo do preço atual e ordená-los
    valid_supports = sorted(list(set([s for s in supports if s <= current_price])), reverse=True)
    if not valid_supports:
        valid_supports = [round(min(all_lows), 4)]

    # Filtrar resistências que estão acima do preço atual e ordená-las
    valid_resistances = sorted(list(set([r for r in resistances if r >= current_price])))
    if not valid_resistances:
        valid_resistances = [round(max(all_highs), 4)]

    return valid_supports[:num_levels], valid_resistances[:num_levels]

def calculate_entry_zones(current_price: float, rsi: float, supports: List[float], resistances: List[float]) -> Dict[str, Any]:
    """
    Calcula a zona de entrada estimada baseada no preço atual, suporte próximo e resistência próxima.
    """
    nearest_support = supports[0] if supports else current_price * 0.98
    nearest_resistance = resistances[0] if resistances else current_price * 1.02

    if rsi < 35:
        # Tendência / Alerta de Compra (LONG)
        entry_low = round(min(nearest_support, current_price * 0.995), 4)
        entry_high = round(current_price, 4)
        zone_type = "LONG"
    elif rsi > 65:
        # Tendência / Alerta de Venda (SHORT)
        entry_low = round(current_price, 4)
        entry_high = round(max(nearest_resistance, current_price * 1.005), 4)
        zone_type = "SHORT"
    else:
        entry_low = round(nearest_support, 4)
        entry_high = round(nearest_resistance, 4)
        zone_type = "NEUTRAL"

    return {
        "low": entry_low,
        "high": entry_high,
        "type": zone_type,
        "nearest_support": nearest_support,
        "nearest_resistance": nearest_resistance
    }


# =====================================================================
# NOVOS INDICADORES — Estratégias de Day Trade
# =====================================================================

def calculate_vwap(candles: List[Candle]) -> List[float]:
    """Volume Weighted Average Price (VWAP) cumulativo."""
    if not candles:
        return []
    vwap_values = []
    cum_vol = 0.0
    cum_tp_vol = 0.0
    for c in candles:
        tp = (c.high + c.low + c.close) / 3.0
        cum_vol += c.volume
        cum_tp_vol += tp * c.volume
        vwap_values.append(round(cum_tp_vol / cum_vol, 4) if cum_vol > 0 else c.close)
    return vwap_values


def calculate_choppiness_index(candles: List[Candle], period: int = 14) -> List[float]:
    """Choppiness Index: 100 * log10(ATR_sum / (max_high - min_low)) / log10(period)"""
    n = len(candles)
    if n < period:
        return [50.0] * n
    atr_list = calculate_atr(candles, period)
    ci_values = [50.0] * n
    for i in range(period - 1, n):
        atr_sum = sum(atr_list[i - period + 1: i + 1])
        window_high = max(c.high for c in candles[i - period + 1: i + 1])
        window_low = min(c.low for c in candles[i - period + 1: i + 1])
        range_hl = window_high - window_low
        if range_hl == 0 or atr_sum == 0:
            ci_values[i] = 50.0
        else:
            ci_values[i] = round(100.0 * math.log10(atr_sum / range_hl) / math.log10(period), 2)
    return ci_values


def calculate_adx_dmi(candles: List[Candle], period: int = 14) -> Tuple[List[float], List[float], List[float]]:
    """ADX, +DI, -DI com suavização Wilder. Retorna (adx, plus_di, minus_di)."""
    n = len(candles)
    if n < period + 1:
        return [0.0] * n, [25.0] * n, [25.0] * n

    tr_list, plus_dm, minus_dm = [], [], []
    for i in range(n):
        c = candles[i]
        if i == 0:
            tr_list.append(c.high - c.low)
            plus_dm.append(0.0)
            minus_dm.append(0.0)
        else:
            prev = candles[i - 1]
            tr_list.append(max(c.high - c.low, abs(c.high - prev.close), abs(c.low - prev.close)))
            up = c.high - prev.high
            down = prev.low - c.low
            plus_dm.append(up if up > down and up > 0 else 0.0)
            minus_dm.append(down if down > up and down > 0 else 0.0)

    def wilder_smooth(data: List[float], per: int) -> List[float]:
        result = [0.0] * len(data)
        result[per - 1] = sum(data[:per])
        for i in range(per, len(data)):
            result[i] = result[i - 1] - result[i - 1] / per + data[i]
        return result

    sm_tr = wilder_smooth(tr_list, period)
    sm_plus = wilder_smooth(plus_dm, period)
    sm_minus = wilder_smooth(minus_dm, period)

    plus_di = [0.0] * n
    minus_di = [0.0] * n
    dx = [0.0] * n
    for i in range(period - 1, n):
        if sm_tr[i] == 0:
            plus_di[i] = 0.0
            minus_di[i] = 0.0
        else:
            plus_di[i] = round(100.0 * sm_plus[i] / sm_tr[i], 2)
            minus_di[i] = round(100.0 * sm_minus[i] / sm_tr[i], 2)
        di_sum = plus_di[i] + minus_di[i]
        dx[i] = round(100.0 * abs(plus_di[i] - minus_di[i]) / di_sum, 2) if di_sum > 0 else 0.0

    adx = [0.0] * n
    first_adx = sum(dx[period - 1: 2 * period - 1]) / period
    for i in range(period - 1, 2 * period - 2):
        adx[i] = round(first_adx, 2) if i < n else 0.0
    if 2 * period - 2 < n:
        adx[2 * period - 2] = round(first_adx, 2)
    prev_adx = first_adx
    for i in range(2 * period - 2, n):
        adx[i] = round((prev_adx * (period - 1) + dx[i]) / period, 2)
        prev_adx = adx[i]

    return adx, plus_di, minus_di


def calculate_supertrend(candles: List[Candle], period: int = 10, multiplier: float = 3.0) -> Tuple[List[float], List[str]]:
    """SuperTrend. Retorna (supertrend_line, direction) onde direction é 'BULL' ou 'BEAR'."""
    n = len(candles)
    atr = calculate_atr(candles, period)
    hl2 = [(c.high + c.low) / 2.0 for c in candles]

    upper_band = [0.0] * n
    lower_band = [0.0] * n
    supertrend = [0.0] * n
    direction = ["NEUTRAL"] * n

    for i in range(n):
        upper_band[i] = hl2[i] + multiplier * atr[i]
        lower_band[i] = hl2[i] - multiplier * atr[i]

    for i in range(n):
        if i == 0:
            supertrend[i] = upper_band[i]
            direction[i] = "BEAR"
            continue

        if lower_band[i] > lower_band[i - 1] or candles[i - 1].close < lower_band[i - 1]:
            lower_band[i] = lower_band[i]
        else:
            lower_band[i] = lower_band[i - 1]

        if upper_band[i] < upper_band[i - 1] or candles[i - 1].close > upper_band[i - 1]:
            upper_band[i] = upper_band[i]
        else:
            upper_band[i] = upper_band[i - 1]

        if direction[i - 1] == "BULL":
            if candles[i].close < lower_band[i]:
                direction[i] = "BEAR"
                supertrend[i] = upper_band[i]
            else:
                direction[i] = "BULL"
                supertrend[i] = lower_band[i]
        else:
            if candles[i].close > upper_band[i]:
                direction[i] = "BULL"
                supertrend[i] = lower_band[i]
            else:
                direction[i] = "BEAR"
                supertrend[i] = upper_band[i]

    return supertrend, direction


def calculate_stochastic_rsi(prices: List[float], rsi_period: int = 14, stoch_period: int = 14,
                              k_smooth: int = 3, d_smooth: int = 3) -> Tuple[List[float], List[float]]:
    """Stochastic RSI: aplica fórmula estocástica ao RSI. Retorna (%K, %D)."""
    rsi = calculate_rsi(prices, rsi_period)
    n = len(rsi)
    raw_k = [50.0] * n

    for i in range(stoch_period - 1, n):
        window = rsi[i - stoch_period + 1: i + 1]
        rsi_min = min(window)
        rsi_max = max(window)
        if rsi_max - rsi_min == 0:
            raw_k[i] = 50.0
        else:
            raw_k[i] = ((rsi[i] - rsi_min) / (rsi_max - rsi_min)) * 100.0

    k_smoothed = _sma(raw_k, k_smooth)
    d_smoothed = _sma(k_smoothed, d_smooth)
    return k_smoothed, d_smoothed


def _sma(values: List[float], period: int) -> List[float]:
    """Simple Moving Average auxiliar."""
    n = len(values)
    if n == 0:
        return []
    result = [0.0] * n
    for i in range(n):
        start = max(0, i - period + 1)
        window = values[start: i + 1]
        result[i] = round(sum(window) / len(window), 4)
    return result


def calculate_bollinger_bands(prices: List[float], period: int = 20, std_dev: float = 2.0) -> Tuple[List[float], List[float], List[float]]:
    """Bollinger Bands: (upper, middle/SMA, lower)."""
    n = len(prices)
    upper, middle, lower = [0.0] * n, [0.0] * n, [0.0] * n
    for i in range(period - 1, n):
        window = prices[i - period + 1: i + 1]
        sma = sum(window) / period
        variance = sum((x - sma) ** 2 for x in window) / period
        std = math.sqrt(variance)
        middle[i] = round(sma, 4)
        upper[i] = round(sma + std_dev * std, 4)
        lower[i] = round(sma - std_dev * std, 4)
    return upper, middle, lower


def calculate_keltner_channel(candles: List[Candle], period: int = 20, atr_period: int = 10, atr_mult: float = 2.0) -> Tuple[List[float], List[float], List[float]]:
    """Keltner Channel: (upper, EMA middle, lower)."""
    closes = [c.close for c in candles]
    ema = calculate_ema(closes, period)
    atr = calculate_atr(candles, atr_period)
    n = len(candles)
    upper = [round(ema[i] + atr_mult * atr[i], 4) for i in range(n)]
    lower = [round(ema[i] - atr_mult * atr[i], 4) for i in range(n)]
    return upper, ema, lower


def calculate_cvd(candles: List[Candle]) -> List[float]:
    """Cumulative Volume Delta simulado a partir da posição do close no range do candle."""
    if not candles:
        return []
    cvd = 0.0
    cvd_values = []
    for c in candles:
        hl = c.high - c.low
        if hl == 0:
            buy_vol = c.volume / 2.0
            sell_vol = c.volume / 2.0
        else:
            buy_vol = c.volume * (c.close - c.low) / hl
            sell_vol = c.volume * (c.high - c.close) / hl
        cvd += buy_vol - sell_vol
        cvd_values.append(round(cvd, 2))
    return cvd_values


def calculate_obv(candles: List[Candle]) -> List[float]:
    """On-Balance Volume."""
    if not candles:
        return []
    obv = 0.0
    obv_values = []
    for i, c in enumerate(candles):
        if i == 0:
            obv = c.volume
        elif c.close > candles[i - 1].close:
            obv += c.volume
        elif c.close < candles[i - 1].close:
            obv -= c.volume
        obv_values.append(round(obv, 2))
    return obv_values


def calculate_pivot_points(candles: List[Candle]) -> Dict[str, float]:
    """Pivot Points clássicos baseados no último candle completo."""
    if not candles:
        return {"PP": 0, "R1": 0, "R2": 0, "S1": 0, "S2": 0}
    c = candles[-1]
    pp = (c.high + c.low + c.close) / 3.0
    r1 = 2.0 * pp - c.low
    s1 = 2.0 * pp - c.high
    r2 = pp + (c.high - c.low)
    s2 = pp - (c.high - c.low)
    return {
        "PP": round(pp, 4),
        "R1": round(r1, 4),
        "R2": round(r2, 4),
        "S1": round(s1, 4),
        "S2": round(s2, 4),
    }


def calculate_ichimoku(candles: List[Candle], tenkan_period: int = 9, kijun_period: int = 26,
                        senkou_b_period: int = 52) -> Dict[str, List[float]]:
    """Ichimoku Cloud: retorna tenkan, kijun, senkou_a, senkou_b, chikou."""
    n = len(candles)
    tenkan = [0.0] * n
    kijun = [0.0] * n
    senkou_a = [0.0] * n
    senkou_b = [0.0] * n
    chikou = [0.0] * n

    def midline(candles_slice: List[Candle]) -> float:
        h = max(c.high for c in candles_slice)
        l = min(c.low for c in candles_slice)
        return (h + l) / 2.0

    for i in range(n):
        if i >= tenkan_period - 1:
            tenkan[i] = round(midline(candles[i - tenkan_period + 1: i + 1]), 4)
        if i >= kijun_period - 1:
            kijun[i] = round(midline(candles[i - kijun_period + 1: i + 1]), 4)
        if tenkan[i] > 0 and kijun[i] > 0:
            senkou_a[i] = round((tenkan[i] + kijun[i]) / 2.0, 4)
        if i >= senkou_b_period - 1:
            senkou_b[i] = round(midline(candles[i - senkou_b_period + 1: i + 1]), 4)
        if i >= kijun_period:
            chikou[i] = round(candles[i].close, 4)

    return {
        "tenkan": tenkan,
        "kijun": kijun,
        "senkou_a": senkou_a,
        "senkou_b": senkou_b,
        "chikou": chikou,
    }
