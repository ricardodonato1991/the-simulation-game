// Central configuration for ECHO. Override anything via environment variables.

export const config = {
  port: Number(process.env.ECHO_PORT ?? 3001),

  // The human ECHO answers to.
  operator: process.env.ECHO_OPERATOR ?? "Ricardo Donato",

  // Local Ollama endpoint. Default is the standard local install.
  ollamaUrl: process.env.OLLAMA_URL ?? "http://127.0.0.1:11434",

  // Uncensored local model. dolphin-mistral is shown in the original design.
  model: process.env.ECHO_MODEL ?? "dolphin-mistral",

  // How often the autonomous "thinking / learning" loop ticks (ms).
  thinkIntervalMs: Number(process.env.ECHO_THINK_INTERVAL ?? 9000),

  // How often live system metrics are pushed (ms).
  metricsIntervalMs: 1500,

  // How often node availability (Ollama etc.) is re-checked (ms).
  healthIntervalMs: 8000,

  // Caps so the feed and persisted memory don't grow without bound in the UI.
  maxCommsInMemory: 200,
  maxAgentCommsInMemory: 200,
  maxLearningsInMemory: 500,
};
