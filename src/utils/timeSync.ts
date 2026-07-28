// Utilitários de sincronização de tempo para candles e cotações sequenciais

export function parseTimeframeToSeconds(tf: string): number {
  const clean = tf.trim().toLowerCase();
  if (clean.endsWith('m')) {
    const mins = parseInt(clean.replace('m', ''), 10) || 15;
    return mins * 60;
  }
  if (clean.endsWith('h')) {
    const hours = parseInt(clean.replace('h', ''), 10) || 1;
    return hours * 3600;
  }
  if (clean.endsWith('d')) {
    const days = parseInt(clean.replace('d', ''), 10) || 1;
    return days * 86400;
  }
  if (clean.endsWith('s')) {
    const secs = parseInt(clean.replace('s', ''), 10) || 15;
    return secs;
  }
  return 900; // 15m default
}

export interface CandleCountdownInfo {
  secondsRemaining: number;
  minutesRemaining: number;
  hoursRemaining: number;
  formattedTime: string; // Ex: "04m 23s" ou "01h 12m 05s"
  isCandleClose: boolean; // Verdadeiro no segundo exato do fechamento do candle
  percentProgress: number; // Ex: 0% a 100% da vela atual
}

export function getCandleCountdown(timeframe: string, nowMs = Date.now()): CandleCountdownInfo {
  const tfSeconds = parseTimeframeToSeconds(timeframe);
  const tfMs = tfSeconds * 1000;
  
  const currentMs = nowMs;
  const msIntoCandle = currentMs % tfMs;
  const msRemaining = tfMs - msIntoCandle;
  const totalSecondsRemaining = Math.floor(msRemaining / 1000);

  const hours = Math.floor(totalSecondsRemaining / 3600);
  const minutes = Math.floor((totalSecondsRemaining % 3600) / 60);
  const seconds = totalSecondsRemaining % 60;

  let formattedTime = '';
  if (hours > 0) {
    formattedTime = `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  } else {
    formattedTime = `${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  }

  const percentProgress = Math.min(100, Math.max(0, ((tfMs - msRemaining) / tfMs) * 100));

  return {
    secondsRemaining: totalSecondsRemaining,
    minutesRemaining: minutes,
    hoursRemaining: hours,
    formattedTime,
    isCandleClose: totalSecondsRemaining === 0 || totalSecondsRemaining === tfSeconds,
    percentProgress
  };
}

export interface PriceTickSyncInfo {
  secondsToNextTick: number;
  formattedTime: string; // Ex: "12s"
  isTickBoundary: boolean;
  syncPointsText: string; // Ex: ":00, :15, :30, :45"
}

export function getPriceTickSync(intervalSeconds: number, nowMs = Date.now()): PriceTickSyncInfo {
  const validInterval = Math.max(1, intervalSeconds);
  const nowSec = Math.floor(nowMs / 1000);
  const currentSecOfMinute = nowSec % 60;

  // Pontos de corte do minuto (ex: para 15s -> 0, 15, 30, 45)
  const syncPoints: number[] = [];
  for (let p = 0; p < 60; p += validInterval) {
    syncPoints.push(p);
  }

  const secondsIntoInterval = nowSec % validInterval;
  const secondsToNextTick = validInterval - secondsIntoInterval;

  const syncPointsText = syncPoints.map(p => `:${String(p).padStart(2, '0')}`).join(', ');

  return {
    secondsToNextTick,
    formattedTime: `${secondsToNextTick}s`,
    isTickBoundary: secondsIntoInterval === 0,
    syncPointsText
  };
}
