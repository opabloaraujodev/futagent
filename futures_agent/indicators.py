import math
from typing import List, Dict, Any, Tuple
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

def calculate_bollinger_bands(prices: List[float], period: int = 20, std_dev: float = 2.0) -> Tuple[List[float], List[float], List[float]]:
    """Calcula as Bandas de Bollinger (Banda Superior, Banda Inferior, Linha Central/SMA)"""
    n = len(prices)
    if n == 0:
        return [], [], []

    upper_bands = [prices[0]] * n
    lower_bands = [prices[0]] * n
    middle_bands = [prices[0]] * n

    for i in range(n):
        if i < period - 1:
            window = prices[:i + 1]
        else:
            window = prices[i - period + 1 : i + 1]

        sma = sum(window) / len(window)
        variance = sum((x - sma) ** 2 for x in window) / len(window)
        stdev = math.sqrt(variance)

        upper_bands[i] = round(sma + (std_dev * stdev), 4)
        lower_bands[i] = round(sma - (std_dev * stdev), 4)
        middle_bands[i] = round(sma, 4)

    return upper_bands, lower_bands, middle_bands

def calculate_macd(prices: List[float], fast_period: int = 12, slow_period: int = 26, signal_period: int = 9) -> Tuple[List[float], List[float], List[float]]:
    """Calcula MACD (Linha MACD, Linha Sinal, Histograma)"""
    n = len(prices)
    if n == 0:
        return [], [], []

    fast_ema = calculate_ema(prices, period=fast_period)
    slow_ema = calculate_ema(prices, period=slow_period)

    macd_line = [round(fast_ema[i] - slow_ema[i], 4) for i in range(n)]
    signal_line = calculate_ema(macd_line, period=signal_period)
    histogram = [round(macd_line[i] - signal_line[i], 4) for i in range(n)]

    return macd_line, signal_line, histogram

def calculate_supertrend(candles: List[Candle], period: int = 10, multiplier: float = 3.0) -> Tuple[List[float], List[int]]:
    """
    Calcula o indicador Supertrend (Linha de Tendência, Direção: +1 para Alta/LONG, -1 para Baixa/SHORT).
    """
    n = len(candles)
    if n == 0:
        return [], []

    atr_vals = calculate_atr(candles, period=period)
    supertrend = [0.0] * n
    direction = [1] * n  # 1 = Bullish / LONG, -1 = Bearish / SHORT

    basic_upper = [0.0] * n
    basic_lower = [0.0] * n
    final_upper = [0.0] * n
    final_lower = [0.0] * n

    for i in range(n):
        c = candles[i]
        hl2 = (c.high + c.low) / 2.0
        atr = atr_vals[i]

        basic_upper[i] = hl2 + (multiplier * atr)
        basic_lower[i] = hl2 - (multiplier * atr)

        if i == 0:
            final_upper[i] = basic_upper[i]
            final_lower[i] = basic_lower[i]
            direction[i] = 1
            supertrend[i] = final_lower[i]
        else:
            # Final Upper
            if basic_upper[i] < final_upper[i - 1] or candles[i - 1].close > final_upper[i - 1]:
                final_upper[i] = basic_upper[i]
            else:
                final_upper[i] = final_upper[i - 1]

            # Final Lower
            if basic_lower[i] > final_lower[i - 1] or candles[i - 1].close < final_lower[i - 1]:
                final_lower[i] = basic_lower[i]
            else:
                final_lower[i] = final_lower[i - 1]

            # Direção do Supertrend
            prev_dir = direction[i - 1]
            if prev_dir == 1 and c.close < final_lower[i - 1]:
                direction[i] = -1
            elif prev_dir == -1 and c.close > final_upper[i - 1]:
                direction[i] = 1
            else:
                direction[i] = prev_dir

            supertrend[i] = final_lower[i] if direction[i] == 1 else final_upper[i]

    return supertrend, direction

def calculate_candle_range_theory(candles: List[Candle], lookback_range: int = 1) -> Tuple[List[int], List[float], List[float]]:
    """
    Calcula sinais de Candle Range Theory (CRT) / Liquidity Sweep:
    - Identifica o Range de Referência (High/Low) dos últimos 'lookback_range' candles.
    - Sweep de Baixa -> Long Alert: Preço varre abaixo do Low do Range, mas fecha de volta dentro/acima do Low.
    - Sweep de Alta -> Short Alert: Preço varre acima do High do Range, mas fecha de volta dentro/abaixo do High.
    Retorna:
      - signals: List[int] (1 para LONG, -1 para SHORT, 0 para NEUTRAL)
      - range_highs: List[float]
      - range_lows: List[float]
    """
    n = len(candles)
    if n == 0:
        return [], [], []

    signals = [0] * n
    range_highs = [candles[0].high] * n
    range_lows = [candles[0].low] * n

    for i in range(1, n):
        start_idx = max(0, i - lookback_range)
        ref_candles = candles[start_idx:i]
        ref_high = max(c.high for c in ref_candles)
        ref_low = min(c.low for c in ref_candles)

        range_highs[i] = ref_high
        range_lows[i] = ref_low

        cur = candles[i]

        # Sweep de Baixa -> Rejeição e Sinal Long
        if cur.low < ref_low and cur.close > ref_low:
            signals[i] = 1
        # Sweep de Alta -> Rejeição e Sinal Short
        elif cur.high > ref_high and cur.close < ref_high:
            signals[i] = -1

    return signals, range_highs, range_lows

