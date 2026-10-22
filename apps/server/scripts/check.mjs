import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

for (const name of ['index', 'worker', 'devices']) {
  execFileSync(process.execPath, ['--check', fileURLToPath(new URL(`../src/${name}.mjs`, import.meta.url))], { stdio: 'inherit', windowsHide: true });
}
