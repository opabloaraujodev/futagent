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
    Trata tanto formatos da API Binance [open_time, open, high, ...] quanto dicionários com open_time/open/etc.
    """
    try:
        if isinstance(item, dict):
            raw_ts = item.get("open_time") if "open_time" in item else item.get("timestamp", 0)
            ts = normalize_timestamp(raw_ts)
            open_p = float(item.get("open", 0.0))
            high_p = float(item.get("high", 0.0))
            low_p = float(item.get("low", 0.0))
            close_p = float(item.get("close", 0.0))
            volume_p = float(item.get("volume", 0.0))
            return Candle(timestamp=ts, open=open_p, high=high_p, low=low_p, close=close_p, volume=volume_p)
        elif isinstance(item, (list, tuple)) and len(item) >= 6:
            ts = normalize_timestamp(item[0])
            open_p = float(item[1])
            high_p = float(item[2])
            low_p = float(item[3])
            close_p = float(item[4])
            volume_p = float(item[5])
            return Candle(timestamp=ts, open=open_p, high=high_p, low=low_p, close=close_p, volume=volume_p)
    except Exception:
        pass
    return None

def extract_period_from_filename(filename: str) -> Optional[str]:
    """
    Extrai o período YYYY-MM do nome do arquivo. Exemplo: ADAUSDT-15m-2020-01.json -> "2020-01"
    """
    match = re.search(r'(\d{4}-\d{2})', filename)
    if match:
        return match.group(1)
    return None

def load_historical_klines_from_json(
    symbol: str,
    timeframe: str = "15m",
    data_dir: str = "/home/pablo/datadown/data/monthly",
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

    for f in all_json_files:
        filename = f.name
        # Verificar se o nome do arquivo corresponde ao símbolo e timeframe
        if clean_symbol in filename.upper() and timeframe in filename:
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
                if not isinstance(data, list):
                    continue

                for raw_item in data:
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
