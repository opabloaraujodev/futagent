import json
import os
import time
import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from futures_agent.config import (
    TRADING_MODE,
    IS_LIVE,
    PAPER_ORDERS_FILE,
    PAPER_STATE_FILE,
    LIVE_ORDERS_FILE
)
from futures_agent.binance_client import BinanceFuturesClient
from futures_agent.models import Order

class OrderManager:
    def __init__(self, client: Optional[BinanceFuturesClient] = None):
        self.client = client or BinanceFuturesClient()

    def _load_paper_state(self) -> Dict[str, Any]:
        if PAPER_STATE_FILE.exists():
            try:
                with open(PAPER_STATE_FILE, "r", encoding="utf-8") as f:
                    st = json.load(f)
                    if "initial_balance" not in st:
                        st["initial_balance"] = 10000.0
                    if "max_simultaneous_trades" not in st:
                        st["max_simultaneous_trades"] = 3
                    if "closed_positions" not in st:
                        st["closed_positions"] = []
                    return st
            except Exception:
                pass
        return {
            "initial_balance": 10000.0,
            "balance": 10000.0,
            "real_wallet_balance": None,
            "max_simultaneous_trades": 3,
            "positions": [],
            "closed_positions": [],
            "history": []
        }

    def _save_paper_state(self, state: Dict[str, Any]):
        try:
            with open(PAPER_STATE_FILE, "w", encoding="utf-8") as f:
                json.dump(state, f, indent=2, ensure_ascii=False)
        except Exception:
            pass

    def _append_order_log(self, file_path: Path, order_dict: Dict[str, Any]):
        orders = []
        if file_path.exists():
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    orders = json.load(f)
            except Exception:
                orders = []
        orders.append(order_dict)
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(orders, f, indent=2, ensure_ascii=False)
        except Exception:
            pass

    def set_max_simultaneous_trades(self, max_trades: int) -> Dict[str, Any]:
        state = self._load_paper_state()
        state["max_simultaneous_trades"] = max(1, int(max_trades))
        self._save_paper_state(state)
        return self.get_paper_balance()

    def close_paper_position(self, pos_id: str, exit_price_override: Optional[float] = None) -> Dict[str, Any]:
        state = self._load_paper_state()

        # Procurar em paper positions e live positions
        target_pos = None
        remaining_pos = []
        for p in state.get("positions", []):
            if p.get("id") == pos_id:
                target_pos = p
            else:
                remaining_pos.append(p)
        state["positions"] = remaining_pos

        if not target_pos:
            remaining_live = []
            for p in state.get("live_positions", []):
                if p.get("id") == pos_id:
                    target_pos = p
                else:
                    remaining_live.append(p)
            state["live_positions"] = remaining_live

        if not target_pos:
            raise ValueError(f"Posição com ID '{pos_id}' não encontrada.")

        sym = target_pos["symbol"]
        exit_price = exit_price_override or self.client.get_current_price(sym)
        entry_price = float(target_pos["entry_price"])
        qty = float(target_pos["quantity"])
        side = target_pos["side"]
        lev = float(target_pos.get("leverage", 10))

        if side == "LONG":
            pnl_usdt = (exit_price - entry_price) * qty
        else: # SHORT
            pnl_usdt = (entry_price - exit_price) * qty

        margin = (entry_price * qty) / max(1.0, lev)
        pnl_pct = (pnl_usdt / margin * 100.0) if margin > 0 else 0.0

        # Atualizar saldo paper com o resultado (apenas para paper positions)
        if target_pos.get("mode", "PAPER") == "PAPER":
            state["balance"] += pnl_usdt

        timestamp_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        closed_record = {
            "id": target_pos["id"],
            "mode": target_pos.get("mode", "PAPER"),
            "symbol": sym,
            "side": side,
            "entry_price": entry_price,
            "exit_price": exit_price,
            "quantity": qty,
            "pnl_usdt": round(pnl_usdt, 2),
            "pnl_pct": round(pnl_pct, 2),
            "exit_reason": "MANUAL_CLOSE",
            "time": target_pos.get("time", timestamp_str),
            "exit_time": timestamp_str,
            "origin": target_pos.get("origin", "manual")
        }

        if "closed_positions" not in state:
            state["closed_positions"] = []
        state["closed_positions"].insert(0, closed_record)

        self._save_paper_state(state)
        return self.get_paper_balance()

    def get_paper_balance(self) -> Dict[str, Any]:
        state = self._load_paper_state()
        init_bal = state.get("initial_balance", 10000.0)
        bal = state.get("balance", 10000.0)
        max_trades = state.get("max_simultaneous_trades", 3)

        # Atualizar preços e PnL não realizado de todas as posições abertas
        all_positions = state.get("positions", []) + state.get("live_positions", [])
        paper_unrealized_pnl = 0.0
        live_unrealized_pnl = 0.0

        updated_positions = []
        for p in all_positions:
            sym = p.get("symbol", "BTCUSDT")
            pos_mode = p.get("mode", "PAPER")
            price_update_failed = False
            price_error_msg = ""
            try:
                curr_price = self.client.get_current_price(sym)
            except Exception as e:
                price_update_failed = True
                price_error_msg = str(e)
                stored_current = p.get("current_price")
                if stored_current is not None:
                    curr_price = float(stored_current)
                else:
                    curr_price = float(p.get("entry_price", 0.0))

            entry_price = float(p.get("entry_price", curr_price))
            qty = float(p.get("quantity", 0.0))
            side = p.get("side", "LONG")
            lev = float(p.get("leverage", 10))

            if side == "LONG":
                pnl_usdt = (curr_price - entry_price) * qty
            else:
                pnl_usdt = (entry_price - curr_price) * qty

            margin = (entry_price * qty) / max(1.0, lev)
            pnl_pct = (pnl_usdt / margin * 100.0) if margin > 0 else 0.0

            if pos_mode == "LIVE":
                live_unrealized_pnl += pnl_usdt
            else:
                paper_unrealized_pnl += pnl_usdt

            p_copy = dict(p)
            p_copy["current_price"] = round(curr_price, 4)
            p_copy["pnl_usdt"] = round(pnl_usdt, 2)
            p_copy["pnl_pct"] = round(pnl_pct, 2)
            p_copy["mode"] = pos_mode
            p_copy["price_update_failed"] = price_update_failed
            if price_update_failed:
                p_copy["price_error"] = price_error_msg or "Falha ao obter preço atual"
            updated_positions.append(p_copy)

        real_wallet = None
        real_wallet_ok = False
        try:
            real_wallet = self.client.get_account_balance("USDT")
            real_wallet_ok = True
        except Exception:
            pass

        # Equity paper = saldo paper + PnL não realizado das paper positions
        paper_equity = bal + paper_unrealized_pnl
        paper_pnl_usdt = paper_equity - init_bal
        paper_pnl_pct = (paper_pnl_usdt / init_bal * 100.0) if init_bal > 0 else 0.0

        # Equity live = saldo real Binance + PnL não realizado das live positions
        live_equity = None
        live_pnl_usdt = 0.0
        live_pnl_pct = 0.0
        if real_wallet_ok:
            live_equity = real_wallet + live_unrealized_pnl
            # Para PnL live, usamos o saldo real como referência
            live_pnl_usdt = live_unrealized_pnl
            live_pnl_pct = (live_pnl_usdt / real_wallet * 100.0) if real_wallet > 0 else 0.0

        return {
            "initial_balance": round(init_bal, 2),
            "balance": round(bal, 2),
            "real_wallet_balance": round(real_wallet, 2) if real_wallet_ok else None,
            "real_wallet_available": real_wallet_ok,
            "equity": round(paper_equity, 2),
            "pnl_usdt": round(paper_pnl_usdt, 2),
            "pnl_pct": round(paper_pnl_pct, 2),
            "live_equity": round(live_equity, 2) if live_equity is not None else None,
            "live_pnl_usdt": round(live_pnl_usdt, 2),
            "live_pnl_pct": round(live_pnl_pct, 2),
            "open_orders_count": len(updated_positions),
            "max_simultaneous_trades": max_trades,
            "positions": updated_positions,
            "closed_positions": state.get("closed_positions", []),
            "history": state.get("history", [])
        }

    def reset_paper_balance(self, initial_balance: float = 10000.0) -> Dict[str, Any]:
        state = {
            "initial_balance": initial_balance,
            "balance": initial_balance,
            "real_wallet_balance": None,
            "max_simultaneous_trades": 3,
            "positions": [],
            "closed_positions": [],
            "history": []
        }
        self._save_paper_state(state)
        return self.get_paper_balance()

    def get_live_wallet_balance(self, asset: str = "USDT") -> Dict[str, Any]:
        """Consulta o saldo real disponível na conta Binance Futures"""
        balance = self.client.get_account_balance(asset)
        return {
            "mode": "LIVE",
            "asset": asset,
            "available_balance": round(balance, 2)
        }

    def execute_paper_order(
        self,
        symbol: str,
        side: str,
        quantity: float = 0.0,
        price: Optional[float] = None,
        sl_price: Optional[float] = None,
        tp_price: Optional[float] = None,
        leverage: int = 10,
        margin_type: str = "ISOLATED",
        position_sizing_type: str = "PERCENT",
        position_size_value: Optional[float] = None,
        notes: str = "",
        origin: str = "manual"
    ) -> Order:
        """Executa ordem virtual em modo Paper Trading"""
        state = self._load_paper_state()
        max_trades = state.get("max_simultaneous_trades", 3)
        current_open = len(state.get("positions", []))

        if current_open >= max_trades:
            raise ValueError(f"Limite máximo de {max_trades} trades simultâneos atingido ({current_open}/{max_trades}). Feche alguma posição ou aumente o limite.")

        current_price = price or self.client.get_current_price(symbol)
        timestamp_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        order_id = f"PAPER-{int(time.time()*1000)}"

        bal = state.get("balance", 10000.0)

        # Calcular quantidade se não informada diretamente
        actual_qty = quantity
        if actual_qty <= 0:
            pos_val = position_size_value if position_size_value is not None else 10.0
            if "FIX" in position_sizing_type.upper():
                margin_alloc = min(pos_val, bal)
            else:
                margin_alloc = bal * (pos_val / 100.0)
            notional = margin_alloc * leverage
            actual_qty = notional / current_price if current_price > 0 else 0.001

        actual_qty = round(max(0.0001, actual_qty), 4)

        order = Order(
            order_id=order_id,
            symbol=symbol.upper(),
            side=side.upper(),
            type="MARKET" if not price else "LIMIT",
            price=current_price,
            quantity=actual_qty,
            status="FILLED",
            mode="PAPER",
            timestamp=timestamp_str,
            leverage=leverage,
            margin_type="ISOLATED" if "ISO" in margin_type.upper() else "CROSS",
            position_sizing_type="FIXED" if "FIX" in position_sizing_type.upper() else "PERCENT",
            position_size_value=position_size_value,
            sl_price=sl_price,
            tp_price=tp_price,
            notes=notes,
            origin=origin
        )

        # Atualizar saldo virtual e posições
        cost = current_price * actual_qty / max(1, leverage)
        if side.upper() == "BUY":
            state["balance"] -= cost * 0.001  # taxa fictícia
            state["positions"].append({
                "id": order_id,
                "symbol": symbol.upper(),
                "side": "LONG",
                "entry_price": current_price,
                "quantity": actual_qty,
                "leverage": leverage,
                "margin_type": margin_type,
                "sl": sl_price,
                "tp": tp_price,
                "time": timestamp_str,
                "origin": origin
            })
        else:  # SELL
            state["balance"] -= cost * 0.001
            state["positions"].append({
                "id": order_id,
                "symbol": symbol.upper(),
                "side": "SHORT",
                "entry_price": current_price,
                "quantity": actual_qty,
                "leverage": leverage,
                "margin_type": margin_type,
                "sl": sl_price,
                "tp": tp_price,
                "time": timestamp_str,
                "origin": origin
            })

        state["history"].append(order.to_dict())
        self._save_paper_state(state)
        self._append_order_log(PAPER_ORDERS_FILE, order.to_dict())

        return order

    def execute_live_order(
        self,
        symbol: str,
        side: str,
        quantity: float = 0.0,
        price: Optional[float] = None,
        sl_price: Optional[float] = None,
        tp_price: Optional[float] = None,
        leverage: int = 10,
        margin_type: str = "ISOLATED",
        position_sizing_type: str = "PERCENT",
        position_size_value: Optional[float] = None,
        notes: str = "",
        force_confirmed: bool = False,
        origin: str = "manual"
    ) -> Order:
        """
        Executa ordem real na Binance Futures.
        Ajusta margem e alavancagem via API antes do envio.
        """
        # 1. Tentar configurar margem e alavancagem no contrato
        m_type = "ISOLATED" if "ISO" in margin_type.upper() else "CROSSED"
        try:
            self.client.change_margin_type(symbol, m_type)
        except Exception as e:
            print(f"⚠️ Aviso ao alterar modo de margem na Binance: {e}")

        try:
            self.client.change_leverage(symbol, leverage)
        except Exception as e:
            print(f"⚠️ Aviso ao alterar alavancagem na Binance: {e}")

        # current_price = price or self.client.get_current_price(symbol)
        # actual_qty = quantity
        # if actual_qty <= 0:
        #     pos_val = position_size_value if position_size_value is not None else 10.0
        #     # Em modo real, assumimos 100 USDT como saldo estimado se não soubermos
        #     estimated_bal = 100.0
        #     if "FIX" in position_sizing_type.upper():
        #         margin_alloc = pos_val
        #     else:
        #         margin_alloc = estimated_bal * (pos_val / 100.0)
        #     notional = margin_alloc * leverage
        #     actual_qty = notional / current_price if current_price > 0 else 0.001
        current_price = price or self.client.get_current_price(symbol)
        actual_qty = quantity
        if actual_qty <= 0:
            pos_val = position_size_value if position_size_value is not None else 10.0
            if "FIX" in position_sizing_type.upper():
                margin_alloc = pos_val
            else:
                # Antes: estimated_bal = 100.0 (fixo)
                real_bal = self.client.get_account_balance("USDT")
                margin_alloc = real_bal * (pos_val / 100.0)
            notional = margin_alloc * leverage
            actual_qty = notional / current_price if current_price > 0 else 0.001

        actual_qty = round(max(0.0001, actual_qty), 4)

        if not force_confirmed:
            print("\n" + "="*60)
            print("🚨 ATENÇÃO: VOCÊ ESTÁ PRESTES A EXECUTAR UMA ORDEM REAL NA BINANCE FUTURES!")
            print(f"Contrato: {symbol.upper()} | Lado: {side.upper()} | Quantidade: {actual_qty} | Alavancagem: {leverage}x | Margem: {m_type}")
            print("="*60)
            confirm_code = input("Para prosseguir, digite 'CONFIRMAR': ").strip()
            if confirm_code != "CONFIRMAR":
                raise PermissionError("Execução real CANCELADA: Confirmação do usuário não bateu com 'CONFIRMAR'.")

        res = self.client.create_order(
            symbol=symbol,
            side=side,
            order_type="MARKET" if not price else "LIMIT",
            quantity=actual_qty,
            price=price
        )

        timestamp_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        order = Order(
            order_id=str(res.get("orderId", f"LIVE-{int(time.time())}")),
            symbol=symbol.upper(),
            side=side.upper(),
            type="MARKET" if not price else "LIMIT",
            price=float(res.get("avgPrice") or res.get("price") or 0.0) or current_price,
            quantity=actual_qty,
            status=str(res.get("status", "FILLED")),
            mode="LIVE",
            timestamp=timestamp_str,
            leverage=leverage,
            margin_type=m_type,
            position_sizing_type="FIXED" if "FIX" in position_sizing_type.upper() else "PERCENT",
            position_size_value=position_size_value,
            sl_price=sl_price,
            tp_price=tp_price,
            notes=notes,
            origin=origin
        )

        self._append_order_log(LIVE_ORDERS_FILE, order.to_dict())

        # Salvar posição live no paper_state.json para rastrear PnL
        state = self._load_paper_state()
        if "live_positions" not in state:
            state["live_positions"] = []
        state["live_positions"].append({
            "id": order.order_id,
            "symbol": symbol.upper(),
            "side": "LONG" if side.upper() == "BUY" else "SHORT",
            "entry_price": order.price,
            "quantity": actual_qty,
            "leverage": leverage,
            "margin_type": m_type,
            "sl": sl_price,
            "tp": tp_price,
            "time": timestamp_str,
            "mode": "LIVE",
            "origin": origin
        })
        state["history"].append(order.to_dict())
        self._save_paper_state(state)

        return order
