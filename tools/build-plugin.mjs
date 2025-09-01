import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const pluginDir = path.resolve(__dirname, '..', 'plugin');
const distDir = path.resolve(__dirname, '..', 'dist');
const manifest = JSON.parse(fs.readFileSync(path.join(pluginDir, 'manifest.json'), 'utf-8'));
const outName = `racecondition-plugin-agent-v${manifest.version}.zip`;

fs.mkdirSync(distDir, { recursive: true });
const zip = new AdmZip();
function addDir(basePath, rel='') {
  const curr = path.join(basePath, rel);
  const entries = fs.readdirSync(curr, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(curr, e.name);
    const relPath = path.join(rel, e.name);
    if (e.isDirectory()) addDir(basePath, relPath);
    else zip.addLocalFile(full, path.dirname(relPath));
  }
}
addDir(pluginDir);
zip.writeZip(path.join(distDir, outName));
console.log(`[+] Built ${outName} in dist/`);
