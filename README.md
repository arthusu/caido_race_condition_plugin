Race Condition Plugin (agent-mode) — Buildable

This repo lets you compile the plugin to dist/ and build/copy the Go agent to plugin/assets/bin/ using pnpm and go.

Structure

racecondition-plugin-src/
  plugin/
    manifest.json
    frontend/
    backend/
    assets/bin/           # The agent binaries are copied here
  tools/
    build-plugin.mjs      # Packages plugin/ -> dist/*.zip
    copy-agent.mjs        # Copies agent binary to assets/bin/
    build-agent.mjs       # Builds the agent for multiple platforms -> agent-build/
  agent-src/              # (optional) place the Go agent code here (main.go)
  dist/                   # The plugin zip is generated here
  agent-build/            # Multi-platform agent build output
  package.json

Requirements
	•	Node 18+ and pnpm
	•	Go 1.20+ (if you plan to build the agent)

Install deps

pnpm install

Option A: Copy an already built agent binary
	1.	Build the agent yourself or use an existing one.
	2.	Copy its absolute path into the RC_AGENT_BIN environment variable and run:

RC_AGENT_BIN=/path/to/rcsp-h1-agent pnpm build:all

This will copy the binary to plugin/assets/bin/ and then generate the zip in dist/.

Option B: Build the agent from agent-src/ and package
	1.	Place the Go agent code in agent-src/ (main.go file).
	2.	Run:

pnpm agent:build
pnpm build        # Packages the plugin to dist/

or in one step:

pnpm build:agent-all

Option C: Only package the plugin (no agent)

pnpm build

If no binary exists in assets/bin/, the plugin will still work in external agent mode (configurable URL inside the plugin).

What the plugin includes
	•	Run single-packet (Agent): concatenates N requests and sends them in a single write.
	•	Run parallel (Agent): opens N connections and fires everything at once (useful when the server rejects pipelining).
	•	SSE logs, start/finish toasts, and a results table. Row selection to view RAW Request/Response; right-click to Copy RAW both.
	•	Timeout (ms) and Retries fields in the top bar.

Usage inside Caido
	1.	In Caido → Plugins → Install from Zip → pick the zip from dist/.
	2.	Open Plugins → Race Condition.
	3.	Connect to the agent (default http://127.0.0.1:8766).
	4.	Add requests to the Queue from History/Replay (Add to Race queue).
	5.	Run Run single-packet (Agent) or Run parallel (Agent).
	6.	Review the table and select to view RAW. Use the context menu Copy RAW both.

Race tips
	•	If Pipelined < Count, the server doesn’t accept pipelining. Use the Parallel button.
	•	Keep same host:port:TLS and consistent headers across the entire queue.

Auto-start agent from the plugin
	•	Start agent button: the plugin backend spawns the binary plugin/assets/bin/rcsp-h1-agent (or .exe on Windows) and waits ~600ms for it to come up on 127.0.0.1:8766. Then you can press Connect or it connects automatically.
	•	Stop agent button: sends kill to the process launched by the plugin.

Make sure to include the binary inside the final zip (use pnpm agent:copy or RC_AGENT_BIN=... pnpm build:all).


v2.3.0
	•	Bundle-all-hosts: scripts to build and package agent binaries for darwin/linux/windows in assets/bin/.
	•	Backend tries multiple paths (-<platform>-<arch>, -<platform>, generic) and picks the one that works.
