# Agente de Trading Binance Futures & Ollama Local

Este projeto é um sistema completo de trading quantitativo e análise determinística para **Binance Futures**, integrado opcionalmente a modelos **Ollama LLM locais** (Llama 3, Mistral, Qwen, DeepSeek, etc.) e gerador de **Pine Script v5** para TradingView.

O sistema opera de forma **100% desacoplada**: a lógica de trading é puramente matemática e determinística (RSI, Volume Relativo, ATR, SL/TP), enquanto a inteligência do LLM atua como uma camada consultiva e explicativa sem alucinar números.

---

## 🛠️ Requisitos no Seu Computador

- **Python 3.10+** (para o motor de análise e CLI)
- **Node.js 18+** ou **Bun** (para a interface web React + Vite)
- **Ollama** (Opcional, para análise textual LLM local)

---

## 🚀 Como Rodar o Projeto na Sua Máquina

### Opção 1: Executar Apenas o Motor Python (CLI / Terminal)

1. Clone ou extraia os arquivos na sua pasta local.
2. Acesse a pasta do projeto no terminal:
   ```bash
   cd binance_futures_agent
   ```
3. Instale as dependências Python:
   
   *Opção A (Recomendado - Virtual Environment):*
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate  # No Windows: .venv\Scripts\activate
   pip install -r futures_agent/requirements.txt
   ```

   *Opção B (Direto no sistema):*
   ```bash
   pip install -r futures_agent/requirements.txt --break-system-packages
   ```
4. Configure as variáveis de ambiente (copie `.env.example` para `.env`):
   ```bash
   cp .env.example .env
   ```
   *(Edite `.env` com suas chaves da Binance se for operar em conta real. Para simulação e scanner não precisa de chaves).*

5. Execute qualquer subcomando via CLI:
   - **Scanner de Mercado:**
     ```bash
     python3 -m futures_agent.main scan --symbols "BTCUSDT,ETHUSDT,SOLUSDT" --timeframe 15m --all
     ```
   - **Scanner com Análise Local Ollama:**
     ```bash
     python3 -m futures_agent.main scan --symbols "BTCUSDT,ETHUSDT" --with-ollama --model llama3
     ```
   - **Backtest Historico:**
     ```bash
     python3 -m futures_agent.main backtest --symbol BTCUSDT --timeframe 15m --capital 10000 --sl 1.5 --tp 3.0
     ```
   - **Otimizador Grid Search:**
     ```bash
     python3 -m futures_agent.main optimize --symbol BTCUSDT --timeframe 15m --top-n 5
     ```
   - **Gerador de Pine Script v5:**
     ```bash
     python3 -m futures_agent.main generate-indicator --prompt "Estratégia de rompimento com RSI e Volume"
     ```
   - **Paper Trading (Carteira Simulada):**
     ```bash
     python3 -m futures_agent.main trade --symbol BTCUSDT --side BUY --qty 0.01 --sl 65000 --tp 70000
     ```

---

### Opção 2: Executar a Aplicação Web Completa (React + Node + Express + Python)

1. Instale as dependências Node.js:
   ```bash
   npm install
   ```
2. Instale as dependências Python:
   ```bash
   pip install -r futures_agent/requirements.txt
   ```
3. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
4. Abra o seu navegador em `http://localhost:3000`.

---

## 🤖 Configurando o Ollama (Opcional)

1. Baixe e instale o Ollama de [https://ollama.com](https://ollama.com).
2. Baixe o modelo de sua preferência no terminal:
   ```bash
   ollama pull llama3
   ```
3. Certifique-se de que o servidor do Ollama está rodando na porta padrão (`http://localhost:11434`).

---

## 📂 Estrutura de Arquivos do Projeto

```
.
├── futures_agent/              # Módulo Python Principal (Engine Quantitativo)
│   ├── main.py                 # Ponto de entrada CLI (click)
│   ├── scanner.py              # Scanner RSI + Volume
│   ├── backtester.py           # Engine de Backtest com Curva de Capital
│   ├── optimizer.py            # Otimizador Determinístico Grid Search
│   ├── trader.py               # Módulo de Ordens (Paper Trading / Live Binance)
│   ├── indicators.py           # Cálculos Matemáticos (RSI, SMA, Volume, ATR)
│   ├── binance_client.py       # API pública e privada Binance Futures
│   ├── ollama_advisor.py       # Conectador LLM Local Ollama
│   ├── pine_generator.py       # Gerador de código TradingView .pine
│   ├── models.py               # Dataclasses de Validação Pydantic
│   └── requirements.txt        # Dependências Python
├── src/                        # Frontend React + TypeScript + Tailwind CSS
│   ├── components/             # Tabs e Componentes da Interface
│   ├── App.tsx                 # Dashboard Principal
│   └── types.ts                # Definições TypeScript
├── server.ts                   # Servidor Express / Ponte Backend Node <-> Python CLI
├── package.json                # Configuração do Projeto Node.js
└── README.md                   # Instruções de Instalação e Uso
```

---

## ⚡ Licença e Avisos de Risco
Este software é para fins educacionais e quantitativos. Operações com Futuros de Criptomoedas envolvem alto risco financeiro. Teste exaustivamente em Paper Trading antes de utilizar capital real!
