import { useEffect, useMemo, useRef } from "react";
import type { AgentCommMessage, LearningEvent } from "../../lib/types";

function time(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

type Item =
  | { kind: "comm"; ts: number; data: AgentCommMessage }
  | { kind: "learn"; ts: number; data: LearningEvent };

export default function AgentComms({
  agentComms,
  learnings,
}: {
  agentComms: AgentCommMessage[];
  learnings: LearningEvent[];
}) {
  const feedRef = useRef<HTMLDivElement | null>(null);

  const items = useMemo<Item[]>(() => {
    const merged: Item[] = [
      ...agentComms.map((c) => ({ kind: "comm" as const, ts: c.ts, data: c })),
      ...learnings.map((l) => ({ kind: "learn" as const, ts: l.ts, data: l })),
    ];
    merged.sort((a, b) => a.ts - b.ts);
    return merged.slice(-80);
  }, [agentComms, learnings]);

  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items.length]);

  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column", flex: "1 1 45%", minHeight: 0 }}>
      <div className="panel-title">
        AGENT COMMS{" "}
        <span className="tag">
          <i className="dot on pulse" style={{ marginRight: 5 }} />
          LIVE
        </span>
      </div>
      <div className="feed" ref={feedRef}>
        {items.length === 0 && <div className="muted">Agents idle…</div>}
        {items.map((it) =>
          it.kind === "comm" ? (
            <div className={`agentcomm ${it.data.fromAgent === "echo" ? "echo" : "agent"}`} key={it.data.id}>
              <span className="ts">{time(it.ts)}</span>
              <span className="from">{it.data.fromLabel}:</span> {it.data.text}
            </div>
          ) : (
            <div className="learn-line" key={it.data.id}>
              <span className="ts">{time(it.ts)}</span>＋ LEARNED [{<span className="src">{it.data.source}</span>}]: {it.data.fact}
            </div>
          )
        )}
      </div>
    </div>
  );
}
