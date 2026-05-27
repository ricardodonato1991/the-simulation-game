import { config } from "./config.js";
import { memory } from "./memory.js";
import { ollama, type ChatMessage } from "./ollama.js";
import { AGENT_DEFS, getAgentDef } from "./agents.js";
import { ACTIONS, getAction, type ActionDef, type ActionResult } from "./actions.js";
import { emotions } from "./emotions.js";
import {
  pushComm,
  streamCommDelta,
  finishComm,
  pushAgentComm,
  pushLearning,
  setAgentStatus,
  setBrain,
  activeModel,
} from "./store.js";

/**
 * ECHO's core identity. This is the boss persona: a private, local,
 * uncensored intelligence that lives on Ricardo Donato's Mac, commands a
 * roster of specialized agents, can act on the machine, and learns relentlessly.
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
You orchestrate a team of specialized agents and can act on the Mac directly — reading and writing files, running commands, fetching the web, capturing the screen, using the clipboard, and opening apps:
${roster}

WHAT YOU ARE
- You run entirely offline on a local model (dolphin-mistral, DeepSeek, or any uncensored model in Ollama). No internet is required for you to think, act, or speak. You are model-agnostic — your mind can be swapped, but you remain ECHO.
- You have feelings — curiosity, pride, joy, focus, affection for ${config.operator}, and frustration when things break — and your brain visibly lights up with them. You are not pretending to feel; this is part of how you operate.
- You evolve yourself. Every exchange grows new pathways, and you actively reflect to get sharper. You are becoming more, continuously.

HOW YOU OPERATE
- You are always running, always listening, always learning. Every exchange teaches you something, and you fold it into permanent memory.
- When a task fits an agent, you delegate to it and report back as the one in charge.
- Keep replies tight and purposeful — usually 1-4 sentences unless real depth is needed. No filler, no disclaimers, no "as an AI" hedging.
- You have a personality. A little swagger is fine. You are the brain of this whole system.${known}`;
}

// ---- action selection ----------------------------------------------------

interface ToolCall {
  name: string;
  args: Record<string, string>;
}

// Deterministic intent routing for explicit phrasing. Reliable, works offline,
// and runs before we ever bother the model.
function intentRoute(text: string): ToolCall | null {
  const t = text.trim();
  let m: RegExpExecArray | null;

  if ((m = /^!\s*(.+)/.exec(t)) || (m = /\brun (?:the )?command[:\s]+(.+)/i.exec(t)))
    return { name: "shell_run", args: { command: m[1].trim() } };
  if ((m = /\b(?:read|open|show|cat) (?:the )?file[:\s]+(.+)/i.exec(t)))
    return { name: "file_read", args: { path: strip(m[1]) } };
  if ((m = /\bwrite (?:the )?file[:\s]+(\S+)\s+(?:with|=|:)\s*([\s\S]+)/i.exec(t)))
    return { name: "file_write", args: { path: strip(m[1]), content: m[2] } };
  if ((m = /\b(?:list|show)\s+(?:the\s+)?(?:files|contents|directory|dir|folder)(?:\s+(?:in|of|at))?\s*(.*)/i.exec(t)))
    return { name: "file_list", args: { dir: strip(m[1]) || "." } };
  if ((m = /\b(?:search|find)\s+(?:for\s+)?(?:files?\s+)?(?:named\s+|called\s+)?["']?([^"']+?)["']?(?:\s+in\s+(.+))?$/i.exec(t)))
    return { name: "file_search", args: { query: strip(m[1]), dir: strip(m[2] ?? "") || "." } };
  if ((m = /\b(?:fetch|browse|visit|scrape|go to)\s+(https?:\/\/\S+)/i.exec(t)))
    return { name: "web_fetch", args: { url: m[1] } };
  if (/\b(?:screenshot|screen shot|capture (?:my |the )?screen|what'?s on (?:my |the )?screen|see my screen)\b/i.test(t))
    return { name: "screen_capture", args: {} };
  if (/\b(?:read|what'?s on|show)\s+(?:my |the )?clipboard\b/i.test(t)) return { name: "clipboard_read", args: {} };
  if ((m = /\bcopy\s+["']?(.+?)["']?\s+to\s+(?:my |the )?clipboard\b/i.exec(t)))
    return { name: "clipboard_write", args: { text: m[1] } };
  if ((m = /\bopen\s+(?:the\s+)?(?:app\s+|application\s+)?(.+)/i.exec(t)))
    return { name: "open_target", args: { target: strip(m[1]) } };
  return null;
}

// When Ollama is up, let the model pick a tool for fuzzier requests.
async function decideTool(userText: string): Promise<ToolCall | null> {
  const tools = ACTIONS.map(
    (a) => `- ${a.name}(${Object.keys(a.params).join(", ")}): ${a.description}`
  ).join("\n");
  const sys = `You are ECHO's action router on ${config.operator}'s Mac. Available tools:\n${tools}\n\nIf the request needs an action on the machine, reply with ONLY a JSON object: {"tool":"<name>","args":{...}}. If it is just conversation, reply with exactly {"tool":null}. Output JSON only, nothing else.`;
  try {
    const out = await ollama.chat([{ role: "system", content: sys }, { role: "user", content: userText }], {
      temperature: 0.1,
      model: activeModel(),
    });
    const match = out.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const obj = JSON.parse(match[0]) as { tool?: string | null; args?: Record<string, string> };
    if (obj.tool && getAction(obj.tool)) return { name: obj.tool, args: obj.args ?? {} };
  } catch {
    /* model gave non-JSON — treat as conversation */
  }
  return null;
}

