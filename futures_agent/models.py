import time
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional

@dataclass
class Candle:
    timestamp: int
    open: float
    high: float
    low: float
    close: float
    volume: float

    @classmethod
    def from_binance_kline(cls, kline: list) -> 'Candle':
        ts = int(kline[0])
        if ts > 100000000000000:  # Convert microseconds to milliseconds if > 1e14
            ts = ts // 1000
        return cls(
            timestamp=ts,
            open=float(kline[1]),
            high=float(kline[2]),
            low=float(kline[3]),
            close=float(kline[4]),
            volume=float(kline[5])
        )

@dataclass
class Recommendation:
    acao: str  # "COMPRA", "VENDA", "AGUARDAR"
    preco_entrada: float
    stop: float
    alvo: float
    confianca: int  # 0 to 100
    justificativa: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

@dataclass
class ScanResult:
    symbol: str
    price: float
    rsi: float
    volume_current: float
    volume_avg: float
    volume_ratio_pct: float
    is_volume_spike: bool
    is_rsi_oversold: bool
    is_rsi_overbought: bool
    support_levels: List[float]
    resistance_levels: List[float]
    entry_zone: Dict[str, float]  # {"low": float, "high": float, "type": "LONG"|"SHORT"|"NEUTRAL"}
    signal: str  # "LONG_ALERT", "SHORT_ALERT", "NEUTRAL"
    timestamp: str
    donchian_upper: Optional[float] = None
    donchian_lower: Optional[float] = None
    cmf: Optional[float] = None
    recommendation: Optional[Recommendation] = None

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        if self.recommendation:
            d['recommendation'] = self.recommendation.to_dict()
        return d

@dataclass
class Trade:
    id: str
    symbol: str
    side: str  # "BUY" or "SELL"
    entry_price: float
    exit_price: float
    entry_time: str
    exit_time: str
    quantity: float
    pnl: float
    pnl_pct: float
    exit_reason: str  # "TAKE_PROFIT", "STOP_LOSS", "SIGNAL_CHANGE", "TIME"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

@dataclass
class BacktestResult:
    symbol: str
    timeframe: str
    initial_capital: float
    final_capital: float
    total_pnl: float
    total_pnl_pct: float
    win_rate_pct: float
    total_trades: int
    winning_trades: int
    losing_trades: int
    max_drawdown_pct: float
    profit_factor: float
    sharpe_ratio: float
    parameters: Dict[str, Any]
    trades: List[Trade]
    disclaimer: str = "Aviso: Resultados teóricos simulados sem considerar derrapagem (slippage) ou taxas de corretagem em tempo real."

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d['trades'] = [t.to_dict() for t in self.trades]
        return d

@dataclass
class OptimizationResult:
    symbol: str
    timeframe: str
    tested_combinations: int
    top_strategies: List[Dict[str, Any]]
    ranking_metric: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

@dataclass
class Order:
    order_id: str
    symbol: str
    side: str  # "BUY" or "SELL"
    type: str  # "MARKET", "LIMIT"
    price: float
    quantity: float
    status: str  # "FILLED", "CANCELLED", "PENDING"
    mode: str  # "PAPER" or "LIVE"
    timestamp: str
    leverage: int = 10
    margin_type: str = "ISOLATED"
    position_sizing_type: str = "PERCENT"
    position_size_value: Optional[float] = None
    sl_price: Optional[float] = None
    tp_price: Optional[float] = None
    notes: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
