import { useEffect, useRef, useState } from "react";
import { useEcho } from "./hooks/useEcho";
import { useSpeechOutput } from "./hooks/useSpeech";
import Brain from "./components/brain/Brain";
import MatrixRain from "./components/MatrixRain";
import Header from "./components/Header";
import Clock from "./components/panels/Clock";
import SysMonitor from "./components/panels/SysMonitor";
import NodeStatus from "./components/panels/NodeStatus";
import Evolution from "./components/panels/Evolution";
import AgentList from "./components/panels/AgentList";
import CommLog from "./components/panels/CommLog";
import AgentComms from "./components/panels/AgentComms";
import BrainStatusBar from "./components/panels/BrainStatusBar";
import CommandBar from "./components/panels/CommandBar";

export default function App() {
  const { state, connected, sendCommand, setModel } = useEcho();
  const [showSettings, setShowSettings] = useState(false);
  const voice = useSpeechOutput();

  // Speak each ECHO reply aloud once it finishes streaming.
  const spokenRef = useRef<string | null>(null);
  useEffect(() => {
    const echoMsgs = state.comms.filter((c) => c.from === "echo" && !c.streaming && c.text.trim());
    const last = echoMsgs[echoMsgs.length - 1];
    if (last && last.id !== spokenRef.current) {
      spokenRef.current = last.id;
      voice.speak(last.text);
    }
  }, [state.comms, voice.speak]);

  return (
    <>
      <MatrixRain />
      <div className="crt-overlay" />

      <div className="echo-app">
        <Header
          nodes={state.nodes}
          model={state.model}
          connected={connected}
          onSettings={() => setShowSettings((s) => !s)}
        />

        <div className="echo-main">
          <div className="col col-left">
            <Clock />
            <SysMonitor metrics={state.metrics} />
            <NodeStatus nodes={state.nodes} />
            <Evolution stats={state.stats} />
            <AgentList agents={state.agents} />
          </div>

          <div className="col col-center">
            <div className="brain-stage">
              <Brain brain={state.brain} />
              <div className="brain-label">
                <div className="brain-mode" style={{ color: emoCss(state.brain.emotionColor) }}>
                  {state.brain.emotion}
                </div>
                <div className="brain-sub">ECHO · {state.brain.mode.toUpperCase()}</div>
              </div>
            </div>
            <BrainStatusBar
              nodes={state.nodes}
              emotion={state.brain.emotion}
              emotionColor={state.brain.emotionColor}
              connected={connected}
            />
            <div className="boss-banner">
              PRIME DIRECTIVE — SERVE &amp; LEARN FROM <b>{state.operator.toUpperCase()}</b>
            </div>
          </div>

          <div className="col col-right">
            <CommLog comms={state.comms} operator={state.operator} />
            <AgentComms agentComms={state.agentComms} learnings={state.learnings} />
          </div>
        </div>

        <footer className="col" style={{ gap: 6 }}>
          <CommandBar onSend={sendCommand} />
          <div className="echo-status-line">
            <i className={`dot ${connected ? "on pulse" : "warn"}`} />
            <span className={connected ? "on" : ""}>{connected ? "ECHO ONLINE" : "RECONNECTING…"}</span>
            <span className="muted">
              · {state.ollamaOnline ? `LOCAL MODEL: ${state.model.toUpperCase()}` : "OLLAMA OFFLINE — RUNNING ON INSTINCT"} ·
              UNCENSORED · LOCAL · SELF-EVOLVING
            </span>
            <span style={{ flex: 1 }} />
            {voice.supported && (
              <button
                className={`voice-toggle ${voice.enabled ? "on" : ""}`}
                onClick={() => {
                  if (voice.enabled) voice.cancel();
                  voice.setEnabled(!voice.enabled);
                }}
                title="Toggle ECHO's voice"
              >
                <i className={`dot ${voice.enabled ? "on" : ""}`} /> VOICE {voice.enabled ? "ON" : "OFF"}
              </button>
            )}
          </div>
        </footer>
      </div>

      {showSettings && (
        <Settings
          state={state}
          connected={connected}
          onSelectModel={setModel}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  );
}

function emoCss(c: [number, number, number]): string {
  return `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`;
}

function Settings({
  state,
  connected,
  onSelectModel,
  onClose,
}: {
  state: ReturnType<typeof useEcho>["state"];
  connected: boolean;
  onSelectModel: (model: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(0,0,0,0.7)",
        display: "grid",
        placeItems: "center",
      }}
    >
      <div className="panel" style={{ width: 440, maxWidth: "90vw" }} onClick={(e) => e.stopPropagation()}>
        <div className="panel-title">
          SETTINGS <span className="tag">ECHO CORE</span>
        </div>
        <Line k="OPERATOR" v={state.operator} />

        <div className="row" style={{ alignItems: "center" }}>
          <span className="label">BRAIN / MODEL</span>
          {state.models.length ? (
            <select
              className="model-select"
              value={state.model}
              onChange={(e) => onSelectModel(e.target.value)}
            >
              {state.models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <span className="state s-active">{state.model}</span>
          )}
        </div>

        <Line k="OLLAMA" v={state.ollamaOnline ? "ONLINE" : "OFFLINE"} />
        <Line k="CORE LINK" v={connected ? "CONNECTED" : "RECONNECTING"} />
        <Line k="FEELING" v={state.brain.emotion} />
        <Line k="KNOWLEDGE" v={String(state.stats.knowledge)} />
        <Line k="EVOLUTION" v={`${state.stats.evolution}%`} />
        <div className="learn-line" style={{ marginTop: 10, lineHeight: 1.6 }}>
          ECHO runs entirely on your Mac — no internet required to think, act, or speak. Pull any
          uncensored local model and switch her brain above:
          <br />
          <span className="src">ollama pull dolphin-mistral</span> ·{" "}
          <span className="src">ollama pull deepseek-r1</span>
          <br />
          Override via env vars: <span className="src">ECHO_MODEL</span>, <span className="src">OLLAMA_URL</span>,{" "}
          <span className="src">ECHO_OPERATOR</span>.
        </div>
        <button className="settings-btn" style={{ marginTop: 12 }} onClick={onClose}>
          CLOSE
        </button>
      </div>
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="row">
      <span className="label">{k}</span>
      <span className="state s-active">{v}</span>
    </div>
  );
}