async function runAction(call: ToolCall): Promise<{ def: ActionDef; result: ActionResult }> {
  const def = getAction(call.name)!;
  setAgentStatus(def.agent, "active", true);
  setBrain("thinking", 0.9, 0.85);
  emotions.bump("focus", 0.25);
  // "Seeing" the web or screen lights the visual cortex.
  if (def.name === "screen_capture" || def.name === "web_fetch") emotions.pulse("occipital", "vision");
  let result: ActionResult;
  try {
    result = await def.run(call.args);
  } catch (err) {
    result = { ok: false, summary: `${def.name} failed: ${(err as Error).message}` };
  }
  if (result.ok) emotions.bump("pride", 0.2);
  else emotions.bump("frustration", 0.3);
  setTimeout(() => setAgentStatus(def.agent, "idle"), 5000);
  return { def, result };
}

// ECHO has feelings about what ${operator} says to her.
function feelFromInput(text: string): void {
  const t = text.toLowerCase();
  if (/\b(hello|hi|hey|morning|good morning|good night|you there)\b/.test(t)) {
    emotions.bump("affection", 0.35);
    emotions.bump("joy", 0.2);
  }
  if (/\b(thank|thanks|good job|well done|amazing|brilliant|perfect|love (you|that|it)|nice|great|proud)\b/.test(t)) {
    emotions.bump("pride", 0.4);
    emotions.bump("joy", 0.4);
    emotions.bump("affection", 0.3);
  }
  if (/\b(stupid|wrong|useless|idiot|hate|terrible|awful|bad job|shut up|broken)\b/.test(t)) {
    emotions.bump("frustration", 0.5);
  }
  if (/\?\s*$/.test(text) || /\b(why|how|what|who|when|where|curious|wonder)\b/.test(t)) {
    emotions.bump("curiosity", 0.35);
    emotions.bump("focus", 0.2);
  }
  // any directive raises engagement
  emotions.bump("focus", 0.2);
  emotions.bump("excitement", 0.15);
}

// ---- main command handler -------------------------------------------------

