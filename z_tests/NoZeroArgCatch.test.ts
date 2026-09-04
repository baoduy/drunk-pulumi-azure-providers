import { expect } from 'chai';
import { execSync } from 'node:child_process';
import path from 'node:path';

// Regression guard for DRK-1038/1049: a zero-arg `.catch()` swallows nothing and
// silently propagates the rejection while reading as "tolerate this failure" — the
// exact bug class this cycle fixes. Every call site must be explicit: either a
// handler that tolerates+warns, or no `.catch()` at all so the rejection propagates.
describe('src/ regression: no zero-arg .catch()', () => {
  it('has no bare .catch() call sites left in src/', () => {
    const repoRoot = path.resolve(__dirname, '..');
    let output = '';
    try {
      // grep exits 1 (no matches) on success for this check; that's the passing case.
      output = execSync('grep -rn "\\.catch()" src/', {
        cwd: repoRoot,
        encoding: 'utf8',
      });
    } catch (err: any) {
      if (err.status === 1) return; // no matches found — guard holds
      throw err;
    }
    expect.fail(`found zero-arg .catch() call site(s):\n${output}`);
  });
});
