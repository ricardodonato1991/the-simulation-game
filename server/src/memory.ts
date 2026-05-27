import { promises as fs } from "node:fs";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CommMessage, LearningEvent, EchoStats } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "data");
const MEM_FILE = path.join(DATA_DIR, "memory.json");

interface MemoryShape {
  bornAt: number;
  conversations: CommMessage[];
  learnings: LearningEvent[];
  // Deduped knowledge keyed by a normalized fact string.
  knowledgeIndex: Record<string, { count: number; lastTs: number; source: string }>;
}

function emptyMemory(): MemoryShape {
  return {
    bornAt: Date.now(),
    conversations: [],
    learnings: [],
    knowledgeIndex: {},
  };
}

/**
 * ECHO's long-term memory. Everything Ricardo says and everything the agents
 * surface is folded in here and persisted to disk, so ECHO keeps evolving
 * across restarts instead of starting from zero each time.
 */
class Memory {
  private data: MemoryShape;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.data = emptyMemory();
    if (existsSync(MEM_FILE)) {
      try {
        const raw = readFileSync(MEM_FILE, "utf8");
        const parsed = JSON.parse(raw) as Partial<MemoryShape>;
        this.data = { ...emptyMemory(), ...parsed };
      } catch {
        // Corrupt memory file: start fresh rather than crash.
        this.data = emptyMemory();
      }
    }
  }

  get bornAt(): number {
    return this.data.bornAt;
  }

  recordConversation(msg: CommMessage): void {
    this.data.conversations.push(msg);
    if (this.data.conversations.length > 2000) {
      this.data.conversations.splice(0, this.data.conversations.length - 2000);
    }
    this.scheduleSave();
  }

  /** Fold a new learning into long-term memory. Returns true if it was novel. */
  learn(ev: LearningEvent): boolean {
    const key = normalize(ev.fact);
    if (!key) return false;
    const existing = this.data.knowledgeIndex[key];
    const novel = !existing;
    this.data.knowledgeIndex[key] = {
      count: (existing?.count ?? 0) + 1,
      lastTs: ev.ts,
      source: ev.source,
    };
    this.data.learnings.push(ev);
    if (this.data.learnings.length > 5000) {
      this.data.learnings.splice(0, this.data.learnings.length - 5000);
    }
    this.scheduleSave();
    return novel;
  }

  recentLearnings(n: number): LearningEvent[] {
    return this.data.learnings.slice(-n);
  }

  recentConversations(n: number): CommMessage[] {
    return this.data.conversations.slice(-n);
  }

  /** A compact knowledge digest the model can use as context. */
  knowledgeDigest(n = 12): string[] {
    const entries = Object.entries(this.data.knowledgeIndex)
      .sort((a, b) => b[1].lastTs - a[1].lastTs)
      .slice(0, n);
    return entries.map(([fact]) => fact);
  }

  stats(): EchoStats {
    const knowledge = Object.keys(this.data.knowledgeIndex).length;
    const conversations = this.data.conversations.filter((c) => c.from === "ricardo").length;
    // Evolution curve flattens as it grows — fast early gains, slower later.
    const evolution = Math.min(100, Math.round(100 * (1 - Math.exp(-knowledge / 120))));
    return { knowledge, conversations, evolution, bornAt: this.data.bornAt };
  }

  private scheduleSave(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.flush();
    }, 1500);
  }

  async flush(): Promise<void> {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(MEM_FILE, JSON.stringify(this.data, null, 2), "utf8");
    } catch (err) {
      console.error("[memory] failed to persist:", err);
    }
  }
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 240);
}

export const memory = new Memory();
