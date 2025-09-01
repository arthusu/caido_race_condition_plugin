// Backend v2.2.1 (ESM) - auto-start agent
import { spawn } from 'child_process';
import * as path from 'path';

/** assets/bin/rcsp-h1-agent[.exe] resolved via sdk.meta.assetsPath() */
function resolveAgentPath(sdk){
  const base = sdk.meta.assetsPath();
  const plat = (sdk.os.platform && sdk.os.platform()) || 'unknown';
  const arch = (sdk.os.arch && sdk.os.arch()) || '';
  const exe = (plat === 'windows') ? '.exe' : '';
  const cand = [
    ['bin', `rcsp-h1-agent-${plat}-${arch}${exe}`],
    ['bin', `rcsp-h1-agent-${plat}${exe}`],
    ['bin', `rcsp-h1-agent${exe}`],
    ['bin', `rcsp-h1-agent`]
  ];
  return cand.map(parts => sdk.path.join(base, ...parts));
}

let agentProc = null;
let lastStdout = '';
let lastStderr = '';

async function startAgent(sdk, _opts={}){
  if (agentProc && !agentProc.killed) return { ok:true, message:'already_running', pid: agentProc.pid };
  lastStdout=''; lastStderr='';
  const candidates = resolveAgentPath(sdk);
  try {
    let spawned = false;
  let lastErr = null;
  for (const agent of candidates) {
    try {
      agentProc = spawn(agent, [], {
      cwd: path.dirname(agent),
      env: { ...sdk.env.all?.() },
      stdio: ['ignore','pipe','pipe'],
      detached: false,
    });
      agentProc.stdout.on('data', d => { lastStdout += String(d); });
      agentProc.stderr.on('data', d => { lastStderr += String(d); });
      spawned = true; lastErr = null; break;
    } catch(e){ lastErr = e; }
  }
  if (!spawned) { return { ok:false, message:'spawn_failed', error:String(lastErr||'not_found') }; }
  await new Promise(r=>setTimeout(r,700));
  return { ok:true, pid: agentProc.pid, stdout:lastStdout, stderr:lastStderr };
}

async function stopAgent(_sdk){
  if (!agentProc) return { ok:true, message:'not_running' };
  try { agentProc.kill(); } catch(e){ return { ok:false, message:'kill_failed', error:String(e) }; }
  agentProc = null;
  return { ok:true, message:'stopped' };
}

async function agentStatus(_sdk){
  return { ok:true, running: !!(agentProc && !agentProc.killed), pid: agentProc?.pid || null, stdout:lastStdout, stderr:lastStderr };
}

export async function init(sdk){
  sdk.api.register('startAgent', args => startAgent(sdk, args));
  sdk.api.register('stopAgent',  () => stopAgent(sdk));
  sdk.api.register('agentStatus',() => agentStatus(sdk));
}
