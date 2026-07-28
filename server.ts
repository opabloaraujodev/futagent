import express from "express";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { createServer as createViteServer } from "vite";

const execAsync = promisify(exec);
const app = express();
const PORT = 3000;

app.use(express.json());

// Utility to execute Python futures_agent CLI commands asynchronously
async function runAgentCli(commandArgs: string): Promise<{ stdout: string; stderr: string }> {
  const cmd = `python3 -m futures_agent.main ${commandArgs}`;
  try {
    const { stdout, stderr } = await execAsync(cmd, { cwd: process.cwd() });
    return { stdout, stderr };
  } catch (error: any) {
    return {
      stdout: error.stdout || "",
      stderr: error.stderr || error.message || "Erro de execução da CLI Python",
    };
  }
}

// --- API ENDPOINTS ---

function parseJsonFromStdout(stdout: string): any {
  if (!stdout) return null;
  const trimmed = stdout.trim();
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    // Tenta encontrar fatia de objeto JSON {...}
    const firstObj = trimmed.indexOf('{');
    const lastObj = trimmed.lastIndexOf('}');
    if (firstObj !== -1 && lastObj > firstObj) {
      try {
        return JSON.parse(trimmed.substring(firstObj, lastObj + 1));
      } catch {}
    }
    // Tenta encontrar fatia de array JSON [...]
    const firstArr = trimmed.indexOf('[');
    const lastArr = trimmed.lastIndexOf(']');
    if (firstArr !== -1 && lastArr > firstArr) {
      try {
        return JSON.parse(trimmed.substring(firstArr, lastArr + 1));
      } catch {}
    }
    return null;
  }
}

// 0. GET /api/price
app.get("/api/price", async (req, res) => {
  try {
    const symbol = ((req.query.symbol as string) || "BTCUSDT").toUpperCase();
    const cmd = `python3 -c "from futures_agent.binance_client import BinanceFuturesClient; import json; print(json.dumps({'symbol': '${symbol}', 'price': BinanceFuturesClient().get_current_price('${symbol}')}))"`;
    const { exec } = require("child_process");
    exec(cmd, { cwd: process.cwd() }, (err: any, stdout: string) => {
      if (err) {
        return res.json({ success: false, price: 63800.0, symbol });
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        res.json({ success: true, ...parsed });
      } catch {
        res.json({ success: false, price: 63800.0, symbol });
      }
    });
  } catch (error: any) {
    res.json({ success: false, price: 63800.0, error: error.message });
  }
});

