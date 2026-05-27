import { useEffect, useRef } from "react";
import type { CommMessage } from "../../lib/types";

function time(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function CommLog({ comms, operator }: { comms: CommMessage[]; operator: string }) {
  const feedRef = useRef<HTMLDivElement | null>(null);
  const last = comms[comms.length - 1];

  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [comms.length, last?.text]);

  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column", flex: "1 1 55%", minHeight: 0 }}>
      <div className="panel-title">
        COMM LOG <span className="tag">{comms.length} MSG</span>
      </div>
      <div className="feed" ref={feedRef}>
        {comms.length === 0 && <div className="muted">Awaiting contact…</div>}
        {comms.map((m) => (
          <div className={`comm-msg ${m.from}`} key={m.id}>
            <div className="who">
              {m.from === "echo" ? "ECHO" : operator.toUpperCase()} · {time(m.ts)}
            </div>
            <div className="body">
              {m.text}
              {m.streaming && <span className="caret">▋</span>}
              {m.imageUrl && <img className="comm-img" src={m.imageUrl} alt="screen capture" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
