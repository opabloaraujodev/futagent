import json
import time
import urllib.request
import urllib.parse
import hmac
import hashlib
from typing import List, Dict, Any, Optional
from futures_agent.config import BINANCE_FUTURES_URL, BINANCE_API_KEY, BINANCE_SECRET_KEY
from futures_agent.models import Candle


class BinanceFuturesClient:
    """
    Cliente para a API oficial da Binance Futures (USDⓈ-M, mainnet).
    Não utiliza testnet, não usa dado sintético e não mistura dado de Spot:
    toda falha de rede/API é propagada como exceção, nunca mascarada.
    """

    def __init__(self, api_key: str = "", secret_key: str = ""):
        self.api_key = api_key or BINANCE_API_KEY
        self.secret_key = secret_key or BINANCE_SECRET_KEY
        # https://fapi.binance.com — endpoint oficial mainnet de Futures. Única fonte de dados.
        self.base_url = BINANCE_FUTURES_URL
        # Cache simples de filtros de símbolo (stepSize/tickSize/minQty), evita bater no exchangeInfo toda hora
        self._symbol_filters_cache: Dict[str, Dict[str, float]] = {}

    def _request(self, method: str, endpoint: str, params: Optional[Dict[str, Any]] = None,
                 signed: bool = False, retries: int = 3) -> Any:
        params = params or {}
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        if self.api_key:
            headers["X-MBX-APIKEY"] = self.api_key

        if signed:
            if not self.api_key or not self.secret_key:
                raise ValueError("Chaves de API da Binance não configuradas para operações autenticadas (saldo/ordens/alavancagem).")
            params["timestamp"] = int(time.time() * 1000)
            query_string = urllib.parse.urlencode(params)
            signature = hmac.new(self.secret_key.encode("utf-8"), query_string.encode("utf-8"), hashlib.sha256).hexdigest()
            query_string += f"&signature={signature}"
            full_url = f"{self.base_url}{endpoint}?{query_string}"
        else:
            if params:
                query_string = urllib.parse.urlencode(params)
                full_url = f"{self.base_url}{endpoint}?{query_string}"
            else:
                full_url = f"{self.base_url}{endpoint}"

        last_error: Optional[Exception] = None
        for attempt in range(retries):
            try:
                req = urllib.request.Request(full_url, headers=headers, method=method)
                with urllib.request.urlopen(req, timeout=8) as response:
                    data = response.read().decode("utf-8")
                    return json.loads(data)
            except urllib.error.HTTPError as e:
                body = e.read().decode("utf-8") if e.fp else ""
                if e.code == 429 or e.code == 418:
                    # Rate limit / IP ban temporário: espera e tenta de novo, nunca troca de fonte de dado
                    time.sleep((attempt + 1) * 2)
                    last_error = RuntimeError(f"Erro HTTP Binance ({e.code}): {body or e.reason}")
                    continue
                if e.code in (451, 403):
                    # Bloqueio geográfico do endpoint oficial. Não existe mirror oficial de Futures
                    # para contornar isso sem misturar dado de Spot, então propagamos o erro real.
                    raise RuntimeError(
                        f"Endpoint Futures da Binance ({self.base_url}) bloqueado para esta região/IP (HTTP {e.code}). "
                        f"Não é possível obter dado real de Futures a partir daqui."
                    )
                raise RuntimeError(f"Erro HTTP Binance ({e.code}): {body or e.reason}")
            except Exception as e:
                last_error = RuntimeError(f"Erro de conexão com a Binance Futures API: {str(e)}")
                time.sleep(1)

        raise last_error or RuntimeError("Não foi possível obter dados da Binance Futures API.")

    # ------------------------------------------------------------------
    # Dados de mercado (100% reais, Futures, sem fallback sintético)
    # ------------------------------------------------------------------

    def get_klines(self, symbol: str, interval: str = "15m", limit: int = 100,
                    startTime: Optional[int] = None, endTime: Optional[int] = None) -> List[Candle]:
        """Busca candles reais da Binance Futures (USDⓈ-M). Sem dado sintético, sem Spot."""
        params = {
            "symbol": symbol.upper(),
            "interval": interval,
            "limit": min(limit, 1500)
        }
        if startTime:
            params["startTime"] = startTime
        if endTime:
            params["endTime"] = endTime

        raw_klines = self._request("GET", "/fapi/v1/klines", params=params)
        return [Candle.from_binance_kline(k) for k in raw_klines]

    def get_24h_ticker(self, symbol: Optional[str] = None) -> Any:
        """Estatísticas reais de 24h do símbolo em Futures."""
        params = {}
        if symbol:
            params["symbol"] = symbol.upper()
        return self._request("GET", "/fapi/v1/ticker/24hr", params=params)

    def get_current_price(self, symbol: str) -> float:
        """Último preço real negociado em Futures."""
        res = self._request("GET", "/fapi/v1/ticker/price", params={"symbol": symbol.upper()})
        if isinstance(res, list):
            return float(res[0]["price"])
        return float(res["price"])

    def get_symbol_filters(self, symbol: str) -> Dict[str, float]:
        """
        Busca stepSize/tickSize/minQty reais do símbolo (LOT_SIZE / PRICE_FILTER) para
        arredondar corretamente quantidade e preço antes de enviar ordens live.
        Evita rejeição da Binance por precisão (-1111 Precision is over the maximum...).
        """
        symbol = symbol.upper()
        if symbol in self._symbol_filters_cache:
            return self._symbol_filters_cache[symbol]

        res = self._request("GET", "/fapi/v1/exchangeInfo")
        for s in res.get("symbols", []):
            if s["symbol"] == symbol:
                filters = {f["filterType"]: f for f in s["filters"]}
                data = {
                    "stepSize": float(filters.get("LOT_SIZE", {}).get("stepSize", 0.001)),
                    "minQty": float(filters.get("LOT_SIZE", {}).get("minQty", 0.001)),
                    "tickSize": float(filters.get("PRICE_FILTER", {}).get("tickSize", 0.01)),
                }
                self._symbol_filters_cache[symbol] = data
                return data

        raise ValueError(f"Símbolo {symbol} não encontrado no exchangeInfo da Binance Futures.")

    # ------------------------------------------------------------------
    # Conta real (saldo, alavancagem, margem, ordens) — sempre assinado
    # ------------------------------------------------------------------

    def get_account_balance(self, asset: str = "USDT") -> float:
        """Saldo disponível (availableBalance) real da carteira Futures para um ativo."""
        res = self._request("GET", "/fapi/v2/balance", signed=True)
        for entry in res:
            if entry.get("asset", "").upper() == asset.upper():
                return float(entry.get("availableBalance", entry.get("balance", 0.0)))
        return 0.0

    def change_leverage(self, symbol: str, leverage: int) -> Dict[str, Any]:
        """Ajusta a alavancagem real para um símbolo na Binance Futures (1x a 125x)."""
        params = {
            "symbol": symbol.upper(),
            "leverage": int(leverage)
        }
        return self._request("POST", "/fapi/v1/leverage", params=params, signed=True)

    def change_margin_type(self, symbol: str, margin_type: str) -> Dict[str, Any]:
        """Ajusta o modo de margem real ('ISOLATED' ou 'CROSSED')."""
        m_type = "ISOLATED" if "ISO" in margin_type.upper() else "CROSSED"
        params = {
            "symbol": symbol.upper(),
            "marginType": m_type
        }
        try:
            return self._request("POST", "/fapi/v1/marginType", params=params, signed=True)
        except Exception as e:
            # Único caso onde engolir o erro é seguro: a margem já está configurada como pedido.
            if "No need to change" in str(e):
                return {"code": 200, "msg": "Margem já configurada"}
            raise e

    def create_order(self, symbol: str, side: str, order_type: str, quantity: float,
                      price: Optional[float] = None) -> Dict[str, Any]:
        """Cria ordem real na Binance Futures (USDⓈ-M)."""
        params = {
            "symbol": symbol.upper(),
            "side": side.upper(),
            "type": order_type.upper(),
            "quantity": quantity,
        }
        if order_type.upper() == "LIMIT":
            if not price:
                raise ValueError("Preço é obrigatório para ordens LIMIT")
            params["price"] = price
            params["timeInForce"] = "GTC"

        return self._request("POST", "/fapi/v1/order", params=params, signed=True)

    # ------------------------------------------------------------------
    # Dados de futuros perpétuos (Funding Rate, Open Interest)
    # ------------------------------------------------------------------

    def get_funding_rate(self, symbol: str, limit: int = 1) -> List[Dict[str, Any]]:
        """Último(s) funding rate(s) do símbolo (público, sem assinatura)."""
        params = {"symbol": symbol.upper(), "limit": limit}
        return self._request("GET", "/fapi/v1/fundingRate", params=params)

    def get_open_interest(self, symbol: str) -> Dict[str, Any]:
        """Open Interest atual do símbolo (público, sem assinatura)."""
        return self._request("GET", "/fapi/v1/openInterest", params={"symbol": symbol.upper()})