// 1. GET /api/scan
app.get("/api/scan", async (req, res) => {
  try {
    const symbols = (req.query.symbols as string) || "BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,DOGEUSDT,XRPUSDT";
    const timeframe = (req.query.timeframe as string) || "15m";
    const strategy = (req.query.strategy as string) || "rsi_volume";
    const rsiPeriod = req.query.rsi_period || "14";
    const rsiLow = req.query.rsi_low || "30";
    const rsiHigh = req.query.rsi_high || "70";
    const volRatio = req.query.vol_ratio || "2.0";
    const donchianPeriod = req.query.donchian_period || "20";
    const cmfPeriod = req.query.cmf_period || "20";
    const cmfThreshold = req.query.cmf_threshold || "0.05";
    const emaFast = req.query.ema_fast || "9";
    const emaSlow = req.query.ema_slow || "21";
    const bbPeriod = req.query.bb_period || "20";
    const bbStdDev = req.query.bb_std_dev || "2.0";
    const macdFast = req.query.macd_fast || "12";
    const macdSlow = req.query.macd_slow || "26";
    const macdSignal = req.query.macd_signal || "9";
    const supertrendPeriod = req.query.supertrend_period || "10";
    const supertrendMultiplier = req.query.supertrend_multiplier || "3.0";
    const crtLookback = req.query.crt_lookback || "1";
    const showAll = req.query.all === "true" ? "--all" : "";
    const withOllama = req.query.with_ollama === "true" ? "--with-ollama" : "";
    const model = (req.query.model as string) || "llama3";
    const useLocalJson = req.query.use_local_json === "true" ? "--use-local-json" : "";
    const dataDir = (req.query.data_dir as string) || "/mnt/e/datadown/data/monthly/15m";
    const periods = (req.query.periods as string) || "";
    const startPeriod = (req.query.start_period as string) || "";
    const endPeriod = (req.query.end_period as string) || "";

    let cmd = `scan --symbols "${symbols}" --timeframe "${timeframe}" --strategy "${strategy}" --rsi-period ${rsiPeriod} --rsi-low ${rsiLow} --rsi-high ${rsiHigh} --vol-ratio ${volRatio} --donchian-period ${donchianPeriod} --cmf-period ${cmfPeriod} --cmf-threshold ${cmfThreshold} --ema-fast ${emaFast} --ema-slow ${emaSlow} --bb-period ${bbPeriod} --bb-std-dev ${bbStdDev} --macd-fast ${macdFast} --macd-slow ${macdSlow} --macd-signal ${macdSignal} --supertrend-period ${supertrendPeriod} --supertrend-multiplier ${supertrendMultiplier} --crt-lookback ${crtLookback} ${showAll} ${withOllama} --model "${model}"`;
    if (useLocalJson) {
      cmd += ` ${useLocalJson} --data-dir "${dataDir}"`;
      if (periods) cmd += ` --periods "${periods}"`;
      if (startPeriod) cmd += ` --start-period "${startPeriod}"`;
      if (endPeriod) cmd += ` --end-period "${endPeriod}"`;
    }
    cmd += " --json";

    const { stdout } = await runAgentCli(cmd);
    
    const parsed = parseJsonFromStdout(stdout);
    const dataList = Array.isArray(parsed) ? parsed : [];
    res.json({ success: true, count: dataList.length, data: dataList });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. POST /api/backtest
app.post("/api/backtest", async (req, res) => {
  try {
    const {
      symbol = "BTCUSDT",
      timeframe = "15m",
      strategy = "rsi_volume",
      capital = 10000,
      rsi_period = 14,
      rsi_low = 30,
      rsi_high = 70,
      vol_ratio = 2.0,
      donchian_period = 20,
      cmf_period = 20,
      cmf_threshold = 0.05,
      ema_filter = 0,
      ema_fast = 9,
      ema_slow = 21,
      bb_period = 20,
      bb_std_dev = 2.0,
      macd_fast = 12,
      macd_slow = 26,
      macd_signal = 9,
      supertrend_period = 10,
      supertrend_multiplier = 3.0,
      crt_lookback = 1,
      use_atr_stop = false,
      atr_period = 14,
      atr_multiplier = 2.0,
      use_trailing_stop = false,
      trailing_activation_pct = 1.0,
      trailing_distance_pct = 1.0,
      trailing_type = "PERCENT",
      trailing_atr_mult = 2.0,
      sl = 1.5,
      tp = 3.0,
      leverage = 10,
      margin_type = "ISOLATED",
      position_sizing_type = "PERCENT",
      position_size_value = 10.0,
      limit = 500,
      use_local_json = false,
      data_dir = "/mnt/e/datadown/data/monthly/15m",
      periods = "",
      start_period = "",
      end_period = "",
    } = req.body;

    let cmd = `backtest --symbol "${symbol}" --timeframe "${timeframe}" --strategy "${strategy}" --capital ${capital} --rsi-period ${rsi_period} --rsi-low ${rsi_low} --rsi-high ${rsi_high} --vol-ratio ${vol_ratio} --donchian-period ${donchian_period} --cmf-period ${cmf_period} --cmf-threshold ${cmf_threshold} --ema-filter ${ema_filter} --ema-fast ${ema_fast} --ema-slow ${ema_slow} --bb-period ${bb_period} --bb-std-dev ${bb_std_dev} --macd-fast ${macd_fast} --macd-slow ${macd_slow} --macd-signal ${macd_signal} --supertrend-period ${supertrend_period} --supertrend-multiplier ${supertrend_multiplier} --crt-lookback ${crt_lookback} --atr-period ${atr_period} --atr-multiplier ${atr_multiplier} --sl ${sl} --tp ${tp} --leverage ${leverage} --margin-type "${margin_type}" --position-sizing-type "${position_sizing_type}" --position-size-value ${position_size_value} --limit ${limit}`;
    if (use_atr_stop) {
      cmd += " --use-atr-stop";
    }
    if (use_trailing_stop) {
      cmd += ` --use-trailing-stop --trailing-activation-pct ${trailing_activation_pct} --trailing-distance-pct ${trailing_distance_pct} --trailing-type "${trailing_type}" --trailing-atr-mult ${trailing_atr_mult}`;
    }
    if (use_local_json) {
      cmd += ` --use-local-json --data-dir "${data_dir}"`;
      if (periods) cmd += ` --periods "${periods}"`;
      if (start_period) cmd += ` --start-period "${start_period}"`;
      if (end_period) cmd += ` --end-period "${end_period}"`;
    }
    cmd += " --json";

    const { stdout } = await runAgentCli(cmd);

    const parsed = parseJsonFromStdout(stdout);
    if (!parsed) {
      return res.json({
        success: false,
        error: "Falha ao ler os dados do backtest. Verifique se o diretório de dados locais ou arquivos JSON existem para este par/timeframe.",
        raw: stdout,
      });
    }
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. POST /api/optimize
app.post("/api/optimize", async (req, res) => {
  try {
    const {
      symbol = "BTCUSDT",
      timeframe = "15m",
      strategy = "rsi_volume",
      capital = 10000,
      use_trailing_stop = false,
      trailing_activation_pct = 1.0,
      trailing_distance_pct = 1.0,
      trailing_type = "PERCENT",
      trailing_atr_mult = 2.0,
      leverage = 10,
      margin_type = "ISOLATED",
      position_sizing_type = "PERCENT",
      position_size_value = 10.0,
      metric = "total_pnl_pct",
      top_n = 10,
      limit = 500,
      use_local_json = false,
      data_dir = "/mnt/e/datadown/data/monthly/15m",
      periods = "",
      start_period = "",
      end_period = "",
    } = req.body;

    let cmd = `optimize --symbol "${symbol}" --timeframe "${timeframe}" --strategy "${strategy}" --capital ${capital} --leverage ${leverage} --margin-type "${margin_type}" --position-sizing-type "${position_sizing_type}" --position-size-value ${position_size_value} --metric "${metric}" --top-n ${top_n} --limit ${limit}`;
    if (use_trailing_stop) {
      cmd += ` --use-trailing-stop --trailing-activation-pct ${trailing_activation_pct} --trailing-distance-pct ${trailing_distance_pct} --trailing-type "${trailing_type}" --trailing-atr-mult ${trailing_atr_mult}`;
    }
    if (use_local_json) {
      cmd += ` --use-local-json --data-dir "${data_dir}"`;
      if (periods) cmd += ` --periods "${periods}"`;
      if (start_period) cmd += ` --start-period "${start_period}"`;
      if (end_period) cmd += ` --end-period "${end_period}"`;
    }
    cmd += " --json";

    const { stdout } = await runAgentCli(cmd);

    const parsed = parseJsonFromStdout(stdout);
    if (!parsed) {
      return res.json({
        success: false,
        error: "Falha na leitura dos resultados da otimização. Verifique se existem arquivos JSON locais para este símbolo.",
        raw: stdout,
      });
    }
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. GET /api/trade/status
app.get("/api/trade/status", async (req, res) => {
  try {
    const { stdout } = await runAgentCli("trade --status --json");
    let parsed = {};
    try {
      parsed = JSON.parse(stdout);
    } catch {
      parsed = { balance: 10000, positions: [], history: [] };
    }
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. POST /api/trade/order
app.post("/api/trade/order", async (req, res) => {
  try {
    const {
      symbol = "BTCUSDT",
      side = "BUY",
      quantity = 0.0,
      price = null,
      sl = null,
      tp = null,
      leverage = 10,
      margin_type = "ISOLATED",
      position_sizing_type = "PERCENT",
      position_size_value = null,
      is_live = false,
      confirmed = false,
    } = req.body;

    if (is_live && !confirmed) {
      return res.status(400).json({
        success: false,
        error: "Execução real exige confirmação explícita no sistema (campo confirmed: true).",
      });
    }

    let cmd = `trade --symbol "${symbol}" --side "${side}" --qty ${quantity} --leverage ${leverage} --margin-type "${margin_type}" --position-sizing-type "${position_sizing_type}"`;
    if (price) cmd += ` --price ${price}`;
    if (sl) cmd += ` --sl ${sl}`;
    if (tp) cmd += ` --tp ${tp}`;
    if (position_size_value !== null && position_size_value !== undefined) cmd += ` --position-size-value ${position_size_value}`;
    if (is_live) cmd += " --live";
    cmd += " --json";

    const { stdout, stderr } = await runAgentCli(cmd);

    let parsed = {};
    try {
      parsed = JSON.parse(stdout);
    } catch {
      parsed = { message: stdout || stderr };
    }
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. POST /api/trade/reset
app.post("/api/trade/reset", async (req, res) => {
  try {
    const { stdout } = await runAgentCli("trade --reset-paper --json");
    let parsed = {};
    try { parsed = JSON.parse(stdout); } catch { parsed = { message: stdout }; }
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6b. POST /api/trade/close
app.post("/api/trade/close", async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, error: "ID da posição não fornecido." });
    }
    const { stdout } = await runAgentCli(`trade --close-id "${id}" --json`);
    let parsed = {};
    try { parsed = JSON.parse(stdout); } catch { parsed = { message: stdout }; }
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6c. POST /api/trade/settings
app.post("/api/trade/settings", async (req, res) => {
  try {
    const { max_simultaneous_trades } = req.body;
    if (max_simultaneous_trades !== undefined) {
      const { stdout } = await runAgentCli(`trade --set-max-trades ${max_simultaneous_trades} --json`);
      let parsed = {};
      try { parsed = JSON.parse(stdout); } catch { parsed = { message: stdout }; }
      return res.json({ success: true, data: parsed });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7. POST /api/generate-pine
app.post("/api/generate-pine", async (req, res) => {
  try {
    const { prompt = "Estratégia de cruzamento de RSI e Volume", model = "llama3" } = req.body;
    // Escapar aspas para segurança no shell
    const safePrompt = prompt.replace(/"/g, '\\"');
    const cmd = `generate-indicator --prompt "${safePrompt}" --model "${model}" --json`;
    const { stdout } = await runAgentCli(cmd);

    let parsed = {};
    try {
      parsed = JSON.parse(stdout);
    } catch {
      parsed = { pine_code: stdout };
    }
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8. GET /api/ollama/status
app.get("/api/ollama/status", async (req, res) => {
  try {
    const pyScript = `
import json
from futures_agent.ollama_advisor import OllamaAdvisor
adv = OllamaAdvisor()
avail = adv.is_available()
models = adv.list_local_models() if avail else []
print(json.dumps({"available": avail, "models": models, "host": adv.host, "default_model": adv.model}))
`;
    const { stdout } = await execAsync(`python3 -c '${pyScript}'`);
    const data = JSON.parse(stdout.trim());
    res.json({ success: true, data });
  } catch (error: any) {
    res.json({
      success: true,
      data: { available: false, models: [], host: "http://localhost:11434", default_model: "llama3" },
    });
  }
});

// 9. POST /api/cli/exec
app.post("/api/cli/exec", async (req, res) => {
  try {
    const { args = "scan --symbols BTCUSDT --all" } = req.body;
    // Impedir injeções perigosas no shell
    const safeArgs = args.replace(/[;&|`$]/g, "");
    const { stdout, stderr } = await runAgentCli(safeArgs);
    res.json({ success: true, stdout, stderr });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 10. GET & POST /api/settings
const SETTINGS_FILE = path.join(process.cwd(), "global_settings.json");

app.get("/api/settings", (req, res) => {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const content = fs.readFileSync(SETTINGS_FILE, "utf-8");
      return res.json({ success: true, data: JSON.parse(content) });
    }
    return res.json({ success: true, data: null });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post("/api/settings", (req, res) => {
  try {
    const settings = req.body;
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
    res.json({ success: true, message: "Configurações salvas com sucesso!" });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 11. GET /api/download-zip
app.get("/api/download-zip", async (req, res) => {
  try {
    const zipPath = path.join(process.cwd(), "binance_futures_agent_project.zip");
    await execAsync("python3 futures_agent/make_zip.py");
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="binance_futures_agent_project.zip"');
    res.sendFile(zipPath);
  } catch (error: any) {
    console.error("Erro ao gerar ZIP:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start Express and Vite dev/prod server
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Agente Binance Futures Backend operando na porta ${PORT}`);
  });
}

startServer();
