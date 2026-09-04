import { expect } from 'chai';
import fs from 'node:fs';
import path from 'node:path';

// Regression guard for DRK-1038/1049: a zero-arg `.catch()` swallows nothing and
// silently propagates the rejection while reading as "tolerate this failure" — the
// exact bug class this cycle fixes. Every call site must be explicit: either a
// handler that tolerates+warns, or no `.catch()` at all so the rejection propagates.
describe('src/ regression: no zero-arg .catch()', () => {
  it('has no bare .catch() call sites left in src/', () => {
    const srcRoot = path.resolve(__dirname, '..', 'src');
    const hits: string[] = [];

    for (const entry of fs.readdirSync(srcRoot, { recursive: true }) as string[]) {
      if (!entry.endsWith('.ts')) continue;
      const filePath = path.join(srcRoot, entry);
      if (!fs.statSync(filePath).isFile()) continue;

      const lines = fs.readFileSync(filePath, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (line.includes('.catch()')) hits.push(`${entry}:${i + 1}:${line}`);
      });
    }

    expect(hits, `found zero-arg .catch() call site(s):\n${hits.join('\n')}`).to.have.lengthOf(0);
  });
});
