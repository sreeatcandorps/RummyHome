import fs from 'node:fs';
const map = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const by = new Map();
map.sources.forEach((src, i) => {
  const content = map.sourcesContent?.[i] ?? '';
  let key;
  const m = src.match(/node_modules\/((@[^/]+\/)?[^/]+)/g);
  if (m) key = m[m.length - 1].replace('node_modules/', '');
  else if (src.includes('rummy-home3/')) key = 'APP:' + src.split('rummy-home3/')[1].split('/').slice(0, 1).join('/');
  else key = src.split('/').slice(0, 2).join('/');
  by.set(key, (by.get(key) ?? 0) + content.length);
});
const total = [...by.values()].reduce((a, b) => a + b, 0);
console.log('total source chars', total);
[...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).forEach(([k, v]) => console.log(String(v).padStart(9), (100 * v / total).toFixed(1).padStart(5) + '%', k));
