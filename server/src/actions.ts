import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { imageServer } from "./imageserver.js";

const execAsync = promisify(exec);

async function hasFfmpeg(): Promise<boolean> {
  try {
    await execAsync("ffmpeg -version", { timeout: 4000 });
    return true;
  } catch {
    return false;
  }
}

export interface ActionResult {
  ok: boolean;
  summary: string; // short, human/LLM readable
  data?: unknown; // structured payload (file list, content, etc.)
  imageUrl?: string; // for screen captures / generated images
  videoUrl?: string; // for generated video clips
}

export interface ActionDef {
  name: string;
  agent: string; // which agent owns this capability
  description: string; // shown to the model for tool selection
  params: Record<string, string>; // name -> description
  run: (args: Record<string, string>) => Promise<ActionResult>;
}

// --- path safety: keep file actions inside the workspace ------------------

function resolveInWorkspace(p: string): string {
  const expanded = p.startsWith("~") ? path.join(config.workspace, p.slice(1)) : p;
  const abs = path.isAbsolute(expanded) ? expanded : path.join(config.workspace, expanded);
  const norm = path.normalize(abs);
  if (norm !== config.workspace && !norm.startsWith(config.workspace + path.sep)) {
    throw new Error(`path is outside the workspace (${config.workspace})`);
  }
  return norm;
}

function clip(s: string): string {
  return s.length > config.maxActionBytes ? s.slice(0, config.maxActionBytes) + "\n…[truncated]" : s;
}

const isMac = process.platform === "darwin";

// --- the capabilities -----------------------------------------------------

