import os
import sys
import json
import re
from pathlib import Path
from typing import List, Optional, Dict, Any
from futures_agent.models import Candle

def normalize_timestamp(raw_ts: Any) -> int:
    """
    Normaliza timestamps numéricos para milissegundos.
    Detecta timestamps em microssegundos (16 dígitos, > 1e14) e converte para ms.
    """
    try:
        ts = int(raw_ts)
        if ts > 100000000000000:  # > 1e14 (microssegundos, ex: 1583021100000000)
            return ts // 1000
        return ts
    except (ValueError, TypeError):
        return 0

def parse_kline_item(item: Any) -> Optional[Candle]:
    """
    Converte um item de kline JSON (objeto dict ou lista de valores) para a dataclass Candle.
    Trata múltiplos formatos de chave (open/o, high/h, etc.) e estruturas de lista.
    """
    try:
        if isinstance(item, dict):
            raw_ts = (
                item.get("open_time")
                if "open_time" in item
                else item.get("openTime")
                if "openTime" in item
                else item.get("timestamp")
                if "timestamp" in item
                else item.get("time")
                if "time" in item
                else item.get("t", 0)
            )
            ts = normalize_timestamp(raw_ts)
            open_p = float(item.get("open", item.get("o", 0.0)))
            high_p = float(item.get("high", item.get("h", 0.0)))
            low_p = float(item.get("low", item.get("l", 0.0)))
            close_p = float(item.get("close", item.get("c", 0.0)))
            volume_p = float(item.get("volume", item.get("v", item.get("vol", 0.0))))
            return Candle(timestamp=ts, open=open_p, high=high_p, low=low_p, close=close_p, volume=volume_p)
        elif isinstance(item, (list, tuple)) and len(item) >= 5:
            ts = normalize_timestamp(item[0])
            open_p = float(item[1])
            high_p = float(item[2])
            low_p = float(item[3])
            close_p = float(item[4])
            volume_p = float(item[5]) if len(item) >= 6 else 0.0
            return Candle(timestamp=ts, open=open_p, high=high_p, low=low_p, close=close_p, volume=volume_p)
    except Exception:
        pass
    return None

def extract_period_from_filename(filename: str) -> Optional[str]:
    """
    Extrai o período YYYY-MM do nome do arquivo. Exemplo: ADAUSDT-15m-2020-01.json -> "2020-01" ou 202001 -> "2020-01"
    """
    match = re.search(r'(\d{4})[-_]?(\d{2})', filename)
    if match:
        year, month = match.group(1), match.group(2)
        if 2010 <= int(year) <= 2035 and 1 <= int(month) <= 12:
            return f"{year}-{month}"
    return None

def load_historical_klines_from_json(
    symbol: str,
    timeframe: str = "15m",
    data_dir: str = "/mnt/e/datadown/data/monthly/15m",
    periods: Optional[List[str]] = None,
    start_period: Optional[str] = None,
    end_period: Optional[str] = None
) -> List[Candle]:
    """
    Carrega arquivos de histórico local JSON de uma pasta e suas subpastas.
    Filtra por símbolo, timeframe e períodos solicitados (ex: ["2021-05", "2022-06"] ou intervalo 2021-01 a 2021-12).
    Normaliza os timestamps (ms vs us), ordena cronologicamente e remove duplicatas.
    """
    clean_symbol = symbol.strip().upper()
    dir_path = Path(data_dir)
    if not dir_path.exists():
        print(f"⚠️ [Data Loader] Diretório de dados locais não encontrado: {data_dir}", file=sys.stderr)
        return []

    # Localizar arquivos .json recursivamente
    all_json_files = list(dir_path.rglob("*.json"))
    matched_files = []

    # Normalizar lista de períodos
    clean_periods = [p.strip() for p in periods if p.strip()] if periods else None

    # Variantes de símbolo (ex: BTCUSDT, BTC_USDT, BTC-USDT)
    sym_base = clean_symbol.replace("USDT", "").replace("BUSD", "")
    sym_variants = [clean_symbol, f"{sym_base}_USDT", f"{sym_base}-USDT", clean_symbol.lower()]

    tf_lower = timeframe.lower()

    for f in all_json_files:
        filename = f.name
        fn_upper = filename.upper()
        fn_lower = filename.lower()

        # Verificar se o nome do arquivo corresponde ao símbolo
        symbol_matched = any(v in fn_upper or v in fn_lower for v in sym_variants)
        if not symbol_matched and sym_base:
            symbol_matched = sym_base in fn_upper

        if symbol_matched:
            # Verificar se timeframe bate ou se arquivo não tem outro timeframe conflitante
            tf_matched = (tf_lower in fn_lower) or not any(
                other_tf in fn_lower for other_tf in ["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "1d"] if other_tf != tf_lower
            )

            if tf_matched:
                file_period = extract_period_from_filename(filename)
                
                # Filtro por lista explícita de períodos
                if clean_periods and file_period:
                    if file_period not in clean_periods:
                        continue
                
                # Filtro por intervalo (start_period <= period <= end_period)
                if file_period:
                    if start_period and file_period < start_period:
                        continue
                    if end_period and file_period > end_period:
                        continue

                matched_files.append(f)

    if not matched_files:
        print(f"⚠️ [Data Loader] Nenhum arquivo JSON encontrado para {clean_symbol} ({timeframe}) em {data_dir}", file=sys.stderr)
        return []

    candles: List[Candle] = []
    seen_timestamps = set()

    for fpath in matched_files:
        try:
            with open(fpath, "r", encoding="utf-8") as file:
                data = json.load(file)
                items = []
                if isinstance(data, list):
                    items = data
                elif isinstance(data, dict):
                    for key in ["data", "klines", "candles", "result", "rows"]:
                        if key in data and isinstance(data[key], list):
                            items = data[key]
                            break

                for raw_item in items:
                    candle = parse_kline_item(raw_item)
                    if candle and candle.timestamp > 0:
                        if candle.timestamp not in seen_timestamps:
                            seen_timestamps.add(candle.timestamp)
                            candles.append(candle)
        except Exception as e:
            print(f"⚠️ [Data Loader] Erro ao ler arquivo {fpath}: {e}", file=sys.stderr)

    # Ordenar cronologicamente por timestamp
    candles.sort(key=lambda c: c.timestamp)

    print(f"✅ [Data Loader] Carregados {len(candles)} candles históricos de {len(matched_files)} arquivo(s) para {clean_symbol}", file=sys.stderr)
    return candles
