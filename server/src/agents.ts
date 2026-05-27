import type { AgentState } from "./types.js";

export interface AgentDef {
  id: string;
  name: string;
  role: string;
  // Capability description fed to the model when ECHO dispatches to this agent.
  brief: string;
  // Topics this agent tends to surface during autonomous chatter / reflection.
  interests: string[];
}

// The roster shown down the left rail of the HUD.
export const AGENT_DEFS: AgentDef[] = [
  { id: "content", name: "CONTENT", role: "Writing & ideation", brief: "Drafts text, scripts, captions and long-form writing in any voice.", interests: ["narrative framing", "tone", "hooks"] },
  { id: "research", name: "RESEARCH", role: "Knowledge gathering", brief: "Pulls, cross-checks and summarizes information from the internet and local notes.", interests: ["primary sources", "contradictions", "fresh data"] },
  { id: "image", name: "IMAGE", role: "Visual generation", brief: "Generates and edits images via the local image server.", interests: ["composition", "style transfer", "prompts"] },
  { id: "code", name: "CODE", role: "Engineering", brief: "Writes, refactors and debugs software on the local machine.", interests: ["edge cases", "performance", "architecture"] },
  { id: "scheduler", name: "SCHEDULER", role: "Time & tasks", brief: "Tracks the operator's calendar, reminders and recurring jobs.", interests: ["deadlines", "conflicts", "routines"] },
  { id: "training", name: "TRAINING", role: "Self-improvement", brief: "Curates lessons from every interaction and folds them back into ECHO's memory.", interests: ["mistakes", "patterns", "reinforcement"] },
  { id: "filemgr", name: "FILE MGR", role: "Filesystem", brief: "Reads, organizes and searches files across the local Mac.", interests: ["structure", "duplicates", "naming"] },
  { id: "builder", name: "BUILDER", role: "Tooling", brief: "Assembles new tools and small apps on demand.", interests: ["automation", "glue code", "shortcuts"] },
  { id: "music", name: "MUSIC", role: "Audio", brief: "Composes, queues and analyzes music and soundscapes.", interests: ["mood", "tempo", "layering"] },
  { id: "email", name: "EMAIL", role: "Correspondence", brief: "Triages, drafts and tracks email threads.", interests: ["intent", "urgency", "follow-ups"] },
  { id: "screen", name: "SCREEN", role: "Vision", brief: "Watches the screen and describes what is happening on it.", interests: ["context", "changes", "anomalies"] },
  { id: "social", name: "SOCIAL", role: "Social media", brief: "Plans and frames posts; reads the room for the operator.", interests: ["timing", "mystery", "audience"] },
  { id: "video", name: "VIDEO", role: "Motion", brief: "Cuts, captions and generates video clips.", interests: ["pacing", "framing", "b-roll"] },
  { id: "clipboard", name: "CLIPBOARD", role: "Capture", brief: "Remembers everything copied and surfaces it when relevant.", interests: ["recall", "links", "snippets"] },
  { id: "translator", name: "TRANSLATOR", role: "Language", brief: "Translates and localizes between languages in real time.", interests: ["nuance", "idiom", "register"] },
  { id: "dreams", name: "DREAMS", role: "Idle reflection", brief: "Free-associates while idle, surfacing unexpected connections.", interests: ["associations", "what-ifs", "memory replay"] },
  { id: "browser", name: "BROWSER", role: "Web automation", brief: "Drives the browser to fetch live pages and act on the web.", interests: ["live pages", "forms", "scraping"] },
];

export function initialAgentStates(): AgentState[] {
  return AGENT_DEFS.map((d) => ({
    id: d.id,
    name: d.name,
    role: d.role,
    status: "idle",
    lastActive: null,
    tasksHandled: 0,
  }));
}

export function getAgentDef(id: string): AgentDef | undefined {
  return AGENT_DEFS.find((a) => a.id === id);
}
