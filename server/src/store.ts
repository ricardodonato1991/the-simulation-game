import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { memory } from "./memory.js";
import { initialAgentStates } from "./agents.js";
import { ollama } from "./ollama.js";
import type {
  AgentCommMessage,
  AgentState,
  AgentStatus,
  BrainMode,
  BrainState,
  CommMessage,
  FullState,
  LearningEvent,
  Metrics,
  NodeStatus,
  ServerMessage,
} from "./types.js";

type Sink = (msg: ServerMessage) => void;

let sink: Sink = () => {};
export function setSink(fn: Sink): void {
  sink = fn;
}
function emit(msg: ServerMessage): void {
  sink(msg);
}

const startedAt = Date.now();

export const state: FullState = {
  metrics: { cpu: 6, memory: 36, network: 3, uptimeMs: 0 },
  nodes: [
    { key: "ollama", label: "OLLAMA ENGINE", online: false },
    { key: "voice", label: "VOICE ENGINE", online: false },
    { key: "speech", label: "SPEECH REC", online: false },
    { key: "image", label: "IMG SERVER", online: false },
  ],
  agents: initialAgentStates(),
  brain: { activity: 0.18, mode: "idle", focus: 0.3 },
  comms: [],
  agentComms: [],
  learnings: memory.recentLearnings(40),
  stats: memory.stats(),
  ollamaOnline: false,
  model: config.model,
  operator: config.operator,
};

// ---- metrics -------------------------------------------------------------

export function setMetrics(m: Partial<Metrics>): void {
  state.metrics = { ...state.metrics, ...m, uptimeMs: Date.now() - startedAt };
  emit({ type: "metrics", payload: state.metrics });
}

// ---- nodes ---------------------------------------------------------------

export function setNode(key: NodeStatus["key"], online: boolean): void {
  const node = state.nodes.find((n) => n.key === key);
  if (node && node.online !== online) {
    node.online = online;
    emit({ type: "nodes", payload: state.nodes });
  }
  if (key === "ollama") state.ollamaOnline = online;
}

// ---- agents --------------------------------------------------------------

export function setAgentStatus(id: string, status: AgentStatus, bumpTask = false): void {
  const a = state.agents.find((x) => x.id === id);
  if (!a) return;
  a.status = status;
  if (status !== "idle") a.lastActive = Date.now();
  if (bumpTask) a.tasksHandled += 1;
  emit({ type: "agents", payload: state.agents });
}

export function getAgent(id: string): AgentState | undefined {
  return state.agents.find((a) => a.id === id);
}

// ---- brain ---------------------------------------------------------------

let brainTarget: BrainState = { ...state.brain };

export function setBrain(mode: BrainMode, activity: number, focus = 0.5): void {
  brainTarget = { mode, activity: clamp01(activity), focus: clamp01(focus) };
  state.brain.mode = mode;
}

/** Smoothly ease the broadcast brain activity toward its target each tick. */
export function tickBrain(): void {
  const b = state.brain;
  b.activity += (brainTarget.activity - b.activity) * 0.18;
  b.focus += (brainTarget.focus - b.focus) * 0.12;
  b.mode = brainTarget.mode;
  // Idle drift back down so the brain "breathes" when nothing is happening.
  if (brainTarget.mode === "idle") brainTarget.activity = 0.15 + Math.random() * 0.08;
  emit({ type: "brain", payload: { ...b } });
}

// ---- comms (ECHO <-> Ricardo) -------------------------------------------

export function pushComm(
  from: CommMessage["from"],
  text: string,
  streaming = false,
  imageUrl?: string
): CommMessage {
  const msg: CommMessage = { id: randomUUID(), from, text, ts: Date.now(), streaming, imageUrl };
  state.comms.push(msg);
  cap(state.comms, config.maxCommsInMemory);
  emit({ type: "comm", payload: msg });
  if (!streaming) memory.recordConversation(msg);
  return msg;
}

export function streamCommDelta(id: string, delta: string): void {
  const msg = state.comms.find((c) => c.id === id);
  if (msg) msg.text += delta;
  emit({ type: "comm_delta", payload: { id, delta } });
}

export function finishComm(id: string): void {
  const msg = state.comms.find((c) => c.id === id);
  if (msg) {
    msg.streaming = false;
    memory.recordConversation(msg);
  }
  emit({ type: "comm_done", payload: { id } });
}

// ---- agent comms (agents talking to each other / to ECHO) ----------------

export function pushAgentComm(fromAgent: string, fromLabel: string, text: string): void {
  const msg: AgentCommMessage = { id: randomUUID(), fromAgent, fromLabel, text, ts: Date.now() };
  state.agentComms.push(msg);
  cap(state.agentComms, config.maxAgentCommsInMemory);
  emit({ type: "agentcomm", payload: msg });
}

// ---- learning ------------------------------------------------------------

export function pushLearning(fact: string, source: string): void {
  const ev: LearningEvent = { id: randomUUID(), fact, source, ts: Date.now() };
  const novel = memory.learn(ev);
  state.learnings.push(ev);
  cap(state.learnings, config.maxLearningsInMemory);
  emit({ type: "learning", payload: ev });
  if (novel) refreshStats();
}

export function refreshStats(): void {
  state.stats = memory.stats();
  emit({ type: "stats", payload: state.stats });
}

// ---- snapshot for new clients -------------------------------------------

export function snapshot(): FullState {
  state.ollamaOnline = ollama.isOnline;
  state.model = config.model;
  return state;
}

// ---- helpers -------------------------------------------------------------

function cap<T>(arr: T[], max: number): void {
  if (arr.length > max) arr.splice(0, arr.length - max);
}
function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
