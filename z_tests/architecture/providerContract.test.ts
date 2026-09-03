import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Architecture tests produced by the monthly architecture review (DRK-1037).
 *
 * This is the first test in this repo — `z_tests/` did not exist, so the four mocha
 * scripts in package.json matched nothing and `pnpm test` passed vacuously
 * (DRK-1046). These tests scan production source text; they construct no Pulumi
 * resources and hit no Azure endpoint, so they run anywhere with no credentials.
 */

const srcDir = path.resolve(__dirname, '../../src');

const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && full.endsWith('.ts') ? [full] : [];
  });

const relative = (file: string) => path.relative(srcDir, file).split(path.sep).join('/');

describe('PULUMI-PROV-002 — dynamic-provider error handling', () => {
  /**
   * Tier 2 (baseline).
   *
   * `promise.catch()` with no handler is `promise.then(undefined, undefined)`: it
   * does not swallow the rejection, it forwards it. Every occurrence reads as
   * "tolerate this failure" and does the opposite — so on the Key Vault delete and
   * secret-rename paths a transient 429 or a missing `secrets/delete` permission
   * aborts an update whose Key Vault write has already succeeded, leaving state and
   * Key Vault divergent.
   *
   * Write the intent explicitly instead: `.catch((e) => { ... })` to tolerate, or no
   * `.catch()` at all to let Pulumi surface the failure.
   *
   * KNOWN_VIOLATIONS records today's count per file and MUST ONLY SHRINK. Counting
   * rather than listing filenames means a *new* zero-arg `.catch()` added to an
   * already-listed file still fails the test.
   */
  const KNOWN_VIOLATIONS: Record<string, number> = {
    // DRK-1038 [A1037-1]
    'ApimSignInSettings.ts': 1,
    'ApimSignUpSettings.ts': 1,
    'AzBase/KeyVaultBase.ts': 3,
    'VaultCert.ts': 1,
    'VaultKey.ts': 1,
    'VaultSecret.ts': 2,
  };

  const zeroArgCatch = /\.catch\(\s*\)/g;

  const counts: Record<string, number> = {};
  for (const file of walk(srcDir)) {
    const found = fs.readFileSync(file, 'utf8').match(zeroArgCatch);
    if (found) counts[relative(file)] = found.length;
  }

  it('has no zero-argument .catch() outside the shrinking baseline', () => {
    const unexpected = Object.entries(counts)
      .filter(([file, n]) => n > (KNOWN_VIOLATIONS[file] ?? 0))
      .map(([file, n]) => `${file} (${n}, baseline ${KNOWN_VIOLATIONS[file] ?? 0})`);

    assert.deepStrictEqual(
      unexpected,
      [],
      'Zero-argument `.catch()` is a no-op: it forwards the rejection instead of ' +
        'swallowing it, so code that reads as tolerating a failure actually aborts on ' +
        'it. Use `.catch((e) => { ... })` to tolerate, or drop the `.catch()` to let ' +
        'Pulumi surface the error. New or increased offenders: ' + unexpected.join(', '),
    );
  });

  it('keeps the baseline shrinking — no stale allow-list entries', () => {
    const stale = Object.entries(KNOWN_VIOLATIONS)
      .filter(([file, n]) => (counts[file] ?? 0) < n)
      .map(([file, n]) => `${file} (now ${counts[file] ?? 0}, baseline ${n})`);

    assert.deepStrictEqual(
      stale,
      [],
      'These KNOWN_VIOLATIONS entries are higher than the real count. Lower or delete ' +
        'them so the baseline reflects reality and keeps shrinking: ' + stale.join(', '),
    );
  });
});

describe('PULUMI-UP-003 — no dated azure-native API-version imports', () => {
  /**
   * Tier 1 — clean today, and this keeps it that way. A dated module such as
   * `@pulumi/azure-native/keyvault/v20200101` freezes the resource at that API
   * version, so every later upstream hardening default silently stops arriving.
   */
  it('pins no dated `@pulumi/azure-native/**/vYYYYMMDD` module', () => {
    const dated = /@pulumi\/azure-native\/[^'"`]*\/v\d{8}/;

    const offenders = walk(srcDir)
      .filter((file) => dated.test(fs.readFileSync(file, 'utf8')))
      .map(relative);

    assert.deepStrictEqual(
      offenders,
      [],
      'Dated @pulumi/azure-native API-version imports freeze a resource at one API ' +
        'version and miss every later provider hardening default. Use the default ' +
        'latest-stable module. Offenders: ' + offenders.join(', '),
    );
  });
});
