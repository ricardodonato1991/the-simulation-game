import type { NodeStatus as Node } from "../../lib/types";

export default function NodeStatus({ nodes }: { nodes: Node[] }) {
  return (
    <div className="panel">
      <div className="panel-title">NODE STATUS</div>
      {nodes.map((n) => (
        <div className="row" key={n.key}>
          <span className="label">{n.label}</span>
          <span className="state">
            <i className={`dot ${n.online ? "on" : ""}`} />
            {n.online ? "ONLINE" : "OFFLINE"}
          </span>
        </div>
      ))}
    </div>
  );
}
