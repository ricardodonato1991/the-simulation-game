import type { Metrics } from "../../lib/types";

function fmtUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}:${ss
    .toString()
    .padStart(2, "0")}`;
}

export default function SysMonitor({ metrics }: { metrics: Metrics }) {
  const netPct = Math.min(100, (metrics.network / 18) * 100);
  return (
    <div className="panel">
      <div className="panel-title">SYS MONITOR</div>

      <Bar label="CPU LOAD" value={`${metrics.cpu.toFixed(1)}%`} pct={metrics.cpu} />
      <Bar label="MEMORY" value={`${metrics.memory.toFixed(1)}%`} pct={metrics.memory} />
      <Bar label="NETWORK" value={`${metrics.network.toFixed(1)} MB/s`} pct={netPct} />

      <div className="metric" style={{ marginTop: 4 }}>
        <div className="metric-head">
          <span>UPTIME</span>
          <span className="val">{fmtUptime(metrics.uptimeMs)}</span>
        </div>
      </div>
    </div>
  );
}

function Bar({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <div className="metric">
      <div className="metric-head">
        <span>{label}</span>
        <span className="val">{value}</span>
      </div>
      <div className="bar">
        <i style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
      </div>
    </div>
  );
}
