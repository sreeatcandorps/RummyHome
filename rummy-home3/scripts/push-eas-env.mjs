/**
 * Push EXPO_PUBLIC_* values from .env.local into EAS environments.
 *
 * Prerequisites:
 *   npx eas-cli login
 *   npx eas-cli init   # once, if the project is not linked yet
 *
 * Usage:
 *   node scripts/push-eas-env.mjs
 *   node scripts/push-eas-env.mjs --environments production,preview,development
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadEnvFile(filename) {
  const filePath = path.join(root, filename);
  if (!fs.existsSync(filePath)) return {};

  const values = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    values[key] = value;
  }
  return values;
}

const args = process.argv.slice(2);
const envArg = args.find((arg) => arg.startsWith('--environments='));
const environments = (envArg?.split('=')[1] || 'production,preview,development')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const env = { ...loadEnvFile('.env'), ...loadEnvFile('.env.local') };
const required = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'];
const missing = required.filter((key) => !env[key]);

if (missing.length > 0) {
  console.error(`Missing required values in .env.local: ${missing.join(', ')}`);
  process.exit(1);
}

const whoami = spawnSync('npx', ['eas-cli', 'whoami'], {
  cwd: root,
  encoding: 'utf8',
  shell: true,
});

if (whoami.status !== 0 || /Not logged in/i.test(whoami.stdout + whoami.stderr)) {
  console.error('Log in first: npx eas-cli login');
  process.exit(1);
}

for (const environment of environments) {
  for (const key of required) {
    console.log(`Setting ${key} for ${environment}...`);
    const result = spawnSync(
      'npx',
      [
        'eas-cli',
        'env:create',
        '--name',
        key,
        '--value',
        env[key],
        '--environment',
        environment,
        '--visibility',
        'plaintext',
        '--force',
        '--non-interactive',
      ],
      {
        cwd: root,
        encoding: 'utf8',
        shell: true,
      },
    );

    if (result.status !== 0) {
      // Fall back for CLI versions that use env:set instead of env:create --force.
      const fallback = spawnSync(
        'npx',
        [
          'eas-cli',
          'env:set',
          '--name',
          key,
          '--value',
          env[key],
          '--environment',
          environment,
          '--visibility',
          'plaintext',
          '--non-interactive',
        ],
        {
          cwd: root,
          encoding: 'utf8',
          shell: true,
        },
      );

      if (fallback.status !== 0) {
        console.error(result.stderr || result.stdout || fallback.stderr || fallback.stdout);
        process.exit(fallback.status || result.status || 1);
      }
    }
  }
}

console.log(`EAS environment variables are set for: ${environments.join(', ')}`);
console.log('Next: npx eas-cli update:configure');
