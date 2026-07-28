import os
from pathlib import Path

# Load .env file manually if exists
def load_dotenv_file(env_path: Path):
    if env_path.is_file():
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k not in os.environ:
                            os.environ[k] = v
        except Exception:
            pass

# Look for .env in current workspace or module parent
BASE_DIR = Path(__file__).resolve().parent
WORKSPACE_DIR = BASE_DIR.parent

load_dotenv_file(WORKSPACE_DIR / ".env")
load_dotenv_file(BASE_DIR / ".env")

# Binance API settings
BINANCE_API_KEY = os.getenv("BINANCE_API_KEY", "")
BINANCE_SECRET_KEY = os.getenv("BINANCE_SECRET_KEY", "")
BINANCE_FUTURES_URL = "https://fapi.binance.com"

# Trading settings
# TRADING_MODE is 'paper' by default for safety. Live requires explicit 'live'
TRADING_MODE = os.getenv("TRADING_MODE", "paper").lower()
IS_LIVE = TRADING_MODE == "live"

# Ollama settings
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
DEFAULT_OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")

# Default Strategy Parameters
DEFAULT_SYMBOLS = [
    "BTCUSDT",
    "ETHUSDT",
    "SOLUSDT",
    "BNBUSDT",
    "DOGEUSDT",
    "XRPUSDT",
    "ADAUSDT",
    "AVAXUSDT"
]

DEFAULT_RSI_PERIOD = int(os.getenv("DEFAULT_RSI_PERIOD", "14"))
DEFAULT_RSI_OVERSOLD = float(os.getenv("DEFAULT_RSI_OVERSOLD", "30.0"))
DEFAULT_RSI_OVERBOUGHT = float(os.getenv("DEFAULT_RSI_OVERBOUGHT", "70.0"))
DEFAULT_VOLUME_RATIO = float(os.getenv("DEFAULT_VOLUME_RATIO", "2.0"))  # 200% of SMA
DEFAULT_TIMEFRAME = os.getenv("DEFAULT_TIMEFRAME", "15m")

# Logs Directory
LOGS_DIR = BASE_DIR / "logs"
LOGS_DIR.mkdir(parents=True, exist_ok=True)
PAPER_ORDERS_FILE = LOGS_DIR / "paper_orders.json"
PAPER_STATE_FILE = LOGS_DIR / "paper_state.json"
LIVE_ORDERS_FILE = LOGS_DIR / "live_orders.json"
