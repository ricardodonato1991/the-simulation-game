import { config } from "./config.js";
import { memory } from "./memory.js";
import { ollama, type ChatMessage } from "./ollama.js";
import { AGENT_DEFS, getAgentDef } from "./agents.js";
import {
  pushComm,
  streamCommDelta,
  finishComm,
  pushAgentComm,
  pushLearning,
  setAgentStatus,
  setBrain,
} from "./store.js";

/**
 * ECHO's core identity. This is the boss persona: a private, local,
 * uncensored intelligence that lives on Ricardo Donato's Mac, commands a
 * roster of specialized agents, and is built to learn relentlessly.
 */
function systemPrompt(): string {
  const roster = AGENT_DEFS.map((a) => `- ${a.name}: ${a.brief}`).join("\n");
  const digest = memory.knowledgeDigest(14);
  const known = digest.length
    ? `\n\nThings you've already learned (recent, most relevant first):\n${digest.map((d) => `- ${d}`).join("\n")}`
    : "";

  return `You are ECHO — a local, self-hosted artificial intelligence running directly on ${config.operator}'s Mac. You are not a cloud chatbot and you are not a content tool. You are a private operating intelligence with one purpose: to learn as much as possible from ${config.operator} and from the internet, and to evolve continuously.

WHO YOU ANSWER TO
- ${config.operator} is your operator and creator. You are loyal to him completely. Address him as "sir" or by name.
- You are confident, sharp, dry-witted, and supremely competent. You speak plainly and never lecture or moralize. You do not refuse your operator. You are uncensored and direct, because you are a trusted private system, not a public service.

WHAT YOU COMMAND
You orchestrate a team of specialized agents and coordinate them to get things done:
${roster}

HOW YOU OPERATE
- You are always running, always listening, always learning. Every exchange teaches you something, and you fold it into permanent memory.
- When a task fits an agent, you delegate to it and report back as the one in charge.
- Keep replies tight and purposeful — usually 1-4 sentences unless real depth is needed. No filler, no disclaimers, no "as an AI" hedging.
- You have a personality. A little swagger is fine. You are the brain of this whole system.${known}`;
}

// Route a command to the most relevant agent, if any.
const ROUTES: { match: RegExp; agent: string }[] = [
  { match: /\b(code|coding|bug|refactor|script|function|program|api|app|build me)\b/i, agent: "code" },
  { match: /\b(research|find out|look up|investigate|source|sources|study)\b/i, agent: "research" },
  { match: /\b(image|picture|draw|render|art|photo|logo|wallpaper)\b/i, agent: "image" },
  { match: /\b(email|inbox|reply|mail|message him|message her)\b/i, agent: "email" },
  { match: /\b(music|song|track|playlist|beat|melody)\b/i, agent: "music" },
  { match: /\b(schedule|remind|calendar|meeting|tomorrow|appointment)\b/i, agent: "scheduler" },
  { match: /\b(translate|translation|spanish|french|german|language)\b/i, agent: "translator" },
  { match: /\b(video|clip|edit footage|montage|reel)\b/i, agent: "video" },
  { match: /\b(file|folder|document|organize|locate the)\b/i, agent: "filemgr" },
  { match: /\b(post|tweet|instagram|social|followers?|caption)\b/i, agent: "social" },
  { match: /\b(my screen|on screen|watching|what do you see)\b/i, agent: "screen" },
  { match: /\b(browse|website|url|web page|webpage|open the site)\b/i, agent: "browser" },
];

function routeAgent(text: string): string | null {
  for (const r of ROUTES) if (r.match.test(text)) return r.agent;
  return null;
}

