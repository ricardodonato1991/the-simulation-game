import type { BrainMode, NodeStatus } from "../../lib/types";

const MOOD: Record<BrainMode, string> = {
  idle: "DORMANT",
  thinking: "THINKING",
  learning: "LEARNING",
  speaking: "SPEAKING",
  listening: "LISTENING",
};

export default function BrainStatusBar({
  nodes,
  mode,
  connected,
}: {
  nodes: NodeStatus[];
  mode: BrainMode;
  connected: boolean;
}) {
  const node = (k: NodeStatus["key"]) => nodes.find((n) => n.key === k)?.online ?? false;

  return (
    <div className="brain-status-bar">
      <Item on={connected} label="NEURAL LINK" />
      <Item on={node("voice")} label="VOICE SYN" />
      <Item on={node("image")} label="IMG GEN" />
      <Item on={node("ollama")} label="OLLAMA" />
      <span className="pill">
        <i className="dot warn pulse" />
        {MOOD[mode]}
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
