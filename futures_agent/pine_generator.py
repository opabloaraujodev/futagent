import json
import urllib.request
from pathlib import Path
from typing import Optional
from futures_agent.config import OLLAMA_HOST, DEFAULT_OLLAMA_MODEL
from futures_agent.ollama_advisor import OllamaAdvisor

class PineGenerator:
    def __init__(self, advisor: Optional[OllamaAdvisor] = None):
        self.advisor = advisor or OllamaAdvisor()

    def generate_builtin_pine(
        self,
        strategy_name: str = "Agente RSI Volume Spike",
        rsi_period: int = 14,
        rsi_oversold: float = 30.0,
        rsi_overbought: float = 70.0,
        vol_multiplier: float = 2.0,
        sl_pct: float = 1.5,
        tp_pct: float = 3.0
    ) -> str:
        """Gera código Pine Script v5 sintaticamente válido baseado na estratégia do agente"""
        pine_code = f"""//@version=5
strategy("{strategy_name}", overlay=true, initial_capital=10000, default_qty_type=strategy.percent_of_equity, default_qty_value=10)

// --- Parâmetros ---
rsiPeriod   = input.int({rsi_period}, title="Período do RSI", minval=1)
rsiOversold = input.float({rsi_oversold}, title="Nível de Sobrevenda RSI")
rsiOverbought = input.float({rsi_overbought}, title="Nível de Sobrecompra RSI")
volMult     = input.float({vol_multiplier}, title="Multiplicador do Volume Spike", minval=1.0)
slPct       = input.float({sl_pct}, title="Stop Loss (%)", minval=0.1) / 100.0
tpPct       = input.float({tp_pct}, title="Take Profit (%)", minval=0.1) / 100.0

// --- Indicadores ---
rsiVal  = ta.rsi(close, rsiPeriod)
volAvg  = ta.sma(volume, 20)
isVolSpike = volume >= (volAvg * volMult)

// Suporte e Resistência por Pivôs
supPivot = ta.pivotlow(low, 2, 2)
resPivot = ta.pivothigh(high, 2, 2)

var float lastSup = na
var float lastRes = na

if not na(supPivot)
    lastSup := supPivot
if not na(resPivot)
    lastRes := resPivot

// --- Condições de Entrada ---
longCondition  = (rsiVal <= rsiOversold) and isVolSpike
shortCondition = (rsiVal >= rsiOverbought) and isVolSpike

// --- Execução de Ordens ---
if (longCondition)
    longSL = close * (1.0 - slPct)
    longTP = close * (1.0 + tpPct)
    strategy.entry("Long", strategy.long)
    strategy.exit("Exit Long", "Long", stop=longSL, limit=longTP)

if (shortCondition)
    shortSL = close * (1.0 + slPct)
    shortTP = close * (1.0 - tpPct)
    strategy.entry("Short", strategy.short)
    strategy.exit("Exit Short", "Short", stop=shortSL, limit=shortTP)

// --- Visualização no Gráfico ---
plotshape(longCondition, title="Sinal de Compra", location=location.belowbar, color=color.green, style=shape.triangleup, size=size.small)
plotshape(shortCondition, title="Sinal de Venda", location=location.abovebar, color=color.red, style=shape.triangledown, size=size.small)
plot(lastSup, title="Suporte Recente", color=color.new(color.green, 30), style=plot.style_linebr)
plot(lastRes, title="Resistência Recente", color=color.new(color.red, 30), style=plot.style_linebr)
"""
        return pine_code

    def generate_from_prompt(self, user_prompt: str, model_override: str = "", save_path: Optional[str] = None) -> str:
        """Usa o Ollama para gerar código Pine Script v5 baseado em linguagem natural"""
        if not self.advisor.is_available():
            pine_code = self.generate_builtin_pine(strategy_name="Estratégia Gerada")
        else:
            prompt = f"""Você é um programador especialista em TradingView Pine Script v5.
Escreva um indicador ou estratégia completo em Pine Script v5 para a seguinte solicitação:

{user_prompt}

REGRAS RÍGIDAS:
1. Deve ser Pine Script v5 estritamente válido (//@version=5).
2. Inclua comentários explicativos.
3. Não coloque nenhum texto em linguagem natural antes ou depois do código, apenas o código Pine.
4. Use ```pine ou ``` no bloco de código se necessário.
"""
            try:
                payload = {
                    "model": model_override or self.advisor.model,
                    "prompt": prompt,
                    "stream": False
                }
                req_data = json.dumps(payload).encode("utf-8")
                req = urllib.request.Request(
                    f"{self.advisor.host}/api/generate",
                    data=req_data,
                    headers={"Content-Type": "application/json"},
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=20) as resp:
                    res_data = json.loads(resp.read().decode("utf-8"))
                    raw = res_data.get("response", "")
                    
                    cleaned = raw.strip()
                    if "```pine" in cleaned:
                        cleaned = cleaned.split("```pine")[1].split("```")[0].strip()
                    elif "```" in cleaned:
                        cleaned = cleaned.split("```")[1].split("```")[0].strip()
                    pine_code = cleaned
            except Exception:
                pine_code = self.generate_builtin_pine(strategy_name="Estratégia Gerada (Fallback)")

        if save_path:
            p = Path(save_path)
            p.parent.mkdir(parents=True, exist_ok=True)
            with open(p, "w", encoding="utf-8") as f:
                f.write(pine_code)

        return pine_code
