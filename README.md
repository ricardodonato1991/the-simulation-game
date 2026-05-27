# ECHO

A local, uncensored, **self-learning** AI for **Ricardo Donato** — built to run on your
own Mac, command a roster of specialized agents, and get smarter every hour by learning
from you and the internet. No cloud, no leash.

At the center of the HUD is **ECHO's brain**: a 3D point-cloud of a human brain (Three.js)
whose neurons fire and whose activity rises and falls with what ECHO is actually doing —
listening, thinking, speaking, learning.

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
# install Ollama from https://ollama.com, then pull an uncensored local model
ollama pull dolphin-mistral
```

With Ollama running, ECHO's replies and some of its learning become genuinely
model-driven. Everything is processed locally.

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
| Clipboard       | `read the clipboard`, `copy hello to clipboard` |
| Open            | `open https://github.com`, `open Spotify`    |

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

## How the learning works

Every command you give ECHO, every insight an agent surfaces, and ECHO's own idle
reflection get distilled and written to `server/data/memory.json`. That knowledge index
feeds back into ECHO's context on the next exchange and drives the **EVOLUTION** meter —
so ECHO genuinely accumulates and reuses what it learns across restarts.

> `server/data/` is git-ignored: ECHO's memory is private and local to each machine.
