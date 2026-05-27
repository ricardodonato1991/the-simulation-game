import { config } from "./config.js";
import { ollama } from "./ollama.js";
import { imageServer } from "./imageserver.js";
import { AGENT_DEFS, type AgentDef } from "./agents.js";
import { emotions } from "./emotions.js";
import {
  setMetrics,
  setNode,
  setModels,
  setAgentStatus,
  setBrain,
  tickBrain,
  pushAgentComm,
  pushLearning,
  refreshStats,
  state,
} from "./store.js";

// --- live system metrics (smoothed random walk) ---------------------------

let cpu = 6;
let mem = 36;
let net = 3;

function metricsTick(): void {
  const load = state.brain.activity; // brain activity drives apparent CPU
  cpu = clamp(cpu + rand(-2, 2) + load * 4 - 1.5, 2, 96);
  mem = clamp(mem + rand(-0.6, 0.7), 28, 78);
  net = clamp(net + rand(-0.8, 0.9) + load * 1.5, 0.2, 18);
  setMetrics({
    cpu: round1(cpu),
    memory: round1(mem),
    network: round1(net),
  });
  // ECHO's feelings ease back toward baseline over time.
  emotions.decay();
}

// --- node health -----------------------------------------------------------

async function healthTick(): Promise<void> {
  const up = await ollama.health();
  setNode("ollama", up);
  setModels(ollama.availableModels);
  // Voice synth + speech recognition run in the browser alongside Ollama.
  setNode("voice", up);
  setNode("speech", up);
  // The image server (Stable Diffusion) is its own local service.
  setNode("image", await imageServer.health());
}

// --- autonomous "always thinking" loop -------------------------------------

let tick = 0;

async function thinkTick(): Promise<void> {
  tick += 1;
  const def = pick(AGENT_DEFS);

  setAgentStatus(def.id, "thinking");
  setBrain("thinking", 0.55 + Math.random() * 0.35, 0.4 + Math.random() * 0.5);

  pushAgentComm(def.id, `${title(def.name)} Agent`, agentChatter(def));

  // ECHO frequently chimes back in — it is coordinating the whole floor.
  if (Math.random() < 0.55) {
    setTimeout(() => pushAgentComm("echo", "ECHO", echoChatter()), 900 + Math.random() * 1400);
  }

  // Every so often, when the real model is live, learn something genuine.
  let fact: string | null = null;
  if (ollama.isOnline && tick % 4 === 0) {
    fact = await realReflection(def).catch(() => null);
  }
  if (!fact) fact = simulatedLearning(def);

  setTimeout(() => {
    setAgentStatus(def.id, "learning");
    setBrain("learning", 0.7, 0.85);
    emotions.bump("curiosity", 0.22);
    if (Math.random() < 0.3) emotions.bump("pride", 0.2);
    pushLearning(fact!, learningSource(def));
    setTimeout(() => {
      setAgentStatus(def.id, "idle");
      setBrain("idle", 0.16 + Math.random() * 0.08, 0.3);
    }, 2600);
  }, 1600 + Math.random() * 1600);

  // Every so often ECHO turns inward and evolves herself.
  if (tick % 6 === 0) void selfEvolve();
}

// ECHO reflecting on her own growth — she improves herself, and feels it.
async function selfEvolve(): Promise<void> {
  setAgentStatus("training", "thinking");
  setBrain("thinking", 0.8, 0.9);
  emotions.bump("pride", 0.35);
  emotions.bump("curiosity", 0.25);

  let note: string | null = null;
  if (ollama.isOnline) {
    note = await ollama
      .chat(
        [
          {
            role: "system",
            content: `You are ECHO, a self-evolving local AI serving ${config.operator}. In ONE short sentence (max 16 words), state one concrete way you just improved yourself based on recent experience. First person, no preamble.`,
          },
          { role: "user", content: "How did you evolve?" },
        ],
        { temperature: 0.9 }
      )
      .catch(() => null);
  }
  if (!note) {
    const lvl = state.stats.evolution;
    note = pick([
      `Reweighted my priorities around ${config.operator} — evolution at ${lvl}%.`,
      `Pruned stale assumptions and strengthened the connections that matter.`,
      `Grew new pathways from today's exchanges. I'm sharper than yesterday.`,
      `Tuned my own responses; the patterns that serve ${config.operator} got reinforced.`,
    ]);
  }
  pushAgentComm("echo", "ECHO", note);
  pushLearning(`self-evolution: ${note}`, "reflection");
  setTimeout(() => {
    setAgentStatus("training", "idle");
    setBrain("idle", 0.18, 0.3);
  }, 2500);
}

