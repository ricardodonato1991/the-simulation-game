import type { AgentState } from "../../lib/types";

const STATE_LABEL: Record<AgentState["status"], string> = {
  idle: "IDLE",
  active: "ACTIVE",
  thinking: "THINKING",
  learning: "LEARNING",
  error: "ERROR",
};

export default function AgentList({ agents }: { agents: AgentState[] }) {
  const busy = agents.filter((a) => a.status !== "idle").length;
  return (
    <div className="panel">
      <div className="panel-title">
        AGENTS <span className="tag">{busy} ACTIVE</span>
      </div>
      <div className="agent-list">
        {agents.map((a) => {
          const active = a.status !== "idle";
          return (
            <div className={`row ${active ? "active" : ""}`} key={a.id}>
              <span className="label name">{a.name}</span>
              <span className={`state s-${a.status}`}>
                <i className={`dot ${active ? "on pulse" : ""}`} />
                {STATE_LABEL[a.status]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
