// Central configuration for ECHO. Override anything via environment variables.

import os from "node:os";
import path from "node:path";

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

  // --- action layer (ECHO acting on the Mac) ---

  // Root ECHO's file actions are scoped to. Defaults to the home directory.
  workspace: process.env.ECHO_WORKSPACE ? path.resolve(process.env.ECHO_WORKSPACE) : os.homedir(),

  // Whether ECHO may run shell commands. On by default for a private local
  // system; set ECHO_ALLOW_SHELL=0 to lock it down.
  allowShell: process.env.ECHO_ALLOW_SHELL !== "0",

  // Hard caps for action output so a runaway command can't flood the UI.
  maxActionBytes: 16000,
  shellTimeoutMs: Number(process.env.ECHO_SHELL_TIMEOUT ?? 15000),

  // --- image / video generation ---

  // Local Stable Diffusion server (Automatic1111 / Forge API). Uncensored
  // output is governed by whatever model you load there — ECHO adds no filter.
  imageServerUrl: process.env.ECHO_IMAGE_URL ?? "http://127.0.0.1:7860",
  imageSteps: Number(process.env.ECHO_IMAGE_STEPS ?? 28),
  imageWidth: Number(process.env.ECHO_IMAGE_W ?? 512),
  imageHeight: Number(process.env.ECHO_IMAGE_H ?? 512),

  // Video is assembled locally from generated frames with ffmpeg.
  videoFrames: Number(process.env.ECHO_VIDEO_FRAMES ?? 24),
  videoFps: Number(process.env.ECHO_VIDEO_FPS ?? 12),
};

