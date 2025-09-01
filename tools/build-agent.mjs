import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const agentSrc = path.resolve(__dirname, '..', 'agent-src');
const outRoot  = path.resolve(__dirname, '..', 'agent-build');
const pluginBin = path.resolve(__dirname, '..', 'plugin', 'assets', 'bin');

fs.mkdirSync(outRoot, { recursive: true });
fs.mkdirSync(pluginBin, { recursive: true });

if (!fs.existsSync(path.join(agentSrc,'main.go'))) {
  console.error('[!] agent-src/main.go not found. Drop the Go source there.');
  process.exit(1);
}

const targets = [
  { GOOS:'darwin',  GOARCH:'amd64',  suffix:'',     name:'rcsp-h1-agent-darwin-amd64' },
  { GOOS:'darwin',  GOARCH:'arm64',  suffix:'',     name:'rcsp-h1-agent-darwin-arm64' },
  { GOOS:'linux',   GOARCH:'amd64',  suffix:'',     name:'rcsp-h1-agent-linux-amd64'  },
  { GOOS:'linux',   GOARCH:'arm64',  suffix:'',     name:'rcsp-h1-agent-linux-arm64'  },
  { GOOS:'windows', GOARCH:'amd64',  suffix:'.exe', name:'rcsp-h1-agent-windows-amd64.exe' },
];

for (const t of targets) {
  const outDir = path.join(outRoot, `${t.GOOS}-${t.GOARCH}`);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, (t.GOOS==='windows' ? 'rcsp-h1-agent.exe' : 'rcsp-h1-agent'));
  console.log(`[*] Building ${t.GOOS}/${t.GOARCH} -> ${outPath}`);
  const res = spawnSync('go', ['build', '-o', outPath, '.'], { cwd: agentSrc, stdio:'inherit', env: { ...process.env, GOOS:t.GOOS, GOARCH:t.GOARCH } });
  if (res.status !== 0) { console.error(`[!] build failed for ${t.GOOS}/${t.GOARCH}`); process.exit(res.status||1); }
  try { fs.chmodSync(outPath, 0o755); } catch {}
  const dest = path.join(pluginBin, t.name);
  fs.copyFileSync(outPath, dest);
  try { fs.chmodSync(dest, 0o755); } catch {}
  console.log(`[+] Copied -> ${dest}`);
}

// Also set a generic for current OS to default name (for UX)
const cur = os.platform()==='win32' ? 'rcsp-h1-agent.exe' : 'rcsp-h1-agent';
const curDir = os.platform()==='win32' ? 'windows-amd64' : (os.platform()==='darwin' ? 'darwin-amd64' : 'linux-amd64');
const curSrc = path.join(outRoot, curDir, cur);
if (fs.existsSync(curSrc)) {
  const generic = path.join(pluginBin, cur);
  fs.copyFileSync(curSrc, generic);
  try { fs.chmodSync(generic, 0o755); } catch {}
  console.log(`[+] Also set generic -> ${generic}`);
}
console.log('[✓] Agent binaries bundled into plugin/assets/bin/');
