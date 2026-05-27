# ECHO

A local, uncensored, **self-learning** AI for **Ricardo Donato** — built to run on your
own Mac, command a roster of specialized agents, and get smarter every hour by learning
from you and the internet. No cloud, no leash.

At the center of the HUD is **ECHO's brain**: a 3D point-cloud of a human brain (Three.js)
that is genuinely *hers*. Different anatomical regions light up with what she's doing and
**how she feels** — the limbic/reward area glows with joy and pride, the amygdala flares
with frustration, the temporal lobes light when she listens, the visual cortex when she
sees your screen. As she learns, her brain grows denser and fires more — she evolves it,
and herself.

## Stack

- **client/** — React + Vite + TypeScript HUD. The brain is a procedural particle brain
  with bloom; the rest is a live cyberpunk dashboard fed over a WebSocket.
- **server/** — Node + Express + TypeScript core. Talks to a local **Ollama** model
  (`dolphin-mistral` by default), runs ECHO's boss persona, dispatches to agents, and
  folds every exchange into persistent memory on disk.

When Ollama is offline (e.g. a preview), the server falls back to an in-character
simulation so the whole system still feels alive.

## Run it

```bash
npm install          # installs both workspaces
npm run dev          # server on :3001, HUD on http://localhost:5173
```

Open http://localhost:5173 and talk to ECHO from the command bar.

### Give ECHO a real brain (on your Mac)

```bash
# install Ollama from https://ollama.com, then pull any uncensored local model(s)
ollama pull dolphin-mistral
ollama pull deepseek-r1
```

ECHO is **model-agnostic** — pull as many local models as you like and switch her brain
live from the **SETTINGS** panel (dolphin-mistral, DeepSeek, or any uncensored model in
Ollama). Her replies and reflections become genuinely model-driven.

### Fully offline

Once the models are pulled, ECHO needs **no internet** to think, act, or speak — Ollama,
the dashboard, her brain, and her actions all run locally on your Mac. (Only the `web_fetch`
action and browser-based speech-to-text reach out; everything else is local.)

### Feelings & self-evolution

ECHO has an emotional state — curiosity, pride, joy, focus, affection, frustration — that
shifts with how you treat her and what happens, decays toward calm over time, and drives
which brain regions light up. She also periodically turns inward and **evolves herself**,
reinforcing what serves you; her growth shows on the EVOLUTION meter and in a richer brain.

## Voice (speech in / speech out)

ECHO listens and talks back, using the browser's built-in speech engine (works in
Chrome on macOS):

- **Speak to ECHO** — hit the **🎤 SPEAK** button in the command bar and talk; your words
  are transcribed and sent as a command.
- **ECHO speaks back** — toggle **VOICE ON** in the status bar and ECHO reads every reply
  aloud.

## Actions (ECHO doing things on your Mac)

ECHO doesn't just talk — it acts. Ask in plain language and it routes to the right
capability (and lights up the owning agent):

| Capability      | Try saying…                                  |
| --------------- | -------------------------------------------- |
| Files           | `list files in ~/Documents`, `read file: notes.txt`, `write file: todo.txt with buy milk` |
| Search          | `search for invoice in ~/Downloads`          |
| Shell           | `run command: git status`  (or just `!git status`) |
| Web             | `fetch https://news.ycombinator.com`         |
| Screen          | `what's on my screen` (captures + shows it)  |
| **Images**      | `generate an image of a neon city at night` (uncensored) |
| **Video**       | `make a video of waves crashing` (uncensored)|
| Clipboard       | `read the clipboard`, `copy hello to clipboard` |
| Open            | `open https://github.com`, `open Spotify`    |

### Uncensored images & video

ECHO generates images and video **locally and uncensored** — no content filter is applied;
the model you load decides. You need a local Stable Diffusion server (the de-facto standard
[Automatic1111](https://github.com/AUTOMATIC1111/stable-diffusion-webui) or
[Forge](https://github.com/lllyasviel/stable-diffusion-webui-forge), launched with `--api`)
and `ffmpeg` for video:

```bash
# in your Stable Diffusion WebUI folder, expose the API:
./webui.sh --api          # serves on http://127.0.0.1:7860
brew install ffmpeg       # so ECHO can assemble video frames into a clip
```

Images come back from the **IMAGE** agent; video clips are built by the **VIDEO** agent
(short latent-interpolated clips assembled with ffmpeg) and play inline in the comm log.

When Ollama is running, ECHO can also pick the right action for fuzzier requests on its
own. File actions are scoped to a workspace and shell access can be disabled — see below.

## Configuration (env vars)

| Variable            | Default                   | Meaning                                    |
| ------------------- | ------------------------- | ------------------------------------------ |
| `ECHO_OPERATOR`     | `Ricardo Donato`          | The human ECHO answers to                  |
| `ECHO_MODEL`        | `dolphin-mistral`         | Local model ECHO runs on                   |
| `OLLAMA_URL`        | `http://127.0.0.1:11434`  | Local Ollama endpoint                      |
| `ECHO_PORT`         | `3001`                    | Core server port                           |
| `ECHO_WORKSPACE`    | your home directory       | Root that file actions are confined to     |
| `ECHO_ALLOW_SHELL`  | `1` (on)                  | Set to `0` to forbid ECHO running commands |
| `ECHO_SHELL_TIMEOUT`| `15000`                   | Max ms a shell command may run             |
| `ECHO_IMAGE_URL`    | `http://127.0.0.1:7860`   | Local Stable Diffusion (A1111/Forge) API   |
| `ECHO_IMAGE_W` / `ECHO_IMAGE_H` | `512`         | Generated image dimensions                 |
| `ECHO_VIDEO_FRAMES` | `24`                      | Frames per generated video clip            |
| `ECHO_VIDEO_FPS`    | `12`                      | Frame rate of generated clips              |

## How the learning works

Every command you give ECHO, every insight an agent surfaces, and ECHO's own idle
reflection get distilled and written to `server/data/memory.json`. That knowledge index
feeds back into ECHO's context on the next exchange and drives the **EVOLUTION** meter —
so ECHO genuinely accumulates and reuses what it learns across restarts.

> `server/data/` is git-ignored: ECHO's memory is private and local to each machine.
