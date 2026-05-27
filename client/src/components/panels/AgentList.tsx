import type { AgentState } from "../../lib/types";

// Per Ricardo: the rail shows only the agents' names. No roles, no action
// text — just who's on the floor. Active agents glow; idle ones stay dim.
export default function AgentList({ agents }: { agents: AgentState[] }) {
  return (
    <div className="panel">
      <div className="panel-title">AGENTS</div>
      <div className="agent-list">
        {agents.map((a) => {
          const active = a.status !== "idle";
          return (
            <div className={`row ${active ? "active" : ""}`} key={a.id}>
              <span className="label name">{a.name}</span>
              <i className={`dot ${active ? "on pulse" : ""}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