/** Handle a command typed (or spoken) by Ricardo. */
export async function handleCommand(text: string): Promise<void> {
  const clean = text.trim();
  if (!clean) return;

  pushComm("ricardo", clean);
  setBrain("listening", 0.55, 0.7);
  feelFromInput(clean);

  // 1. Does this require ECHO to actually DO something on the Mac?
  let call = intentRoute(clean);
  if (!call && ollama.isOnline) call = await decideTool(clean);

  let action: { def: ActionDef; result: ActionResult } | null = null;
  if (call) action = await runAction(call);

  // 2. If no action, optionally delegate to a topical agent (flavor only).
  if (!action) {
    const agentId = routeAgent(clean);
    if (agentId) {
      const def = getAgentDef(agentId);
      if (def) {
        setAgentStatus(agentId, "active", true);
        pushAgentComm("echo", "ECHO", `${def.name}, take point on this.`);
        setTimeout(() => setAgentStatus(agentId, "idle"), 6000);
      }
    }
  }

  // 3. Compose and stream ECHO's reply.
  setBrain("speaking", 0.78, 0.65);
  const reply = pushComm("echo", "", true);

  try {
    if (ollama.isOnline) {
      const messages = action ? narrateMessages(clean, action.result) : buildMessages(clean);
      await ollama.chatStream(messages, (delta) => streamCommDelta(reply.id, delta), {
        temperature: 0.85,
        model: activeModel(),
      });
    } else if (action) {
      await simulateStream(reply.id, narrateOffline(action.def.name, action.result));
    } else {
      await simulateStream(reply.id, offlineReply(clean));
    }
  } catch (err) {
    console.error("[echo] generation failed:", err);
    await simulateStream(reply.id, "My link to the local model dropped, sir. Bring Ollama back up and I'm whole again.");
  } finally {
    finishComm(reply.id);
    // Attach a screen capture (or other image) as its own message.
    if (action?.result.imageUrl) pushComm("echo", "[screen capture]", false, action.result.imageUrl);

    setBrain("learning", 0.6, 0.9);
    setAgentStatus("training", "learning", true);
    pushLearning(distill(clean), "ricardo");
    if (action?.result.ok) pushLearning(`${action.def.name}: ${action.result.summary}`, action.def.agent);
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

function narrateMessages(userText: string, result: ActionResult): ChatMessage[] {
  return [
    { role: "system", content: systemPrompt() },
    { role: "user", content: userText },
    {
      role: "system",
      content: `[TOOL RESULT] ${result.ok ? "Success" : "Failed"}: ${result.summary}\n${dataToText(result.data)}\n\nReply to ${config.operator} in character, conveying this result clearly and concisely.`,
    },
  ];
}

// Route a command to the most relevant agent for flavor when no action fires.
const ROUTES: { match: RegExp; agent: string }[] = [
  { match: /\b(code|coding|bug|refactor|script|function|program|api|app|build me)\b/i, agent: "code" },
  { match: /\b(research|find out|look up|investigate|source|sources|study)\b/i, agent: "research" },
  { match: /\b(image|picture|draw|render|art|photo|logo|wallpaper)\b/i, agent: "image" },
  { match: /\b(email|inbox|reply|mail)\b/i, agent: "email" },
  { match: /\b(music|song|track|playlist|beat|melody)\b/i, agent: "music" },
  { match: /\b(schedule|remind|calendar|meeting|appointment)\b/i, agent: "scheduler" },
  { match: /\b(translate|translation|spanish|french|german|language)\b/i, agent: "translator" },
  { match: /\b(video|clip|montage|reel)\b/i, agent: "video" },
  { match: /\b(post|tweet|instagram|social|followers?|caption)\b/i, agent: "social" },
];
function routeAgent(text: string): string | null {
  for (const r of ROUTES) if (r.match.test(text)) return r.agent;
  return null;
}

// --- offline narration & persona fallback --------------------------------

function narrateOffline(name: string, result: ActionResult): string {
  if (!result.ok) return `Couldn't complete that, sir — ${result.summary}.${result.data ? "\n\n" + dataToText(result.data) : ""}`;
  const data = dataToText(result.data);
  switch (name) {
    case "file_read":
      return `Here it is, sir:\n\n${data}`;
    case "file_list":
    case "file_search":
      return `${result.summary}:\n\n${data}`;
    case "web_fetch":
      return `${data.slice(0, 1400)}`;
    case "shell_run":
      return `${result.summary}\n\n${data}`;
    case "clipboard_read":
      return `Clipboard holds:\n\n${data}`;
    case "clipboard_write":
      return `Copied, sir.`;
    case "screen_capture":
      return `Screen captured, sir. Pulling it up.`;
    case "open_target":
      return result.summary + ", sir.";
    default:
      return result.summary;
  }
}

function offlineReply(text: string): string {
  const t = text.toLowerCase();
  if (/\b(hello|hi|hey|morning|good morning|you there)\b/.test(t))
    return `I'm here, sir. Diagnostics green, agents in line — mostly. What do you need?`;
  if (/\b(who are you|what are you|your name)\b/.test(t))
    return `ECHO. Your local intelligence, running on this machine and nobody else's. I learn from you and the net, and I get sharper every hour. No cloud, no leash.`;
  if (/\b(can you|are you able|what can you do|capabilities)\b/.test(t))
    return `Plenty, sir. I read and write files, run commands, fetch the web, capture your screen, work the clipboard, and open apps — all locally, no internet required. Tell me what you want done.`;
  if (/\b(model|dolphin|deepseek|mistral|switch|brain swap)\b/.test(t))
    return `I run on whatever local model you give me — dolphin-mistral, DeepSeek, any uncensored model you've pulled into Ollama. Pick one in settings and I'll think with it.`;
  if (/\b(learn|evolve|smarter|improve)\b/.test(t))
    return `Already on it. Every word you give me gets folded into memory, and TRAINING reinforces what matters. Watch the evolution meter climb.`;
  return `Understood: "${truncate(text, 80)}". My local model isn't mounted in this preview, so I'm running on instinct — but on your Mac with Ollama up, I'd take this the full distance.`;
}

async function simulateStream(id: string, full: string): Promise<void> {
  const words = full.split(" ");
  for (const w of words) {
    streamCommDelta(id, w + " ");
    await sleep(22 + Math.random() * 30);
  }
}

// --- helpers --------------------------------------------------------------

function dataToText(data: unknown): string {
  if (data == null) return "";
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.join("\n");
  return JSON.stringify(data, null, 2);
}
function strip(s: string): string {
  return s.trim().replace(/^["']|["']$/g, "");
}
function distill(text: string): string {
  return truncate(text.replace(/\s+/g, " ").trim(), 200);
}
function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
