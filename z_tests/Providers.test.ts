import assert from 'node:assert/strict';
import * as forge from 'node-forge';
import { buildNetworkAcls } from '../src/VaultNetwork';
import { generatePGP } from '../src/PGPGenerator';
import { generateSshKeys } from '../src/SshKeyGenerator';

describe('VaultNetwork.buildNetworkAcls', () => {
  it('removes the last owned IP (used to be skipped, leaving the rule behind)', () => {
    const acls = buildNetworkAcls(
      { defaultAction: 'Deny', ipRules: [{ value: '1.1.1.1' }] },
      { ipAddresses: ['1.1.1.1'] },
      {},
    );
    assert.deepEqual(acls?.ipRules, []);
  });

  it('keeps rules managed elsewhere and adds new ones sorted', () => {
    const acls = buildNetworkAcls(
      { defaultAction: 'Deny', ipRules: [{ value: '9.9.9.9' }] },
      {},
      { ipAddresses: ['2.2.2.2'] },
    );
    assert.deepEqual(acls?.ipRules, [{ value: '2.2.2.2' }, { value: '9.9.9.9' }]);
  });

  it('leaves a vault without ACLs untouched when there is nothing to add', () => {
    assert.equal(buildNetworkAcls(undefined, { ipAddresses: ['1.1.1.1'] }, {}), undefined);
  });

  it('defaults to Deny when creating ACLs so the rules actually restrict access', () => {
    const acls = buildNetworkAcls(undefined, {}, { ipAddresses: ['1.1.1.1'] });
    assert.equal(acls?.defaultAction, 'Deny');
  });
});

describe('PGPGenerator', () => {
  it('expires the key after validDays', async () => {
    const { readKey } = await import('openpgp');
    const { publicKey } = await generatePGP({
      user: { name: 'test', email: 'test@example.com' },
      type: 'ecc',
      validDays: 10,
    });
    const expires = (await (await readKey({ armoredKey: publicKey })).getExpirationTime()) as Date;
    const days = (expires.getTime() - Date.now()) / 86_400_000;
    assert.ok(days > 9.9 && days <= 10, `expected ~10 days, got ${days}`);
  });
});

describe('SshKeyGenerator', () => {
  it('encrypts the private key with the password', async () => {
    const { publicKey, privateKey } = await generateSshKeys('p@ss');
    assert.match(publicKey, /^ssh-rsa /);
    assert.match(privateKey, /ENCRYPTED/);
    assert.ok(forge.pki.decryptRsaPrivateKey(privateKey, 'p@ss'));
    // A wrong password either returns null or fails ASN.1 parsing, depending on the garbage produced.
    let wrong: unknown = null;
    try {
      wrong = forge.pki.decryptRsaPrivateKey(privateKey, 'wrong');
    } catch {
      /* expected */
    }
    assert.equal(wrong, null);
  });
});