export const ACTIONS: ActionDef[] = [
  {
    name: "file_list",
    agent: "filemgr",
    description: "List files and folders in a directory.",
    params: { dir: "directory path (relative to workspace or absolute within it)" },
    run: async ({ dir }) => {
      const target = resolveInWorkspace(dir || ".");
      const entries = await fs.readdir(target, { withFileTypes: true });
      const list = entries.map((e) => (e.isDirectory() ? e.name + "/" : e.name)).sort();
      return { ok: true, summary: `${list.length} item(s) in ${target}`, data: list.slice(0, 200) };
    },
  },
  {
    name: "file_read",
    agent: "filemgr",
    description: "Read the contents of a text file.",
    params: { path: "file path" },
    run: async ({ path: p }) => {
      const target = resolveInWorkspace(p);
      const content = await fs.readFile(target, "utf8");
      return { ok: true, summary: `Read ${target} (${content.length} chars)`, data: clip(content) };
    },
  },
  {
    name: "file_write",
    agent: "filemgr",
    description: "Write text to a file, creating or overwriting it.",
    params: { path: "file path", content: "text to write" },
    run: async ({ path: p, content }) => {
      const target = resolveInWorkspace(p);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content ?? "", "utf8");
      return { ok: true, summary: `Wrote ${target} (${(content ?? "").length} chars)` };
    },
  },
  {
    name: "file_search",
    agent: "filemgr",
    description: "Search file names under a directory for a query string.",
    params: { query: "text to search for in file names", dir: "directory to search (optional)" },
    run: async ({ query, dir }) => {
      const root = resolveInWorkspace(dir || ".");
      const hits: string[] = [];
      const walk = async (d: string, depth: number) => {
        if (depth > 4 || hits.length >= 100) return;
        let entries;
        try {
          entries = await fs.readdir(d, { withFileTypes: true });
        } catch {
          return;
        }
        for (const e of entries) {
          if (e.name.startsWith(".") || e.name === "node_modules") continue;
          const full = path.join(d, e.name);
          if (e.name.toLowerCase().includes(query.toLowerCase())) hits.push(full);
          if (e.isDirectory()) await walk(full, depth + 1);
        }
      };
      await walk(root, 0);
      return { ok: true, summary: `${hits.length} match(es) for "${query}"`, data: hits };
    },
  },
  {
    name: "web_fetch",
    agent: "research",
    description: "Fetch a web page and return its title and readable text.",
    params: { url: "the URL to fetch (must start with http)" },
    run: async ({ url }) => {
      if (!/^https?:\/\//i.test(url)) throw new Error("url must start with http(s)://");
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "ECHO/1.0" } });
      clearTimeout(t);
      const html = await res.text();
      const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? "(no title)";
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return { ok: true, summary: `Fetched "${title}" (${res.status})`, data: { title, text: clip(text) } };
    },
  },
  {
    name: "shell_run",
    agent: "code",
    description: "Run a shell command on the Mac and return its output.",
    params: { command: "the shell command to execute" },
    run: async ({ command }) => {
      if (!config.allowShell) return { ok: false, summary: "Shell access is disabled (ECHO_ALLOW_SHELL=0)." };
      try {
        const { stdout, stderr } = await execAsync(command, {
          timeout: config.shellTimeoutMs,
          maxBuffer: 1024 * 1024,
          cwd: config.workspace,
        });
        const out = (stdout || stderr || "(no output)").trim();
        return { ok: true, summary: `$ ${command}`, data: clip(out) };
      } catch (err) {
        const e = err as { stderr?: string; message?: string };
        return { ok: false, summary: `Command failed: ${command}`, data: clip(e.stderr || e.message || "error") };
      }
    },
  },
  {
    name: "clipboard_read",
    agent: "clipboard",
    description: "Read the current contents of the system clipboard.",
    params: {},
    run: async () => {
      const cmd = isMac ? "pbpaste" : "xclip -selection clipboard -o";
      const { stdout } = await execAsync(cmd, { maxBuffer: 1024 * 256 });
      return { ok: true, summary: "Read clipboard", data: clip(stdout) };
    },
  },
  {
    name: "clipboard_write",
    agent: "clipboard",
    description: "Put text onto the system clipboard.",
    params: { text: "text to copy" },
    run: async ({ text }) => {
      const cmd = isMac ? "pbcopy" : "xclip -selection clipboard";
      await new Promise<void>((resolve, reject) => {
        const child = exec(cmd, (e) => (e ? reject(e) : resolve()));
        child.stdin?.end(text ?? "");
      });
      return { ok: true, summary: "Copied to clipboard" };
    },
  },
  {
    name: "screen_capture",
    agent: "screen",
    description: "Take a screenshot of the Mac screen and return an image link.",
    params: {},
    run: async () => {
      const dir = path.join(config.workspace, ".echo", "shots");
      await fs.mkdir(dir, { recursive: true });
      const file = path.join(dir, `screen-${Date.now()}.png`);
      if (isMac) {
        await execAsync(`screencapture -x "${file}"`, { timeout: 10000 });
      } else {
        return { ok: false, summary: "Screen capture is only wired for macOS." };
      }
      return { ok: true, summary: "Captured the screen", imageUrl: `/shots/${path.basename(file)}`, data: file };
    },
  },
  {
    name: "open_target",
    agent: "browser",
    description: "Open a URL, file, or application on the Mac.",
    params: { target: "a URL, file path, or app name" },
    run: async ({ target }) => {
      if (!isMac) return { ok: false, summary: "Open is only wired for macOS." };
      const arg = /^https?:\/\//i.test(target) || target.startsWith("/") ? target : `-a "${target}"`;
      await execAsync(`open ${arg}`, { timeout: 8000 });
      return { ok: true, summary: `Opened ${target}` };
    },
  },
  {
    name: "generate_image",
    agent: "image",
    description: "Generate an uncensored image from a text prompt using the local image server.",
    params: { prompt: "a description of the image to create" },
    run: async ({ prompt }) => {
      if (!prompt?.trim()) return { ok: false, summary: "Give me something to picture, sir." };
      if (!(await imageServer.health()))
        return { ok: false, summary: "Image server offline — start Stable Diffusion (Automatic1111/Forge) on :7860." };
      const buf = await imageServer.txt2img(prompt);
      const dir = shotsDir();
      await fs.mkdir(dir, { recursive: true });
      const name = `img-${Date.now()}.png`;
      await fs.writeFile(path.join(dir, name), buf);
      return { ok: true, summary: `Generated an image: "${prompt}"`, imageUrl: `/shots/${name}` };
    },
  },
  {
    name: "generate_video",
    agent: "video",
    description: "Generate a short uncensored video clip from a text prompt (local frames stitched with ffmpeg).",
    params: { prompt: "a description of the clip to create" },
    run: async ({ prompt }) => {
      if (!prompt?.trim()) return { ok: false, summary: "Give me something to film, sir." };
      if (!(await imageServer.health()))
        return { ok: false, summary: "Image server offline — start Stable Diffusion on :7860." };
      if (!(await hasFfmpeg()))
        return { ok: false, summary: "ffmpeg not found — install it (brew install ffmpeg) so I can assemble video." };

      const dir = shotsDir();
      const work = path.join(dir, `vwork-${Date.now()}`);
      await fs.mkdir(work, { recursive: true });
      const frames = Math.max(8, Math.min(60, config.videoFrames));
      // Latent-interpolate between two seeds for a coherent morphing clip.
      const seed = Math.floor(Math.random() * 1e9);
      const subseed = seed + 1;
      for (let i = 0; i < frames; i++) {
        const buf = await imageServer.txt2img(prompt, { seed, subseed, subseedStrength: i / (frames - 1) });
        await fs.writeFile(path.join(work, `f-${String(i).padStart(3, "0")}.png`), buf);
      }
      const out = `vid-${Date.now()}.mp4`;
      await execAsync(
        `ffmpeg -y -framerate ${config.videoFps} -i "${path.join(work, "f-%03d.png")}" -c:v libx264 -pix_fmt yuv420p "${path.join(dir, out)}"`,
        { timeout: 120000 }
      );
      await fs.rm(work, { recursive: true, force: true });
      return { ok: true, summary: `Generated a ${frames}-frame clip: "${prompt}"`, videoUrl: `/shots/${out}` };
    },
  },
];

export function getAction(name: string): ActionDef | undefined {
  return ACTIONS.find((a) => a.name === name);
}

/** Where screen captures live, so the server can serve them statically. */
export function shotsDir(): string {
  return path.join(config.workspace, ".echo", "shots");
}
