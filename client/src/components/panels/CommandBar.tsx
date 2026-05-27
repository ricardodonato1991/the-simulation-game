import { useRef, useState } from "react";

export default function CommandBar({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  const history = useRef<string[]>([]);
  const histIdx = useRef<number>(-1);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    history.current.push(t);
    histIdx.current = history.current.length;
    setText("");
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      submit();
    } else if (e.key === "ArrowUp") {
      if (histIdx.current > 0) {
        histIdx.current -= 1;
        setText(history.current[histIdx.current] ?? "");
      }
      e.preventDefault();
    } else if (e.key === "ArrowDown") {
      if (histIdx.current < history.current.length - 1) {
        histIdx.current += 1;
        setText(history.current[histIdx.current] ?? "");
      } else {
        histIdx.current = history.current.length;
        setText("");
      }
      e.preventDefault();
    }
  };

  return (
    <div className="command-bar">
      <span className="prompt">›</span>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        placeholder="Enter command or query…"
        autoFocus
        spellCheck={false}
      />
      <button onClick={submit}>SEND</button>
    </div>
  );
}
