// Roboto, the font Android draws the app in. It is not part of the repo (it is the phone's), so it is
// fetched once from Google Fonts and kept in a cache folder outside the checkout.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/roboto/Roboto%5Bwdth%2Cwght%5D.ttf';

export async function robotoPath() {
  const found = [process.env.ROBOTO_TTF, join(homedir(), '.fonts', 'Roboto-VF.ttf'), join(homedir(), '.cache', 'ezscore-themes', 'Roboto-VF.ttf')]
    .filter(Boolean)
    .find((p) => existsSync(p));
  if (found) return found;
  const dir = join(homedir(), '.cache', 'ezscore-themes');
  mkdirSync(dir, { recursive: true });
  const response = await fetch(URL);
  if (!response.ok) throw new Error(`Could not fetch Roboto (${response.status}). Set ROBOTO_TTF=/path/to/Roboto.ttf.`);
  const file = join(dir, 'Roboto-VF.ttf');
  writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  return file;
}