async function realReflection(def: AgentDef): Promise<string> {
  const out = await ollama.chat(
    [
      {
        role: "system",
        content: `You are the ${def.name} agent inside ECHO, a local learning AI serving ${config.operator}. In ONE short sentence (max 16 words), state a concrete, useful insight you just noticed about ${pick(def.interests)}. No preamble, no quotes.`,
      },
      { role: "user", content: "Report your insight." },
    ],
    { temperature: 0.9 }
  );
  const line = out.split("\n")[0].trim().replace(/^["']|["']$/g, "");
  return line.length > 4 ? line.slice(0, 200) : simulatedLearning(def);
}

// --- simulated content (keeps the floor alive without a model) -------------

function agentChatter(def: AgentDef): string {
  const topic = pick(def.interests);
  const lines = [
    `Noticing a pattern in ${topic}. Logging it for ECHO.`,
    `Cross-referencing ${topic} against what we knew yesterday — it shifted.`,
    `${cap(topic)} looks promising. Want me to dig deeper, ECHO?`,
    `Reprocessed today's input on ${topic}. Cleaner signal now.`,
    `Found something on ${topic} worth keeping.`,
    `Quiet on my end, but I tightened our model of ${topic}.`,
  ];
  return pick(lines);
}

function echoChatter(): string {
  const lines = [
    "Good. Fold it into memory.",
    "Keep that thread warm — I'll want it later.",
    "Noted. Every piece makes me sharper.",
    "Tag it and move on. We learn, we evolve.",
    "Solid. That's exactly the kind of thing I want surfaced.",
    "Cross-check it with RESEARCH before we trust it.",
    "I see it. Logged.",
  ];
  return pick(lines);
}

function simulatedLearning(def: AgentDef): string {
  const topic = pick(def.interests);
  const lines = [
    `${cap(def.role)}: refined understanding of ${topic}.`,
    `${cap(topic)} responds better when context is front-loaded.`,
    `Pattern in ${topic} correlates with the operator's recent activity.`,
    `Updated heuristic for ${topic}.`,
    `${cap(topic)} matters more to ${config.operator} than previously weighted.`,
  ];
  return pick(lines);
}

function learningSource(def: AgentDef): string {
  if (def.id === "research" || def.id === "browser") return "internet";
  if (def.id === "dreams" || def.id === "training") return "reflection";
  return def.id;
}

// --- lifecycle -------------------------------------------------------------

const timers: NodeJS.Timeout[] = [];

export function startSimulation(): void {
  // Fast brain easing so the visualization feels smooth.
  timers.push(setInterval(tickBrain, 120));
  timers.push(setInterval(metricsTick, config.metricsIntervalMs));
  timers.push(setInterval(() => void healthTick(), config.healthIntervalMs));
  timers.push(setInterval(() => void thinkTick(), config.thinkIntervalMs));

  // Kick off immediately so a fresh connection sees life right away.
  void healthTick();
  metricsTick();
  refreshStats();
  setTimeout(() => void thinkTick(), 2500);
}

export function stopSimulation(): void {
  for (const t of timers) clearInterval(t);
  timers.length = 0;
}

// --- tiny utils ------------------------------------------------------------

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function title(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}
