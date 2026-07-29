import json
import urllib.request
import urllib.parse
from typing import List, Dict, Any, Optional
from futures_agent.config import OLLAMA_HOST, DEFAULT_OLLAMA_MODEL
from futures_agent.models import Recommendation

class OllamaAdvisor:
    def __init__(self, host: str = "", model: str = ""):
        self.host = (host or OLLAMA_HOST).rstrip('/')
        self.model = model or DEFAULT_OLLAMA_MODEL

    def is_available(self) -> bool:
        """Verifica se o serviço Ollama local está ativo"""
        try:
            req = urllib.request.Request(f"{self.host}/api/tags", method="GET")
            with urllib.request.urlopen(req, timeout=3) as resp:
                return resp.status == 200
        except Exception:
            return False

    def list_local_models(self) -> List[str]:
        """Lista os modelos Ollama instalados localmente"""
        try:
            req = urllib.request.Request(f"{self.host}/api/tags", method="GET")
            with urllib.request.urlopen(req, timeout=3) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                models = [m.get("name", "").split(":")[0] for m in data.get("models", [])]
                return sorted(list(set(models)))
        except Exception:
            return []

    def get_fallback_recommendation(self, scan_data: Dict[str, Any]) -> Recommendation:
        """Gera recomendação determinística por regras técnicas quando Ollama estiver indisponível"""
        rsi = scan_data.get("rsi", 50.0)
        price = scan_data.get("price", 100.0)
        is_spike = scan_data.get("is_volume_spike", False)
        supports = scan_data.get("support_levels", [price * 0.97])
        resistances = scan_data.get("resistance_levels", [price * 1.03])

        sup = supports[0] if supports else price * 0.97
        res = resistances[0] if resistances else price * 1.03

        if rsi <= 30 and is_spike:
            stop_price = round(sup * 0.99, 4)
            tp_price = round(price + (price - stop_price) * 2.0, 4)
            return Recommendation(
                acao="COMPRA",
                preco_entrada=round(price, 4),
                stop=stop_price,
                alvo=tp_price,
                confianca=85,
                justificativa=f"Sobrevenda forte (RSI {rsi:.1f}) acompanhada de pico de volume. Entrada LONG ideal no suporte {sup}."
            )
        elif rsi >= 70 and is_spike:
            stop_price = round(res * 1.01, 4)
            tp_price = round(price - (stop_price - price) * 2.0, 4)
            return Recommendation(
                acao="VENDA",
                preco_entrada=round(price, 4),
                stop=stop_price,
                alvo=tp_price,
                confianca=85,
                justificativa=f"Sobrecompra acentuada (RSI {rsi:.1f}) com surto de volume. Oportunidade SHORT próxima à resistência {res}."
            )
        elif rsi < 35:
            stop_price = round(sup * 0.985, 4)
            tp_price = round(price + (price - stop_price) * 1.5, 4)
            return Recommendation(
                acao="COMPRA",
                preco_entrada=round(price, 4),
                stop=stop_price,
                alvo=tp_price,
                confianca=65,
                justificativa=f"RSI em zona de sobrevenda ({rsi:.1f}). Alerta moderado de compra."
            )
        elif rsi > 65:
            stop_price = round(res * 1.015, 4)
            tp_price = round(price - (stop_price - price) * 1.5, 4)
            return Recommendation(
                acao="VENDA",
                preco_entrada=round(price, 4),
                stop=stop_price,
                alvo=tp_price,
                confianca=65,
                justificativa=f"RSI em zona de sobrecompra ({rsi:.1f}). Alerta moderado de venda."
            )
        else:
            return Recommendation(
                acao="AGUARDAR",
                preco_entrada=round(price, 4),
                stop=round(price * 0.95, 4),
                alvo=round(price * 1.05, 4),
                confianca=50,
                justificativa=f"Mercado neutro (RSI {rsi:.1f}). Aguardar rompimento de nível de suporte ({sup}) ou resistência ({res})."
            )

    def analyze(self, scan_data: Dict[str, Any], model_override: str = "") -> Recommendation:
        """Envia os dados do contrato para o modelo Ollama e retorna a recomendação estruturada em JSON"""
        target_model = model_override or self.model

        if not self.is_available():
            rec = self.get_fallback_recommendation(scan_data)
            rec.justificativa += " [Nota: Ollama local offline - usando motor de regras técnicas]"
            return rec

        prompt = f"""Você é um analista especialista em criptomoedas e contratos futuros na Binance Futures.
Analise os seguintes indicadores do contrato e forneça uma recomendação técnica em JSON EXATO.

DADOS TÉCNICOS:
{json.dumps(scan_data, indent=2, ensure_ascii=False)}

REGRAS OBRIGATÓRIAS:
1. Retorne APENAS um JSON válido. Sem texto antes ou depois, sem explicações em markdown fora do JSON.
2. O formato JSON DEVE conter estritamente as chaves:
   "acao": "COMPRA" ou "VENDA" ou "AGUARDAR",
   "preco_entrada": número flutuante,
   "stop": número flutuante para Stop Loss,
   "alvo": número flutuante para Take Profit (Risco/Retorno mínimo 1:1.5),
   "confianca": inteiro de 0 a 100,
   "justificativa": string explicativa clara em português.
"""

        payload = {
            "model": target_model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.2
            }
        }

        try:
            req_data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                f"{self.host}/api/generate",
                data=req_data,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                res_data = json.loads(resp.read().decode("utf-8"))
                raw_response = res_data.get("response", "")

                # Extração defensiva de JSON do texto gerado pelo Ollama
                cleaned_json = raw_response.strip()
                if "```json" in cleaned_json:
                    cleaned_json = cleaned_json.split("```json")[1].split("```")[0].strip()
                elif "```" in cleaned_json:
                    cleaned_json = cleaned_json.split("```")[1].split("```")[0].strip()

                start_idx = cleaned_json.find("{")
                end_idx = cleaned_json.rfind("}")
                if start_idx != -1 and end_idx != -1:
                    cleaned_json = cleaned_json[start_idx:end_idx + 1]

                parsed = json.loads(cleaned_json)
                return Recommendation(
                    acao=str(parsed.get("acao", "AGUARDAR")).upper(),
                    preco_entrada=float(parsed.get("preco_entrada", scan_data.get("price", 0.0))),
                    stop=float(parsed.get("stop", scan_data.get("price", 0.0) * 0.95)),
                    alvo=float(parsed.get("alvo", scan_data.get("price", 0.0) * 1.05)),
                    confianca=int(parsed.get("confianca", 50)),
                    justificativa=str(parsed.get("justificativa", "Análise gerada pelo modelo Ollama."))
                )
        except urllib.error.HTTPError as http_err:
            rec = self.get_fallback_recommendation(scan_data)
            if http_err.code == 404:
                installed_models = self.list_local_models()
                installed_str = ", ".join(installed_models) if installed_models else "Nenhum modelo baixado"
                rec.justificativa += f" [Nota: O modelo '{target_model}' não está instalado no Ollama local (HTTP 404). Execute 'ollama pull {target_model}' ou escolha um modelo disponível: {installed_str}. Análise realizada via motor de regras técnicas.]"
            else:
                rec.justificativa += f" [Nota: Erro de comunicação Ollama (HTTP {http_err.code}) - usando motor de regras técnicas]"
            return rec
        except Exception as e:
            rec = self.get_fallback_recommendation(scan_data)
            rec.justificativa += f" [Nota: Falha no Ollama ({str(e)}) - usando motor de regras técnicas]"
            return rec
