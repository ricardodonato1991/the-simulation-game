// Mirror of server/src/types.ts — the wire protocol between ECHO and the HUD.

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
  cpu: number;
  memory: number;
  network: number;
  uptimeMs: number;
}

export type BrainMode = "idle" | "thinking" | "learning" | "speaking" | "listening";

export type RGB = [number, number, number];

export interface RegionActivation {
  id: string;
  activation: number;
  color: RGB;
}

export interface BrainState {
  activity: number;
  mode: BrainMode;
  focus: number;
  emotion: string;
  emotionColor: RGB;
  valence: number;
  arousal: number;
  regions: RegionActivation[];
  evolution: number;
}

export interface CommMessage {
  id: string;
  from: "echo" | "ricardo";
  text: string;
  ts: number;
  streaming?: boolean;
  imageUrl?: string;
}

export interface AgentCommMessage {
  id: string;
  fromAgent: string;
  fromLabel: string;
  text: string;
  ts: number;
}

export interface LearningEvent {
  id: string;
  fact: string;
  source: string;
  ts: number;
}

export interface EchoStats {
  knowledge: number;
  conversations: number;
  evolution: number;
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
  model: string;
  models: string[];
  operator: string;
}

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

export type ClientMessage =
  | { type: "command"; payload: { text: string } }
  | { type: "set_model"; payload: { model: string } }
  | { type: "ping" };
