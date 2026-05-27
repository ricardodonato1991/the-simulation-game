import { config } from "./config.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Lightweight client for a local Ollama install. */
class Ollama {
  private online = false;
  private models: string[] = [];

  get isOnline(): boolean {
    return this.online;
  }

  get availableModels(): string[] {
    return this.models;
  }

  /** Ping Ollama and refresh the list of installed models. */
  async health(): Promise<boolean> {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const res = await fetch(`${config.ollamaUrl}/api/tags`, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) {
        this.online = false;
        return false;
      }
      const data = (await res.json()) as { models?: { name: string }[] };
      this.models = (data.models ?? []).map((m) => m.name);
      this.online = true;
      return true;
    } catch {
      this.online = false;
      return false;
    }
  }

  /**
   * Stream a chat completion. Calls onDelta for each token chunk.
   * Returns the full text. Throws if Ollama is unreachable.
   */
  async chatStream(
    messages: ChatMessage[],
    onDelta: (delta: string) => void,
    opts: { temperature?: number; model?: string } = {}
  ): Promise<string> {
    const res = await fetch(`${config.ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts.model ?? config.model,
        messages,
        stream: true,
        options: { temperature: opts.temperature ?? 0.8 },
      }),
    });

    if (!res.ok || !res.body) {
      this.online = false;
      throw new Error(`Ollama chat failed: ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let full = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      // Ollama streams newline-delimited JSON objects.
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        try {
          const obj = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
          const delta = obj.message?.content ?? "";
          if (delta) {
            full += delta;
            onDelta(delta);
          }
        } catch {
          // ignore partial / malformed lines
        }
      }
    }
    return full;
  }

  /** Non-streaming convenience wrapper used for short internal generations. */
  async chat(messages: ChatMessage[], opts: { temperature?: number; model?: string } = {}): Promise<string> {
    let out = "";
    await this.chatStream(messages, (d) => (out += d), opts);
    return out;
  }
}

export const ollama = new Ollama();
