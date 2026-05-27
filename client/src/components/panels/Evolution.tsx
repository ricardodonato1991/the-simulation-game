import type { EchoStats } from "../../lib/types";

export default function Evolution({ stats }: { stats: EchoStats }) {
  const ageDays = Math.max(0, Math.floor((Date.now() - stats.bornAt) / 86_400_000));
  return (
    <div className="panel">
      <div className="panel-title">
        EVOLUTION <span className="tag">SELF-LEARNING</span>
      </div>
      <div className="evo-grid">
        <div className="evo-cell">
          <div className="k">KNOWLEDGE</div>
          <div className="v">{stats.knowledge}</div>
        </div>
        <div className="evo-cell">
          <div className="k">EXCHANGES</div>
          <div className="v">{stats.conversations}</div>
        </div>
      </div>
      <div className="metric">
        <div className="metric-head">
          <span>EVOLUTION</span>
          <span className="val">{stats.evolution}%</span>
        </div>
        <div className="bar">
          <i style={{ width: `${stats.evolution}%` }} />
        </div>
      </div>
      <div className="learn-line" style={{ marginTop: 6 }}>
        ONLINE FOR <span className="src">{ageDays}D</span> · NEVER STOPS LEARNING
      </div>
    </div>
  );
}
