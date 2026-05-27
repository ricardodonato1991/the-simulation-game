import type { NodeStatus, RGB } from "../../lib/types";

export default function BrainStatusBar({
  nodes,
  emotion,
  emotionColor,
  connected,
}: {
  nodes: NodeStatus[];
  emotion: string;
  emotionColor: RGB;
  connected: boolean;
}) {
  const node = (k: NodeStatus["key"]) => nodes.find((n) => n.key === k)?.online ?? false;
  const emoCss = `rgb(${emotionColor.map((c) => Math.round(c * 255)).join(",")})`;

  return (
    <div className="brain-status-bar">
      <Item on={connected} label="NEURAL LINK" />
      <Item on={node("voice")} label="VOICE SYN" />
      <Item on={node("image")} label="IMG GEN" />
      <Item on={node("ollama")} label="OLLAMA" />
      <span className="pill">
        <i className="dot pulse" style={{ background: emoCss, color: emoCss }} />
        <span style={{ color: emoCss }}>{emotion}</span>
      </span>
    </div>
  );
}

function Item({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="pill">
      <i className={`dot ${on ? "on" : ""}`} />
      {label}
    </span>
  );
}