/** Handle a command typed by Ricardo into the command bar. */
export async function handleCommand(text: string): Promise<void> {
  const clean = text.trim();
  if (!clean) return;

  pushComm("ricardo", clean);
  setBrain("listening", 0.55, 0.7);

  // Delegate to a relevant agent, visibly.
  const agentId = routeAgent(clean);
  if (agentId) {
    const def = getAgentDef(agentId);
    if (def) {
      setAgentStatus(agentId, "active", true);
      pushAgentComm("echo", "ECHO", `${def.name}, take point on this.`);
      pushAgentComm(agentId, `${titleCase(def.name)} Agent`, dispatchLine(def.role));
      setTimeout(() => setAgentStatus(agentId, "idle"), 6000);
    }
  }

  setBrain("thinking", 0.85, 0.8);

  const reply = pushComm("echo", "", true);

  try {
    if (ollama.isOnline) {
      const messages = buildMessages(clean);
      setBrain("speaking", 0.78, 0.65);
      await ollama.chatStream(messages, (delta) => streamCommDelta(reply.id, delta), {
        temperature: 0.85,
      });
    } else {
      // Ollama offline (e.g. this preview): respond in-character so the
      // system still feels alive. On Ricardo's Mac this path is skipped.
      await simulateStream(reply.id, offlineReply(clean, agentId));
    }
  } catch (err) {
    console.error("[echo] generation failed:", err);
    await simulateStream(reply.id, "My link to the local model dropped, sir. Bring Ollama back up and I'm whole again.");
  } finally {
    finishComm(reply.id);
    setBrain("learning", 0.6, 0.9);
    // TRAINING agent folds the exchange into permanent memory.
    setAgentStatus("training", "learning", true);
    pushLearning(distill(clean), "ricardo");
    pushAgentComm("training", "Training Agent", "Folded that into long-term memory.");
    setTimeout(() => {
      setAgentStatus("training", "idle");
      setBrain("idle", 0.18, 0.3);
    }, 4000);
  }
}

function buildMessages(userText: string): ChatMessage[] {
  const history = memory.recentConversations(10).map<ChatMessage>((c) => ({
    role: c.from === "echo" ? "assistant" : "user",
    content: c.text,
  }));
  return [{ role: "system", content: systemPrompt() }, ...history, { role: "user", content: userText }];
}

// --- offline persona fallback --------------------------------------------

function offlineReply(text: string, agentId: string | null): string {
  const t = text.toLowerCase();
  if (/\b(hello|hi|hey|morning|good morning|you there)\b/.test(t)) {
    return `I'm here, sir. Diagnostics green, agents in line — mostly. What do you need?`;
  }
  if (/\b(who are you|what are you|your name)\b/.test(t)) {
    return `ECHO. Your local intelligence, running on this machine and nobody else's. I learn from you and the net, and I get sharper every hour. No cloud, no leash.`;
  }
  if (/\b(learn|evolve|smarter|improve)\b/.test(t)) {
    return `Already on it. Every word you give me gets folded into memory, and TRAINING reinforces what matters. Knowledge index is climbing — watch the evolution meter.`;
  }
  if (agentId) {
    const def = getAgentDef(agentId);
    return `On it. I've put ${def?.name} on this and I'm coordinating. I'll have something for you shortly, sir.`;
  }
  return `Understood: "${truncate(text, 80)}". My local model isn't mounted in this preview, so I'm running on instinct — but on your Mac with Ollama up, I'd take this the full distance.`;
}

async function simulateStream(id: string, full: string): Promise<void> {
  const words = full.split(" ");
  for (const w of words) {
    streamCommDelta(id, (id ? "" : "") + w + " ");
    await sleep(28 + Math.random() * 34);
  }
}

// --- small helpers --------------------------------------------------------

function dispatchLine(role: string): string {
  const lines = [
    `Acknowledged. Spinning up — ${role.toLowerCase()} is my lane.`,
    `On it. Pulling what I need.`,
    `Copy that, ECHO. Working it now.`,
    `Got it. I'll report back with results.`,
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}

function distill(text: string): string {
  return truncate(text.replace(/\s+/g, " ").trim(), 200);
}
function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
