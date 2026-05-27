// Shared protocol types for ECHO. Mirrored in client/src/lib/types.ts.

export type AgentStatus = "idle" | "active" | "thinking" | "learning" | "error";

export interface AgentState {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  lastActive: number | null;
  tasksHandled: number;
}

export type NodeKey = "ollama" | "voice" | "speech" | "image";

export interface NodeStatus {
  key: NodeKey;
  label: string;
  online: boolean;
}

export interface Metrics {
  cpu: number; // 0..100
  memory: number; // 0..100
  network: number; // MB/s
  uptimeMs: number;
}

export type BrainMode = "idle" | "thinking" | "learning" | "speaking" | "listening";

export type RGB = [number, number, number];

export interface RegionActivation {
  id: string; // matches a region in the client's brain region table
  activation: number; // 0..1
  color: RGB; // 0..1 per channel — the color this region glows right now
}

export interface BrainState {
  activity: number; // 0..1 overall firing intensity
  mode: BrainMode;
  focus: number; // 0..1, how concentrated the activity is
  emotion: string; // dominant emotion label
  emotionColor: RGB; // global tint for the current feeling
  valence: number; // -1 (negative) .. 1 (positive)
  arousal: number; // 0..1
  regions: RegionActivation[]; // which brain regions are lit, and how
  evolution: number; // 0..1 — drives how grown/complex the brain looks
}

export interface CommMessage {
  id: string;
  from: "echo" | "ricardo";
  text: string;
  ts: number;
  streaming?: boolean;
  imageUrl?: string; // a screen capture or generated image
  videoUrl?: string; // a generated video clip
}

export interface AgentCommMessage {
  id: string;
  fromAgent: string; // agent id or "echo"
  fromLabel: string;
  text: string;
  ts: number;
}

export interface LearningEvent {
  id: string;
  fact: string;
  source: string; // agent id, "ricardo", "internet", "reflection"
  ts: number;
}

export interface EchoStats {
  knowledge: number; // total learnings absorbed
  conversations: number;
  evolution: number; // 0..100 "evolution" level derived from knowledge
  bornAt: number;
}

export interface FullState {
  metrics: Metrics;
  nodes: NodeStatus[];
  agents: AgentState[];
  brain: BrainState;
  comms: CommMessage[];
  agentComms: AgentCommMessage[];
  learnings: LearningEvent[];
  stats: EchoStats;
  ollamaOnline: boolean;
  model: string; // currently active model
  models: string[]; // locally installed models ECHO can switch between
  operator: string;
}

// Messages sent server -> client
export type ServerMessage =
  | { type: "state"; payload: FullState }
  | { type: "metrics"; payload: Metrics }
  | { type: "nodes"; payload: NodeStatus[] }
  | { type: "agents"; payload: AgentState[] }
  | { type: "brain"; payload: BrainState }
  | { type: "comm"; payload: CommMessage }
  | { type: "comm_delta"; payload: { id: string; delta: string } }
  | { type: "comm_done"; payload: { id: string } }
  | { type: "agentcomm"; payload: AgentCommMessage }
  | { type: "learning"; payload: LearningEvent }
  | { type: "stats"; payload: EchoStats }
  | { type: "model"; payload: { model: string; models: string[] } };

// Messages sent client -> server
export type ClientMessage =
  | { type: "command"; payload: { text: string } }
  | { type: "set_model"; payload: { model: string } }
  | { type: "ping" };
