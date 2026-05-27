import { useRef, useState } from "react";
import { useSpeechInput } from "../../hooks/useSpeech";

export default function CommandBar({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  const history = useRef<string[]>([]);
  const histIdx = useRef<number>(-1);

  const submit = (value?: string) => {
    const t = (value ?? text).trim();
    if (!t) return;
    onSend(t);
    history.current.push(t);
    histIdx.current = history.current.length;
    setText("");
  };

  const mic = useSpeechInput({
    onInterim: (t) => setText(t),
    onFinal: (t) => submit(t),
  });

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
        placeholder={mic.listening ? "Listening…" : "Enter command or query…"}
        autoFocus
        spellCheck={false}
      />
      {mic.supported && (
        <button
          className={`mic-btn ${mic.listening ? "live" : ""}`}
          onClick={mic.toggle}
          title={mic.listening ? "Stop listening" : "Speak to ECHO"}
          aria-label="Toggle microphone"
        >
          {mic.listening ? "● REC" : "🎤 SPEAK"}
        </button>
      )}
      <button onClick={() => submit()}>SEND</button>
    </div>
  );
}
