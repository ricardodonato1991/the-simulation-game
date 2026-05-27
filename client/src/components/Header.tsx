import type { NodeStatus } from "../lib/types";

interface Props {
  nodes: NodeStatus[];
  model: string;
  connected: boolean;
  onSettings: () => void;
}

export default function Header({ nodes, model, connected, onSettings }: Props) {
  const ollama = nodes.find((n) => n.key === "ollama")?.online ?? false;
  const voice = nodes.find((n) => n.key === "voice")?.online ?? false;

  return (
    <header className="echo-header">
      <div className="status-pills">
        <span className="pill">
          <i className={`dot ${ollama ? "on pulse" : ""}`} />
          {model.toUpperCase()}
        </span>
        <span className="pill">
          <i className={`dot ${voice ? "on" : ""}`} />
          VOICE
        </span>
        <span className="pill">
          <i className={`dot ${connected ? "on" : "warn"}`} />
          SYS
        </span>
      </div>

      <h1 className="echo-title">ECHO</h1>

      <button className="settings-btn" onClick={onSettings}>
        ◍ SETTINGS
      </button>
    </header>
  );
}
