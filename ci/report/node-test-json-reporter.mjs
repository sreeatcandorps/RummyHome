// Custom node:test reporter: one JSON object per line, one line per test, with the file it came from.
// (The built-in junit reporter does not record which file a test belongs to, and the report groups
// tests by file → product workflow.)
//
//   node --import tsx --test --test-reporter=../ci/report/node-test-json-reporter.mjs \
//        --test-reporter-destination=../ci/out/unit/tests.jsonl tests/*.test.ts
import path from 'node:path';

export default async function* jsonLines(source) {
  for await (const event of source) {
    if (event.type !== 'test:pass' && event.type !== 'test:fail') continue;
    const d = event.data;
    if (!d.file) continue;                              // runner-level bookkeeping
    if (d.details?.type === 'suite') continue;          // describe() wrappers
    if (path.resolve(d.name) === path.resolve(d.file)) continue; // the per-file pseudo test
    const row = {
      file: path.relative(process.cwd(), d.file).split(path.sep).join('/'),
      name: d.name,
      status: event.type === 'test:fail' ? 'fail' : d.skip ? 'skip' : d.todo ? 'todo' : 'pass',
      durationMs: d.details?.duration_ms ?? null,
    };
    if (event.type === 'test:fail') {
      const err = d.details?.error;
      row.error = err ? (err.cause?.message ?? err.message ?? String(err)) : 'failed';
    }
    yield `${JSON.stringify(row)}\n`;
  }
}
