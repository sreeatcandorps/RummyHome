import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (command) => {
  console.log(`\n> ${command}`);
  execSync(command, { cwd: rootDir, stdio: 'inherit' });
};

const startedAt = new Date().toISOString();
console.log(`Nightly test run started at ${startedAt}`);

try {
  run('npm run validate:env');
  run('npm run typecheck');
  run('npm test');
  run('node scripts/supabase-smoke.mjs');
  run('node scripts/game-flow-smoke.mjs');
  console.log(`\nNightly test run passed at ${new Date().toISOString()}`);
} catch (error) {
  console.error(`\nNightly test run failed at ${new Date().toISOString()}`);
  process.exit(1);
}
