#!/usr/bin/env python3
import sys
import json
import argparse
from typing import List
from futures_agent.config import (
    DEFAULT_SYMBOLS,
    DEFAULT_TIMEFRAME,
    DEFAULT_RSI_PERIOD,
    DEFAULT_RSI_OVERSOLD,
    DEFAULT_RSI_OVERBOUGHT,
    DEFAULT_VOLUME_RATIO,
    DEFAULT_OLLAMA_MODEL,
    TRADING_MODE,
    IS_LIVE
)
from futures_agent.scanner import MarketScanner
from futures_agent.backtester import Backtester
from futures_agent.optimizer import StrategyOptimizer
from futures_agent.trader import OrderManager
from futures_agent.pine_generator import PineGenerator
from futures_agent.ollama_advisor import OllamaAdvisor

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Agente Multiassímbolo de Análise Técnica e Trading para Binance Futures (USDⓈ-M)",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    subparsers = parser.add_subparsers(dest="command", required=True, help="Subcomando de execução")

    # --- SUBCOMANDO SCAN ---
    scan_p = subparsers.add_parser("scan", help="Varre múltiplos contratos em busca de alertas de RSI e Volume")
    scan_p.add_argument("--symbols", type=str, default=",".join(DEFAULT_SYMBOLS), help="Lista de simbolos separados por virgula")
    scan_p.add_argument("--timeframe", type=str, default=DEFAULT_TIMEFRAME, help="Tempo grafico")
    scan_p.add_argument("--rsi-period", type=int, default=DEFAULT_RSI_PERIOD, help="Período do RSI")
    scan_p.add_argument("--rsi-low", type=float, default=DEFAULT_RSI_OVERSOLD, help="Threshold de sobrevenda RSI")
    scan_p.add_argument("--rsi-high", type=float, default=DEFAULT_RSI_OVERBOUGHT, help="Threshold de sobrecompra RSI")
    scan_p.add_argument("--vol-ratio", type=float, default=DEFAULT_VOLUME_RATIO, help="Multiplicador de volume spike")
    scan_p.add_argument("--all", action="store_true", help="Retorna todos os símbolos, não apenas os filtrados")
    scan_p.add_argument("--with-ollama", action="store_true", help="Usa modelo Ollama local para analisar sinais")
    scan_p.add_argument("--model", type=str, default=DEFAULT_OLLAMA_MODEL, help="Nome do modelo Ollama")
    scan_p.add_argument("--use-local-json", action="store_true", help="Usar arquivos históricos JSON locais em vez da API Binance")
    scan_p.add_argument("--data-dir", type=str, default="/home/pablo/datadown/data/monthly", help="Caminho do diretório de arquivos JSON")
    scan_p.add_argument("--periods", type=str, default="", help="Periodos separados por virgula")
    scan_p.add_argument("--start-period", type=str, default="", help="Periodo inicial do intervalo")
    scan_p.add_argument("--end-period", type=str, default="", help="Periodo final do intervalo")
    scan_p.add_argument("--strategy", type=str, default="rsi_volume", choices=["rsi_volume", "donchian_cmf", "vwap_reversion", "donchian_breakout", "supertrend_pullback", "squeeze_breakout", "orderflow_divergence", "funding_sentiment", "ichimoku_cloud", "pivot_points", "candle_range_theory"], help="Estratégia de sinal: rsi_volume, donchian_cmf, etc.")
    scan_p.add_argument("--donchian-period", type=int, default=20, help="Periodo Canal Donchian")
    scan_p.add_argument("--cmf-period", type=int, default=20, help="Periodo CMF")
    scan_p.add_argument("--cmf-threshold", type=float, default=0.05, help="Threshold minimo CMF")
    scan_p.add_argument("--vwap-deviation-pct", type=float, default=0.3, help="Desvio minimo VWAP em porcentagem")
    scan_p.add_argument("--chop-threshold", type=float, default=61.0, help="Threshold Choppiness Index")
    scan_p.add_argument("--supertrend-period", type=int, default=10, help="Periodo SuperTrend")
    scan_p.add_argument("--supertrend-multiplier", type=float, default=3.0, help="Multiplicador SuperTrend")
    scan_p.add_argument("--stoch-rsi-period", type=int, default=14, help="Periodo Stoch RSI")
    scan_p.add_argument("--bb-period", type=int, default=20, help="Periodo Bollinger Bands")
    scan_p.add_argument("--bb-std-dev", type=float, default=2.0, help="Desvio padrao BB")
    scan_p.add_argument("--kc-atr-period", type=int, default=10, help="Periodo ATR Keltner")
    scan_p.add_argument("--kc-atr-mult", type=float, default=2.0, help="Multiplicador ATR Keltner")
    scan_p.add_argument("--orderflow-lookback", type=int, default=20, help="Lookback orderflow")
    scan_p.add_argument("--funding-threshold", type=float, default=0.0005, help="Threshold funding rate")
    scan_p.add_argument("--ichimoku-tenkan", type=int, default=9, help="Tenkan-sen")
    scan_p.add_argument("--ichimoku-kijun", type=int, default=26, help="Kijun-sen")
    scan_p.add_argument("--ichimoku-senkou-b", type=int, default=52, help="Senkou Span B")
    scan_p.add_argument("--pivot-vol-period", type=int, default=20, help="Volume SMA pivot")
    scan_p.add_argument("--crt-lookback", type=int, default=50, help="CRT lookback")
    scan_p.add_argument("--crt-range-lookback", type=int, default=5, help="CRT range lookback")
    scan_p.add_argument("--crt-min-range-pct", type=float, default=0.2, help="CRT min range percent")
    scan_p.add_argument("--crt-sweep-confirmation-bars", type=int, default=3, help="CRT confirmation bars")
    scan_p.add_argument("--json", action="store_true", help="Saída em formato JSON estruturado")

    # --- SUBCOMANDO BACKTEST ---
    bt_p = subparsers.add_parser("backtest", help="Simula estratégia em histórico de mercado")
    bt_p.add_argument("--symbol", type=str, default="BTCUSDT", help="Símbolo do contrato")
    bt_p.add_argument("--timeframe", type=str, default="15m", help="Tempo gráfico")
    bt_p.add_argument("--strategy", type=str, default="rsi_volume", choices=["rsi_volume", "donchian_cmf", "vwap_reversion", "donchian_breakout", "supertrend_pullback", "squeeze_breakout", "orderflow_divergence", "funding_sentiment", "ichimoku_cloud", "pivot_points", "candle_range_theory"], help="Estratégia: rsi_volume ou donchian_cmf")
    bt_p.add_argument("--capital", type=float, default=10000.0, help="Capital inicial em USDT")
    bt_p.add_argument("--rsi-period", type=int, default=14, help="Período do RSI")
    bt_p.add_argument("--rsi-low", type=float, default=30.0, help="RSI Sobrevenda")
    bt_p.add_argument("--rsi-high", type=float, default=70.0, help="RSI Sobrecompra")
    bt_p.add_argument("--vol-ratio", type=float, default=2.0, help="Volume Spike Multiplier")
    bt_p.add_argument("--donchian-period", type=int, default=20, help="Período Canal Donchian")
    bt_p.add_argument("--cmf-period", type=int, default=20, help="Período CMF")
    bt_p.add_argument("--cmf-threshold", type=float, default=0.05, help="Threshold mínimo CMF")
    bt_p.add_argument("--ema-filter", type=int, default=0, help="Periodo EMA de tendencia")
    bt_p.add_argument("--use-atr-stop", action="store_true", help="Usar ATR para Stop Loss e Take Profit")
    bt_p.add_argument("--atr-period", type=int, default=14, help="Período ATR")
    bt_p.add_argument("--atr-multiplier", type=float, default=2.0, help="Multiplicador ATR")
    bt_p.add_argument("--use-trailing-stop", action="store_true", help="Ativar Trailing Stop inteligente")
    bt_p.add_argument("--trailing-activation-pct", type=float, default=1.0, help="Ganhos em percentuais necessarios para ativar Trailing Stop")
    bt_p.add_argument("--trailing-distance-pct", type=float, default=1.0, help="Distancia do Trailing Stop em percentuais")
    bt_p.add_argument("--trailing-type", type=str, default="PERCENT", choices=["PERCENT", "ATR_DYNAMIC", "STEP_RATCHET"], help="Tipo de Trailing: PERCENT, ATR_DYNAMIC ou STEP_RATCHET")
    bt_p.add_argument("--trailing-atr-mult", type=float, default=2.0, help="Multiplicador ATR para trailing ATR_DYNAMIC")
    bt_p.add_argument("--sl", type=float, default=1.5, help="Stop Loss em percentuais")
    bt_p.add_argument("--tp", type=float, default=3.0, help="Take Profit em percentuais")
    bt_p.add_argument("--vwap-deviation-pct", type=float, default=0.3, help="Desvio minimo VWAP em percentuais")
    bt_p.add_argument("--chop-threshold", type=float, default=61.0, help="Threshold Choppiness Index")
    bt_p.add_argument("--supertrend-period", type=int, default=10, help="Período SuperTrend")
    bt_p.add_argument("--supertrend-multiplier", type=float, default=3.0, help="Multiplicador SuperTrend")
    bt_p.add_argument("--stoch-rsi-period", type=int, default=14, help="Periodo Stoch RSI")
    bt_p.add_argument("--bb-period", type=int, default=20, help="Periodo Bollinger Bands")
    bt_p.add_argument("--bb-std-dev", type=float, default=2.0, help="Desvio padrão Bollinger Bands")
    bt_p.add_argument("--kc-atr-period", type=int, default=10, help="Período ATR Keltner Channel")
    bt_p.add_argument("--kc-atr-mult", type=float, default=2.0, help="Multiplicador ATR Keltner Channel")
    bt_p.add_argument("--orderflow-lookback", type=int, default=20, help="Lookback bars para divergência CVD/OBV")
    bt_p.add_argument("--funding-threshold", type=float, default=0.0005, help="Threshold funding rate para sentimento")
    bt_p.add_argument("--ichimoku-tenkan", type=int, default=9, help="Tenkan-sen")
    bt_p.add_argument("--ichimoku-kijun", type=int, default=26, help="Kijun-sen")
    bt_p.add_argument("--ichimoku-senkou-b", type=int, default=52, help="Senkou Span B")
    bt_p.add_argument("--pivot-vol-period", type=int, default=20, help="Volume periodo para pivot")
    bt_p.add_argument("--pivot-exit-pct", type=float, default=1.0, help="Threshold percentuais para pivot exit")
    bt_p.add_argument("--crt-lookback", type=int, default=50, help="CRT lookback")
    bt_p.add_argument("--crt-range-lookback", type=int, default=5, help="CRT range lookback")
    bt_p.add_argument("--crt-min-range-pct", type=float, default=0.2, help="CRT min range percentuais")
    bt_p.add_argument("--crt-sweep-confirmation-bars", type=int, default=3, help="CRT confirmation bars")
    bt_p.add_argument("--leverage", type=float, default=10.0, help="Alavancagem (ex: 10)")
    bt_p.add_argument("--margin-type", type=str, default="ISOLATED", choices=["ISOLATED", "CROSS", "isolated", "cross"], help="Modo de margem: ISOLATED ou CROSS")
    bt_p.add_argument("--position-sizing-type", type=str, default="PERCENT", choices=["PERCENT", "FIXED", "percent", "fixed"], help="Tipo de dimensionamento: PERCENT ou FIXED")
    bt_p.add_argument("--position-size-value", type=float, default=10.0, help="Valor do dimensionamento (porcentagem ou USDT)")
    bt_p.add_argument("--limit", type=int, default=500, help="Quantidade de candles historicos (maximo 1500)")
    bt_p.add_argument("--use-local-json", action="store_true", help="Usar arquivos históricos JSON locais")
    bt_p.add_argument("--data-dir", type=str, default="/home/pablo/datadown/data/monthly", help="Caminho do diretório de arquivos JSON")
    bt_p.add_argument("--periods", type=str, default="", help="Periodos separados por virgula")
    bt_p.add_argument("--start-period", type=str, default="", help="Periodo inicial do intervalo")
    bt_p.add_argument("--end-period", type=str, default="", help="Periodo final do intervalo")
    bt_p.add_argument("--json", action="store_true", help="Saída em formato JSON")

    # --- SUBCOMANDO OPTIMIZE ---
    opt_p = subparsers.add_parser("optimize", help="Executa otimização grid search de parâmetros")
    opt_p.add_argument("--symbols", type=str, default="BTCUSDT", help="Simbolos separados por virgula")
    opt_p.add_argument("--symbol", type=str, default="BTCUSDT", help="Simbolo unico")
    opt_p.add_argument("--timeframe", type=str, default="15m", help="Tempo gráfico")
    opt_p.add_argument("--strategy", type=str, default="rsi_volume", choices=["rsi_volume", "donchian_cmf", "vwap_reversion", "donchian_breakout", "supertrend_pullback", "squeeze_breakout", "orderflow_divergence", "funding_sentiment", "ichimoku_cloud", "pivot_points", "candle_range_theory"], help="Estratégia: rsi_volume ou donchian_cmf")
    opt_p.add_argument("--all-strategies", action="store_true", help="Rodar grid search em TODAS as estratégias automaticamente")
    opt_p.add_argument("--capital", type=float, default=10000.0, help="Capital inicial em USDT")
    opt_p.add_argument("--use-trailing-stop", action="store_true", help="Ativar Trailing Stop inteligente na otimização")
    opt_p.add_argument("--trailing-activation-pct", type=float, default=1.0, help="Ganhos em percentuais para ativacao do Trailing")
    opt_p.add_argument("--trailing-distance-pct", type=float, default=1.0, help="Distancia do Trailing percentuais")
    opt_p.add_argument("--trailing-type", type=str, default="PERCENT", choices=["PERCENT", "ATR_DYNAMIC", "STEP_RATCHET"], help="Tipo de Trailing Stop")
    opt_p.add_argument("--trailing-atr-mult", type=float, default=2.0, help="Multiplicador ATR para trailing ATR_DYNAMIC")
    opt_p.add_argument("--leverage", type=float, default=10.0, help="Alavancagem (ex: 10)")
    opt_p.add_argument("--margin-type", type=str, default="ISOLATED", help="Modo de margem: ISOLATED ou CROSS")
    opt_p.add_argument("--position-sizing-type", type=str, default="PERCENT", help="Tipo de dimensionamento: PERCENT ou FIXED")
    opt_p.add_argument("--position-size-value", type=float, default=10.0, help="Valor do dimensionamento (porcentagem ou USDT)")
    opt_p.add_argument("--metric", type=str, default="total_pnl_pct", choices=["total_pnl_pct", "win_rate_pct", "sharpe_ratio"], help="Métrica de ordenação")
    opt_p.add_argument("--top-n", type=int, default=10, help="Quantidade de melhores resultados")
    opt_p.add_argument("--limit", type=int, default=500, help="Candles históricos por combinação")
    opt_p.add_argument("--use-local-json", action="store_true", help="Usar arquivos históricos JSON locais")
    opt_p.add_argument("--data-dir", type=str, default="/home/pablo/datadown/data/monthly", help="Caminho do diretório de arquivos JSON")
    opt_p.add_argument("--periods", type=str, default="", help="Periodos separados por virgula")
    opt_p.add_argument("--start-period", type=str, default="", help="Periodo inicial do intervalo")
    opt_p.add_argument("--end-period", type=str, default="", help="Periodo final do intervalo")
    opt_p.add_argument("--crt-lookback", type=int, nargs="+", default=None, help="CRT lookback")
    opt_p.add_argument("--crt-range-lookback", type=int, nargs="+", default=None, help="CRT range lookback")
    opt_p.add_argument("--crt-min-range-pct", type=float, nargs="+", default=None, help="CRT min range percentuais")
    opt_p.add_argument("--crt-sweep-confirmation-bars", type=int, nargs="+", default=None, help="CRT confirmation bars")
    opt_p.add_argument("--json", action="store_true", help="Saída em formato JSON")

    # --- SUBCOMANDO TRADE ---
    tr_p = subparsers.add_parser("trade", help="Executa ordem em modo Paper Trading ou Live Trading")
    tr_p.add_argument("--symbol", type=str, required=False, default="BTCUSDT", help="Símbolo do contrato")
    tr_p.add_argument("--side", type=str, choices=["BUY", "SELL", "buy", "sell"], default="BUY", help="Direção da ordem")
    tr_p.add_argument("--qty", type=float, default=0.0, help="Quantidade de contratos (0 para calcular automaticamente)")
    tr_p.add_argument("--price", type=float, default=None, help="Preço limite (opcional, padrão mercado)")
    tr_p.add_argument("--sl", type=float, default=None, help="Preço de Stop Loss")
    tr_p.add_argument("--tp", type=float, default=None, help="Preço de Take Profit")
    tr_p.add_argument("--leverage", type=int, default=10, help="Alavancagem (1 a 125x)")
    tr_p.add_argument("--margin-type", type=str, default="ISOLATED", choices=["ISOLATED", "CROSS", "isolated", "cross"], help="Modo de margem: ISOLATED ou CROSS")
    tr_p.add_argument("--position-sizing-type", type=str, default="PERCENT", choices=["PERCENT", "FIXED", "percent", "fixed"], help="Tipo de dimensionamento: PERCENT ou FIXED")
    tr_p.add_argument("--position-size-value", type=float, default=None, help="Valor fixo em USDT ou percentuais do saldo")
    tr_p.add_argument("--close-id", type=str, default=None, help="ID da posicao a ser fechada")
    tr_p.add_argument("--set-max-trades", type=int, default=None, help="Configura quantidade de trades simultaneos permitidos")
    tr_p.add_argument("--live", action="store_true", help="Ativa modo REAL")
    tr_p.add_argument("--confirmed", action="store_true", help="Pula confirmacao interativa")
    tr_p.add_argument("--reset-paper", action="store_true", help="Reseta o saldo e histórico da carteira simulada")
    tr_p.add_argument("--status", action="store_true", help="Exibe saldo e estado atual da conta paper")
    tr_p.add_argument("--origin", type=str, default="manual", help="Origem da ordem: 'manual' ou nome da strategy (ex: 'rsi_volume')")
    tr_p.add_argument("--json", action="store_true", help="Saída em formato JSON")

    # --- SUBCOMANDO GENERATE-INDICATOR ---
    gen_p = subparsers.add_parser("generate-indicator", help="Gera código Pine Script v5")
    gen_p.add_argument("--prompt", type=str, default="Estratégia de cruzamento de RSI e Volume Spike para Binance Futures", help="Descrição do indicador em linguagem natural")
    gen_p.add_argument("--model", type=str, default=DEFAULT_OLLAMA_MODEL, help="Modelo Ollama para geração de código")
    gen_p.add_argument("--output", type=str, default="strategy.pine", help="Caminho do arquivo .pine de saída")
    gen_p.add_argument("--json", action="store_true", help="Saída em formato JSON")

    return parser

