import fs from 'fs';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const pluginBin = path.resolve(__dirname, '..', 'plugin', 'assets', 'bin');
fs.mkdirSync(pluginBin, { recursive: true });

const binsEnv = process.env.RC_AGENT_BINS || process.env.RC_AGENT_BIN || '';
if (!binsEnv) {
  console.log('[!] RC_AGENT_BINS (or RC_AGENT_BIN) not set, skipping copy.');
  process.exit(0);
}
const parts = binsEnv.split(',').map(s=>s.trim()).filter(Boolean);
if (parts.length===0) { console.log('[!] No paths found in RC_AGENT_BINS'); process.exit(0); }

for (const p of parts) {
  if (!fs.existsSync(p)) { console.warn(`[!] Not found: ${p}`); continue; }
  const dst = path.join(pluginBin, path.basename(p));
  fs.copyFileSync(p, dst);
  try { fs.chmodSync(dst, 0o755); } catch {}
  console.log(`[+] Copied ${p} -> ${dst}`);
}
console.log('[✓] Agent binaries copied to plugin/assets/bin/');
