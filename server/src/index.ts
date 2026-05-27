import http from "node:http";
import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import { config } from "./config.js";
import { ollama } from "./ollama.js";
import { handleCommand } from "./echo.js";
import { startSimulation, stopSimulation } from "./simulation.js";
import { setSink, snapshot, pushComm } from "./store.js";
import { ACTIONS, shotsDir } from "./actions.js";
import type { ClientMessage, ServerMessage } from "./types.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Serve screen captures ECHO takes so they can be shown in the comm log.
app.use("/shots", express.static(shotsDir()));

app.get("/api/actions", (_req, res) => {
  res.json(ACTIONS.map((a) => ({ name: a.name, agent: a.agent, description: a.description })));
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    ollama: ollama.isOnline,
    models: ollama.availableModels,
    model: config.model,
    operator: config.operator,
  });
});

app.get("/api/state", (_req, res) => {
  res.json(snapshot());
});

// HTTP fallback for issuing a command (the UI normally uses the socket).
app.post("/api/command", (req, res) => {
  const text = String(req.body?.text ?? "");
  if (!text.trim()) {
    res.status(400).json({ error: "empty command" });
    return;
  }
  void handleCommand(text);
  res.json({ ok: true });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

const clients = new Set<WebSocket>();

// Broadcast every state mutation to all connected dashboards.
setSink((msg: ServerMessage) => {
  const data = JSON.stringify(msg);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  }
});

wss.on("connection", (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: "state", payload: snapshot() } satisfies ServerMessage));

  ws.on("message", (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString()) as ClientMessage;
    } catch {
      return;
    }
    if (msg.type === "command") {
      void handleCommand(msg.payload.text);
    }
  });

  ws.on("close", () => clients.delete(ws));
  ws.on("error", () => clients.delete(ws));
});

server.listen(config.port, () => {
  console.log(`\n  ECHO core online — http://localhost:${config.port}`);
  console.log(`  Operator: ${config.operator}`);
  console.log(`  Model:    ${config.model} via ${config.ollamaUrl}`);
  console.log(`  WebSocket: ws://localhost:${config.port}/ws\n`);

  startSimulation();

  // ECHO greets the operator on boot, the way it does in the HUD.
  setTimeout(() => {
    const hour = new Date().getHours();
    const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    pushComm(
      "echo",
      `${greet}, sir. I've been running diagnostics while you were away. Everyone's in line… mostly. I'm learning every second — let's get to work.`
    );
  }, 1200);
});

function shutdown(): void {
  console.log("\n  ECHO standing down.");
  stopSimulation();
  for (const ws of clients) ws.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