def main():
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "scan":
        syms = [s.strip().upper() for s in args.symbols.split(",") if s.strip()]
        periods_list = [p.strip() for p in args.periods.split(",") if p.strip()] if args.periods else None
        scanner = MarketScanner()
        scan_result = scanner.scan_markets(
            symbols=syms,
            timeframe=args.timeframe,
            rsi_period=args.rsi_period,
            rsi_oversold=args.rsi_low,
            rsi_overbought=args.rsi_high,
            volume_threshold_ratio=args.vol_ratio,
            strategy=args.strategy,
            only_filtered=not args.all,
            with_ollama=args.with_ollama,
            ollama_model=args.model,
            use_local_json=args.use_local_json,
            data_dir=args.data_dir,
            periods=periods_list,
            start_period=args.start_period if args.start_period else None,
            end_period=args.end_period if args.end_period else None,
            donchian_period=args.donchian_period,
            cmf_period=args.cmf_period,
            cmf_threshold=args.cmf_threshold,
            vwap_deviation_pct=args.vwap_deviation_pct,
            chop_threshold=args.chop_threshold,
            supertrend_period=args.supertrend_period,
            supertrend_multiplier=args.supertrend_multiplier,
            stoch_rsi_period=args.stoch_rsi_period,
            bb_period=args.bb_period,
            bb_std_dev=args.bb_std_dev,
            kc_atr_period=args.kc_atr_period,
            kc_atr_mult=args.kc_atr_mult,
            orderflow_lookback=args.orderflow_lookback,
            funding_threshold=args.funding_threshold,
            ichimoku_tenkan=args.ichimoku_tenkan,
            ichimoku_kijun=args.ichimoku_kijun,
            ichimoku_senkou_b=args.ichimoku_senkou_b,
            pivot_vol_period=args.pivot_vol_period,
            crt_lookback=args.crt_lookback,
            crt_range_lookback=args.crt_range_lookback,
            crt_min_range_pct=args.crt_min_range_pct,
            crt_sweep_confirmation_bars=args.crt_sweep_confirmation_bars,
        )

        results = scan_result["results"]
        errors = scan_result["errors"]

        if args.json:
            output = {
                "results": [r.to_dict() for r in results],
                "errors": errors,
                "total_scanned": scan_result["total_scanned"],
                "total_ok": scan_result["total_ok"],
                "total_failed": scan_result["total_failed"]
            }
            print(json.dumps(output, indent=2, ensure_ascii=False))
        else:
            print(f"\n🔍 [SCANNER FUTURES] Encontrados {len(results)} contratos com alertas de mercado:")
            if errors:
                print(f"⚠️  {len(errors)} símbolo(s) falharam na atualização:")
                for e in errors:
                    print(f"   ❌ {e['symbol']}: {e['error']}")
            print()
            for r in results:
                spike_str = "🔥 PICO DE VOLUME" if r.is_volume_spike else "Normal"
                print(f"📌 {r.symbol} | Preço: ${r.price} | RSI: {r.rsi} | Vol Spike: {spike_str} ({r.volume_ratio_pct}%)")
                print(f"   Sinal: {r.signal} | Suportes: {r.support_levels} | Resistências: {r.resistance_levels}")
                print(f"   Zona de Entrada [{r.entry_zone.get('type')}]: ${r.entry_zone.get('low')} -> ${r.entry_zone.get('high')}")
                if r.recommendation:
                    print(f"   🤖 Ollama Recomendação: {r.recommendation.acao} (Confiança {r.recommendation.confianca}%) - {r.recommendation.justificativa}")
                print("-" * 75)

    elif args.command == "backtest":
        periods_list = [p.strip() for p in args.periods.split(",") if p.strip()] if args.periods else None
        bt = Backtester()
        res = bt.run_backtest(
            symbol=args.symbol,
            timeframe=args.timeframe,
            initial_capital=args.capital,
            strategy=args.strategy,
            rsi_period=args.rsi_period,
            rsi_oversold=args.rsi_low,
            rsi_overbought=args.rsi_high,
            volume_threshold_ratio=args.vol_ratio,
            donchian_period=args.donchian_period,
            cmf_period=args.cmf_period,
            cmf_threshold=args.cmf_threshold,
            ema_filter_period=args.ema_filter,
            use_atr_stop=args.use_atr_stop,
            atr_period=args.atr_period,
            atr_multiplier=args.atr_multiplier,
            use_trailing_stop=args.use_trailing_stop,
            trailing_activation_pct=args.trailing_activation_pct,
            trailing_distance_pct=args.trailing_distance_pct,
            trailing_type=args.trailing_type,
            trailing_atr_mult=args.trailing_atr_mult,
            stop_loss_pct=args.sl,
            take_profit_pct=args.tp,
            vwap_deviation_pct=args.vwap_deviation_pct,
            chop_threshold=args.chop_threshold,
            supertrend_period=args.supertrend_period,
            supertrend_multiplier=args.supertrend_multiplier,
            stoch_rsi_period=args.stoch_rsi_period,
            bb_period=args.bb_period,
            bb_std_dev=args.bb_std_dev,
            kc_atr_period=args.kc_atr_period,
            kc_atr_mult=args.kc_atr_mult,
            orderflow_lookback=args.orderflow_lookback,
            funding_threshold=args.funding_threshold,
            ichimoku_tenkan=args.ichimoku_tenkan,
            ichimoku_kijun=args.ichimoku_kijun,
            ichimoku_senkou_b=args.ichimoku_senkou_b,
            pivot_vol_period=args.pivot_vol_period,
            pivot_exit_pct=args.pivot_exit_pct,
            crt_lookback=args.crt_lookback,
            crt_range_lookback=args.crt_range_lookback,
            crt_min_range_pct=args.crt_min_range_pct,
            crt_sweep_confirmation_bars=args.crt_sweep_confirmation_bars,
            leverage=args.leverage,
            margin_type=args.margin_type,
            position_sizing_type=args.position_sizing_type,
            position_size_value=args.position_size_value,
            limit=args.limit,
            use_local_json=args.use_local_json,
            data_dir=args.data_dir,
            periods=periods_list,
            start_period=args.start_period if args.start_period else None,
            end_period=args.end_period if args.end_period else None
        )

        if args.json:
            print(json.dumps(res.to_dict(), indent=2, ensure_ascii=False))
        else:
            print(f"\n📊 [BACKTEST SIMULADO] Símbolo: {res.symbol} ({res.timeframe}) | Estratégia: {res.parameters.get('strategy', 'rsi_volume')}")
            print(f"   Alavancagem: {res.parameters.get('leverage')}x | Margem: {res.parameters.get('margin_type')} | Sizing: {res.parameters.get('position_sizing_type')} ({res.parameters.get('position_size_value')})")
            print(f"   Capital Inicial: ${res.initial_capital} | Capital Final: ${res.final_capital}")
            print(f"   P&L Total: ${res.total_pnl} ({res.total_pnl_pct}%) | Win Rate: {res.win_rate_pct}%")
            print(f"   Trades Executados: {res.total_trades} (Vitoriosos: {res.winning_trades}, Derrotas: {res.losing_trades})")
            print(f"   Max Drawdown: {res.max_drawdown_pct}% | Fator de Lucro: {res.profit_factor} | Sharpe: {res.sharpe_ratio}")
            print(f"\n⚠️  {res.disclaimer}\n")

    elif args.command == "optimize":
        periods_list = [p.strip() for p in args.periods.split(",") if p.strip()] if args.periods else None
        symbols_list = [s.strip() for s in args.symbols.split(",") if s.strip()] if args.symbols else [args.symbol]
        
        crt_lookbacks = args.crt_lookback if args.crt_lookback else None
        crt_range_lookbacks = args.crt_range_lookback if args.crt_range_lookback else None
        crt_min_range_pcts = args.crt_min_range_pct if args.crt_min_range_pct else None
        crt_confirmation_bars = args.crt_sweep_confirmation_bars if args.crt_sweep_confirmation_bars else None
        
        opt = StrategyOptimizer()
        res = opt.optimize(
            symbols=symbols_list,
            timeframe=args.timeframe,
            initial_capital=args.capital,
            strategy=args.strategy,
            all_strategies=args.all_strategies,
            use_trailing_stop=args.use_trailing_stop,
            trailing_activation_pct=args.trailing_activation_pct,
            trailing_distance_pct=args.trailing_distance_pct,
            trailing_type=args.trailing_type,
            trailing_atr_mult=args.trailing_atr_mult,
            leverage=args.leverage,
            margin_type=args.margin_type,
            position_sizing_type=args.position_sizing_type,
            position_size_value=args.position_size_value,
            ranking_metric=args.metric,
            top_n=args.top_n,
            candle_limit=args.limit,
            use_local_json=args.use_local_json,
            data_dir=args.data_dir,
            periods=periods_list,
            start_period=args.start_period if args.start_period else None,
            end_period=args.end_period if args.end_period else None,
            crt_lookbacks=crt_lookbacks,
            crt_range_lookbacks=crt_range_lookbacks,
            crt_min_range_pcts=crt_min_range_pcts,
            crt_sweep_confirmation_bars_list=crt_confirmation_bars,
        )

        if args.json:
            print(json.dumps(res.to_dict(), indent=2, ensure_ascii=False))
        else:
            print(f"\n⚡ [OTIMIZADOR GRID SEARCH] Símbolo: {res.symbol} | Combinações Testadas: {res.tested_combinations}")
            print(f"   Métrica de Ranking: {res.ranking_metric}\n")
            for idx, item in enumerate(res.top_strategies, 1):
                p = item["params"]
                print(f"#{idx} P&L: {item['total_pnl_pct']}% | WinRate: {item['win_rate_pct']}% | Sharpe: {item['sharpe_ratio']} | Trades: {item['total_trades']}")
                strat = p.get('strategy', 'unknown')
                sl = p.get('stop_loss_pct', 'N/A')
                tp = p.get('take_profit_pct', 'N/A')
                print(f"    Estrategia: {strat} | SL: {sl}% | TP: {tp}%")
                print("-" * 65)

    elif args.command == "trade":
        om = OrderManager()

        if args.close_id:
            st = om.close_paper_position(args.close_id)
            if args.json:
                print(json.dumps(st, indent=2, ensure_ascii=False))
            else:
                print(f"✅ Posição '{args.close_id}' fechada com sucesso.")
            return

        if args.set_max_trades is not None:
            st = om.set_max_simultaneous_trades(args.set_max_trades)
            if args.json:
                print(json.dumps(st, indent=2, ensure_ascii=False))
            else:
                print(f"✅ Limite de trades simultâneos alterado para {args.set_max_trades}.")
            return

        if args.reset_paper:
            st = om.reset_paper_balance()
            if args.json:
                print(json.dumps(st, indent=2, ensure_ascii=False))
            else:
                print(f"✅ Saldo paper resetado com sucesso para ${st['balance']} USDT.")
            return

        # if args.status:
        #     st = om.get_paper_balance()
        #     if args.json:
        #         print(json.dumps(st, indent=2, ensure_ascii=False))
        #     else:
        #         print(f"\n💼 [ESTADO CARTEIRA PAPER] Saldo Atual: ${st['balance']:.2f} USDT | Equity: ${st['equity']:.2f} USDT")
        #         print(f"   PnL USDT: ${st['pnl_usdt']:.2f} ({st['pnl_pct']:.2f}%) | Max Simultâneos: {st['max_simultaneous_trades']}")
        #         print(f"   Posições Abertas: {len(st['positions'])} | Posições Fechadas: {len(st['closed_positions'])}")
        #     return

        # is_live_execution = args.live or IS_LIVE
        # if is_live_execution:
        #     print("\n🚨 ATENÇÃO: MODO REAL (LIVE) SELECIONADO!")
        #     order = om.execute_live_order(
        #         symbol=args.symbol,
        #         side=args.side.upper(),
        #         quantity=args.qty,
        #         price=args.price,
        #         sl_price=args.sl,
        #         tp_price=args.tp,
        #         leverage=args.leverage,
        #         margin_type=args.margin_type,
        #         position_sizing_type=args.position_sizing_type,
        #         position_size_value=args.position_size_value,
        #         notes="Ordem executada via CLI live"
        #     )
        # else:
        #     order = om.execute_paper_order(
        #         symbol=args.symbol,
        #         side=args.side.upper(),
        #         quantity=args.qty,
        #         price=args.price,
        #         sl_price=args.sl,
        #         tp_price=args.tp,
        #         leverage=args.leverage,
        #         margin_type=args.margin_type,
        #         position_sizing_type=args.position_sizing_type,
        #         position_size_value=args.position_size_value,
        #         notes="Ordem simulada em modo Paper Trading"
        #     )

        if args.status:
                    is_live_execution = args.live or IS_LIVE
                    if is_live_execution:
                        st = om.get_live_wallet_balance()
                        if args.json:
                            print(json.dumps(st, indent=2, ensure_ascii=False))
                        else:
                            print(f"\n💰 [CARTEIRA REAL - BINANCE FUTURES] Saldo Disponível: ${st['available_balance']:.2f} {st['asset']}")
                    else:
                        st = om.get_paper_balance()
                        if args.json:
                            print(json.dumps(st, indent=2, ensure_ascii=False))
                        else:
                            print(f"\n💼 [ESTADO CARTEIRA PAPER] Saldo Atual: ${st['balance']:.2f} USDT | Equity: ${st['equity']:.2f} USDT")
                            print(f"   PnL USDT: ${st['pnl_usdt']:.2f} ({st['pnl_pct']:.2f}%) | Max Simultâneos: {st['max_simultaneous_trades']}")
                            print(f"   Posições Abertas: {len(st['positions'])} | Posições Fechadas: {len(st['closed_positions'])}")
                    return

        is_live_execution = args.live or IS_LIVE
        try:
            if is_live_execution:
                        print("\n🚨 ATENÇÃO: MODO REAL (LIVE) SELECIONADO!")
                        order = om.execute_live_order(
                            symbol=args.symbol,
                            side=args.side.upper(),
                            quantity=args.qty,
                            price=args.price,
                            sl_price=args.sl,
                            tp_price=args.tp,
                            leverage=args.leverage,
                            margin_type=args.margin_type,
                            position_sizing_type=args.position_sizing_type,
                            position_size_value=args.position_size_value,
                            notes="Ordem executada via CLI live",
                            force_confirmed=args.confirmed,
                            origin=args.origin
                        )
            else:
                        order = om.execute_paper_order(
                            symbol=args.symbol,
                            side=args.side.upper(),
                            quantity=args.qty,
                            price=args.price,
                            sl_price=args.sl,
                            tp_price=args.tp,
                            leverage=args.leverage,
                            margin_type=args.margin_type,
                            position_sizing_type=args.position_sizing_type,
                            position_size_value=args.position_size_value,
                            notes="Ordem simulada em modo Paper Trading",
                            origin=args.origin
                        )
        except Exception as e:
            if args.json:
                print(json.dumps({"error": str(e)}, indent=2, ensure_ascii=False))
            else:
                print(f"\n❌ ERRO AO EXECUTAR ORDEM: {e}")
            return

        if args.json:
            print(json.dumps(order.to_dict(), indent=2, ensure_ascii=False))
        else:
            print(f"\n✅ Ordem Executada com Sucesso [{order.mode}]!")
            print(f"   ID Ordem: {order.order_id} | Símbolo: {order.symbol} | Lado: {order.side} | Qtd: {order.quantity}")
            print(f"   Preço Executado: ${order.price} | Status: {order.status}")

    elif args.command == "generate-indicator":
        gen = PineGenerator()
        pine_code = gen.generate_from_prompt(
            user_prompt=args.prompt,
            model_override=args.model,
            save_path=args.output
        )

        if args.json:
            print(json.dumps({"prompt": args.prompt, "output_file": args.output, "pine_code": pine_code}, indent=2, ensure_ascii=False))
        else:
            print(f"\n📜 [GERADOR PINE SCRIPT V5] Salvo em '{args.output}':\n")
            print(pine_code[:500] + ("\n... [Código truncado na visualização CLI]" if len(pine_code) > 500 else ""))

if __name__ == "__main__":
    main()
