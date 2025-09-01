# Race Condition Plugin (agent-mode) — Buildable

This repo lets you build the **plugin** to `dist/` and compile/copy the **Go agent** to `plugin/assets/bin/` using `pnpm` and `go`.

## Structure

```
racecondition-plugin-src/
  plugin/
    manifest.json
    frontend/
    backend/
    assets/bin/         # Agent binaries are copied here
  tools/
    build-plugin.mjs    # Bundles plugin/ -> dist/*.zip
    copy-agent.mjs      # Copies agent binary to assets/bin/
    build-agent.mjs     # Builds the agent for multiple platforms -> agent-build/
  agent-src/            # (optional) place the Go agent source code here (main.go)
  dist/                 # Plugin zip output here
  agent-build/          # Multi-platform agent build output here
  package.json
```

-----

## Requirements

  - Node 18+ and `pnpm`
  - Go 1.20+ (if you're building the agent)

## Install deps

```bash
pnpm install
```

-----

## Option A: Copy a pre-compiled agent binary

1.  Compile the agent yourself or use an existing one.
2.  Copy its absolute path into the `RC_AGENT_BIN` environment variable and run:

<!-- end list -->

```bash
RC_AGENT_BIN=/path/to/rcsp-h1-agent pnpm build:all
```

This will **copy** the binary to `plugin/assets/bin/` and then **generate** the zip in `dist/`.

-----

## Option B: Build the agent from `agent-src/` and bundle

1.  Place the agent's Go code in `agent-src/` (the `main.go` file).
2.  Run:

<!-- end list -->

```bash
pnpm agent:build
pnpm build          # Bundles the plugin to dist/
```

or in one step:

```bash
pnpm build:agent-all
```

-----

## Option C: Just bundle the plugin (no agent)

```bash
pnpm build
```

> If no binary exists in `assets/bin/`, the plugin will still work in **external** agent mode (URL is configurable within the plugin).

-----

## What the plugin includes

  - **Run single‑packet (Agent)**: concatenates N requests and sends them in a single write.
  - **Run parallel (Agent)**: opens N connections and fires everything at once (useful when the server rejects pipelining).
  - **SSE logs**, start/end **toasts**, and a **results table**. Row selection to view **RAW Request/Response**; right-click for **Copy RAW both**.
  - **Timeout (ms)** and **Retries** fields in the top bar.

-----

## Usage within Caido

1.  In Caido → **Plugins** → **Install from Zip** → choose the zip from `dist/`.
2.  Open **Plugins → Race Condition**.
3.  **Connect** to the agent (defaults to `http://127.0.0.1:8766`).
4.  Add requests to the **Queue** from History/Replay (Add to Race queue).
5.  Execute **Run single‑packet (Agent)** or **Run parallel (Agent)**.
6.  Check the table and select a row to see the **RAW** data. Use the context menu's **Copy RAW both**.

## Racing Tip

  - If `Pipelined < Count`, the server does not accept pipelining. Use the **Parallel** button.
  - Keep the same host:port:TLS and consistent headers throughout the queue.

-----

## Auto-starting the agent from the plugin

  - **Start agent** button: the plugin backend `spawns` the `plugin/assets/bin/rcsp-h1-agent` binary (or `.exe` on Windows) and waits \~600ms for it to come up on `127.0.0.1:8766`. You can then press **Connect**, or it will connect automatically.
  - **Stop agent** button: sends a `kill` signal to the process launched from the plugin.

> Make sure to include the binary inside the final zip (use `pnpm agent:copy` or `RC_AGENT_BIN=... pnpm build:all`).

-----

### v2.3.0

  - **Bundle-all-hosts**: scripts to compile and bundle agent binaries for darwin/linux/windows into `assets/bin/`.
  - Backend tries several paths (`-<platform>-<arch>`, `-<platform>`, generic) and picks the one that works.
