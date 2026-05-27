import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AgentCommMessage,
  CommMessage,
  FullState,
  LearningEvent,
  ServerMessage,
} from "../lib/types";

const MAX_FEED = 120;

function emptyState(): FullState {
  return {
    metrics: { cpu: 0, memory: 0, network: 0, uptimeMs: 0 },
    nodes: [
      { key: "ollama", label: "OLLAMA ENGINE", online: false },
      { key: "voice", label: "VOICE ENGINE", online: false },
      { key: "speech", label: "SPEECH REC", online: false },
      { key: "image", label: "IMG SERVER", online: false },
    ],
    agents: [],
    brain: {
      activity: 0.15,
      mode: "idle",
      focus: 0.3,
      emotion: "CALM",
      emotionColor: [0.2, 0.85, 0.55],
      valence: 0.3,
      arousal: 0.15,
      regions: [],
      evolution: 0,
    },
    comms: [],
    agentComms: [],
    learnings: [],
    stats: { knowledge: 0, conversations: 0, evolution: 0, bornAt: Date.now() },
    ollamaOnline: false,
    model: "dolphin-mistral",
    models: [],
    operator: "Ricardo Donato",
  };
}

export interface UseEcho {
  state: FullState;
  connected: boolean;
  sendCommand: (text: string) => void;
  setModel: (model: string) => void;
}

export function useEcho(): UseEcho {
  const [state, setState] = useState<FullState>(emptyState);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<number>(0);

  useEffect(() => {
    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        retryRef.current = 0;
      };

      ws.onmessage = (ev) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(ev.data) as ServerMessage;
        } catch {
          return;
        }
        setState((prev) => reduce(prev, msg));
      };

      ws.onclose = () => {
        setConnected(false);
        if (closed) return;
        retryRef.current = Math.min(retryRef.current + 1, 6);
        const delay = Math.min(1000 * 2 ** retryRef.current, 8000);
        reconnectTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  const sendCommand = useCallback((text: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "command", payload: { text } }));
    } else {
      // Fall back to the HTTP endpoint if the socket is down.
      void fetch("/api/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
    }
  }, []);

  const setModel = useCallback((model: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "set_model", payload: { model } }));
    }
  }, []);

  return { state, connected, sendCommand, setModel };
}

function reduce(prev: FullState, msg: ServerMessage): FullState {
  switch (msg.type) {
    case "state":
      return msg.payload;
    case "metrics":
      return { ...prev, metrics: msg.payload };
    case "nodes":
      return { ...prev, nodes: msg.payload, ollamaOnline: msg.payload.find((n) => n.key === "ollama")?.online ?? prev.ollamaOnline };
    case "agents":
      return { ...prev, agents: msg.payload };
    case "brain":
      return { ...prev, brain: msg.payload };
    case "stats":
      return { ...prev, stats: msg.payload };
    case "model":
      return { ...prev, model: msg.payload.model, models: msg.payload.models };
    case "comm":
      return { ...prev, comms: capList<CommMessage>([...prev.comms, msg.payload]) };
    case "comm_delta":
      return {
        ...prev,
        comms: prev.comms.map((c) => (c.id === msg.payload.id ? { ...c, text: c.text + msg.payload.delta } : c)),
      };
    case "comm_done":
      return {
        ...prev,
        comms: prev.comms.map((c) => (c.id === msg.payload.id ? { ...c, streaming: false } : c)),
      };
    case "agentcomm":
      return { ...prev, agentComms: capList<AgentCommMessage>([...prev.agentComms, msg.payload]) };
    case "learning":
      return { ...prev, learnings: capList<LearningEvent>([...prev.learnings, msg.payload]) };
    default:
      return prev;
  }
}

function capList<T>(arr: T[]): T[] {
  return arr.length > MAX_FEED ? arr.slice(arr.length - MAX_FEED) : arr;
}
