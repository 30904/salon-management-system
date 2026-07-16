const enabled =
  import.meta.env.DEV || import.meta.env.VITE_LATENCY_LOGS === "true";

export function isLatencyLoggingEnabled() {
  return enabled;
}

export function logLatency(scope, message, meta = {}) {
  if (!enabled) {
    return;
  }

  const payload = Object.keys(meta).length > 0 ? meta : undefined;
  console.log(`[Latency][${scope}] ${message}`, payload ?? "");
}

export function startTimer(scope, label) {
  if (!enabled) {
    return () => 0;
  }

  const start = performance.now();
  logLatency(scope, `${label} — started`);

  return (meta = {}) => {
    const durationMs = performance.now() - start;
    logLatency(scope, `${label} — ${durationMs.toFixed(0)}ms`, {
      durationMs: Number(durationMs.toFixed(1)),
      ...meta,
    });
    return durationMs;
  };
}
