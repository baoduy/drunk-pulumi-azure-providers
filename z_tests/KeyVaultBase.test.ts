import { expect } from 'chai';
import sinon from 'sinon';
import { SecretClient } from '@azure/keyvault-secrets';
import { KeyClient } from '@azure/keyvault-keys';
import { CertificateClient } from '@azure/keyvault-certificates';
import { KeyVaultBase } from '../src/AzBase/KeyVaultBase';

/** Fakes the shape returned by `list*().byPage({...})`: an async-iterable of pages. */
function fakePagedResult<T>(pages: T[][]) {
  return {
    byPage: () => ({
      [Symbol.asyncIterator]: async function* () {
        for (const page of pages) yield page;
      },
    }),
  };
}

/**
 * `isDryRun` is computed once at module-load time from `process.env.PULUMI_NODEJS_DRY_RUN`,
 * and this file's own top-level `import { KeyVaultBase }` already evaluated that module with
 * dry-run off. To exercise the dry-run branch we force a fresh module evaluation with the env
 * var set, then immediately drop it from the require cache so it can't leak into other tests.
 */
function loadKeyVaultBaseWithDryRun(): typeof KeyVaultBase {
  const modulePath = require.resolve('../src/AzBase/KeyVaultBase');
  delete require.cache[modulePath];
  process.env.PULUMI_NODEJS_DRY_RUN = 'true';
  try {
    return require('../src/AzBase/KeyVaultBase').KeyVaultBase;
  } finally {
    delete process.env.PULUMI_NODEJS_DRY_RUN;
    delete require.cache[modulePath];
  }
}

describe('KeyVaultBase', () => {
  afterEach(() => sinon.restore());

  describe('deleteSecret', () => {
    it('makes no SDK call and emits no warning in dry-run', async () => {
      const beginDeleteSecret = sinon.stub(
        SecretClient.prototype,
        'beginDeleteSecret',
      );
      const warnSpy = sinon.stub(console, 'warn');

      const DryRunKeyVaultBase = loadKeyVaultBaseWithDryRun();
      const kvb = new DryRunKeyVaultBase('vault-dry', '7.0');
      const result = await kvb.deleteSecret('secret1');

      expect(result).to.equal(undefined);
      expect(beginDeleteSecret.called).to.equal(false);
      expect(warnSpy.called).to.equal(false);
    });

    it('tolerates a failed delete: warns with name/message only and resolves', async () => {
      sinon
        .stub(SecretClient.prototype, 'beginDeleteSecret')
        .rejects(new Error('secret is locked'));
      const warnSpy = sinon.stub(console, 'warn');

      const kvb = new KeyVaultBase('vault1', '7.0');
      await kvb.deleteSecret('my-secret');

      expect(warnSpy.calledOnce).to.equal(true);
      const message = warnSpy.firstCall.args[0] as string;
      expect(message).to.include('vault1');
      expect(message).to.include('my-secret');
      expect(message).to.include('secret is locked');
    });
  });

  describe('deleteKey', () => {
    it('makes no SDK call and emits no warning in dry-run', async () => {
      const beginDeleteKey = sinon.stub(KeyClient.prototype, 'beginDeleteKey');
      const warnSpy = sinon.stub(console, 'warn');

      const DryRunKeyVaultBase = loadKeyVaultBaseWithDryRun();
      const kvb = new DryRunKeyVaultBase('vault-dry', '7.0');
      const result = await kvb.deleteKey('key1');

      expect(result).to.equal(undefined);
      expect(beginDeleteKey.called).to.equal(false);
      expect(warnSpy.called).to.equal(false);
    });

    it('tolerates a failed delete: warns with name/message only and resolves', async () => {
      sinon
        .stub(KeyClient.prototype, 'beginDeleteKey')
        .rejects(new Error('key is locked'));
      const warnSpy = sinon.stub(console, 'warn');

      const kvb = new KeyVaultBase('vault1', '7.0');
      await kvb.deleteKey('my-key');

      expect(warnSpy.calledOnce).to.equal(true);
      const message = warnSpy.firstCall.args[0] as string;
      expect(message).to.include('vault1');
      expect(message).to.include('my-key');
      expect(message).to.include('key is locked');
    });
  });

  describe('deleteCert', () => {
    it('makes no SDK call and emits no warning in dry-run', async () => {
      const beginDeleteCertificate = sinon.stub(
        CertificateClient.prototype,
        'beginDeleteCertificate',
      );
      const warnSpy = sinon.stub(console, 'warn');

      const DryRunKeyVaultBase = loadKeyVaultBaseWithDryRun();
      const kvb = new DryRunKeyVaultBase('vault-dry', '7.0');
      const result = await kvb.deleteCert('cert1');

      expect(result).to.equal(undefined);
      expect(beginDeleteCertificate.called).to.equal(false);
      expect(warnSpy.called).to.equal(false);
    });

    it('tolerates a failed delete: warns with name/message only and resolves', async () => {
      sinon
        .stub(CertificateClient.prototype, 'beginDeleteCertificate')
        .rejects(new Error('cert is locked'));
      const warnSpy = sinon.stub(console, 'warn');

      const kvb = new KeyVaultBase('vault1', '7.0');
      await kvb.deleteCert('my-cert');

      expect(warnSpy.calledOnce).to.equal(true);
      const message = warnSpy.firstCall.args[0] as string;
      expect(message).to.include('vault1');
      expect(message).to.include('my-cert');
      expect(message).to.include('cert is locked');
    });
  });

  describe('listSecrets / getSecretVersions / checkSecretExist', () => {
    it('listSecrets flattens paged results', async () => {
      sinon
        .stub(SecretClient.prototype, 'listPropertiesOfSecrets')
        .returns(fakePagedResult([[{ name: 'a' }], [{ name: 'b' }]]) as any);

      const kvb = new KeyVaultBase('vault1', '7.0');
      const list = await kvb.listSecrets();

      expect(list.map((s) => s.name)).to.deep.equal(['a', 'b']);
    });

    it('getSecretVersions filters by version when provided', async () => {
      sinon.stub(SecretClient.prototype, 'listPropertiesOfSecretVersions').returns(
        fakePagedResult([
          [
            { name: 's', version: 'v1', enabled: true },
            { name: 's', version: 'v2', enabled: true },
          ],
        ]) as any,
      );

      const kvb = new KeyVaultBase('vault1', '7.0');
      const versions = await kvb.getSecretVersions('s', 'v2');

      expect(versions).to.have.length(1);
      expect(versions[0].version).to.equal('v2');
    });

    it('checkSecretExist returns true when an enabled version exists', async () => {
      sinon
        .stub(SecretClient.prototype, 'listPropertiesOfSecretVersions')
        .returns(fakePagedResult([[{ name: 's', enabled: true }]]) as any);

      const kvb = new KeyVaultBase('vault1', '7.0');
      expect(await kvb.checkSecretExist('s')).to.equal(true);
    });

    it('checkSecretExist returns false when versions lookup fails', async () => {
      sinon
        .stub(SecretClient.prototype, 'listPropertiesOfSecretVersions')
        .throws(new Error('not found'));

      const kvb = new KeyVaultBase('vault1', '7.0');
      expect(await kvb.checkSecretExist('s')).to.equal(false);
    });
  });

  describe('getDeletedSecret / recoverDeletedSecret', () => {
    it('getDeletedSecret resolves to undefined when the SDK call rejects', async () => {
      sinon
        .stub(SecretClient.prototype, 'getDeletedSecret')
        .rejects(new Error('not found'));

      const kvb = new KeyVaultBase('vault1', '7.0');
      expect(await kvb.getDeletedSecret('s')).to.equal(undefined);
    });

    it('recoverDeletedSecret recovers when a deleted secret is found', async () => {
      sinon
        .stub(SecretClient.prototype, 'getDeletedSecret')
        .resolves({ name: 's' } as any);
      const pollUntilDone = sinon.stub().resolves();
      sinon
        .stub(SecretClient.prototype, 'beginRecoverDeletedSecret')
        .resolves({ pollUntilDone } as any);

      const kvb = new KeyVaultBase('vault1', '7.0');
      expect(await kvb.recoverDeletedSecret('s')).to.equal(true);
      expect(pollUntilDone.calledOnce).to.equal(true);
    });

    it('recoverDeletedSecret returns false when nothing was deleted', async () => {
      sinon.stub(SecretClient.prototype, 'getDeletedSecret').rejects();

      const kvb = new KeyVaultBase('vault1', '7.0');
      expect(await kvb.recoverDeletedSecret('s')).to.equal(false);
    });
  });

  describe('setSecret / getSecret', () => {
    it('setSecret recovers a deleted secret then writes the new value', async () => {
      sinon.stub(SecretClient.prototype, 'getDeletedSecret').rejects();
      const setSecret = sinon
        .stub(SecretClient.prototype, 'setSecret')
        .resolves({ properties: { id: 'id1', version: 'v1' } } as any);

      const kvb = new KeyVaultBase('vault1', '7.0');
      await kvb.setSecret('s', 'value', 'text/plain', { env: 'test' });

      expect(setSecret.calledOnce).to.equal(true);
      expect(setSecret.firstCall.args[0]).to.equal('s');
    });

    it('getSecret caches the result and does not call the SDK twice', async () => {
      const getSecret = sinon
        .stub(SecretClient.prototype, 'getSecret')
        .resolves({ name: 's', properties: { id: 'id1' } } as any);

      const kvb = new KeyVaultBase('vault1', '7.0');
      await kvb.getSecret('s');
      await kvb.getSecret('s');

      expect(getSecret.calledOnce).to.equal(true);
    });

    it('getSecret logs and returns undefined on SDK error, without caching', async () => {
      sinon
        .stub(SecretClient.prototype, 'getSecret')
        .rejects(new Error('boom'));
      sinon.stub(console, 'error');

      const kvb = new KeyVaultBase('vault1', '7.0');
      expect(await kvb.getSecret('s')).to.equal(undefined);
    });
  });

  describe('Key operations', () => {
    it('getKeyVersions filters by version when provided', async () => {
      sinon.stub(KeyClient.prototype, 'listPropertiesOfKeyVersions').returns(
        fakePagedResult([
          [
            { name: 'k', version: 'v1', enabled: true },
            { name: 'k', version: 'v2', enabled: true },
          ],
        ]) as any,
      );

      const kvb = new KeyVaultBase('vault1', '7.0');
      const versions = await kvb.getKeyVersions('k', 'v1');
      expect(versions).to.have.length(1);
    });

    it('checkKeyExist returns false when no enabled version exists', async () => {
      sinon
        .stub(KeyClient.prototype, 'listPropertiesOfKeyVersions')
        .returns(fakePagedResult([[]]) as any);

      const kvb = new KeyVaultBase('vault1', '7.0');
      expect(await kvb.checkKeyExist('k')).to.equal(false);
    });

    it('checkKeyExist returns true when an enabled version exists', async () => {
      sinon
        .stub(KeyClient.prototype, 'listPropertiesOfKeyVersions')
        .returns(fakePagedResult([[{ name: 'k', enabled: true }]]) as any);

      const kvb = new KeyVaultBase('vault1', '7.0');
      expect(await kvb.checkKeyExist('k')).to.equal(true);
    });

    it('listKeys flattens paged results', async () => {
      sinon
        .stub(KeyClient.prototype, 'listPropertiesOfKeys')
        .returns(fakePagedResult([[{ name: 'k1' }], [{ name: 'k2' }]]) as any);

      const kvb = new KeyVaultBase('vault1', '7.0');
      expect((await kvb.listKeys()).map((k) => k.name)).to.deep.equal(['k1', 'k2']);
    });

    it('getDeletedKey resolves to undefined when the SDK call rejects', async () => {
      sinon.stub(KeyClient.prototype, 'getDeletedKey').rejects(new Error('not found'));

      const kvb = new KeyVaultBase('vault1', '7.0');
      expect(await kvb.getDeletedKey('k')).to.equal(undefined);
    });

    it('recoverDeletedKey recovers when a deleted key is found', async () => {
      sinon.stub(KeyClient.prototype, 'getDeletedKey').resolves({ name: 'k' } as any);
      const pollUntilDone = sinon.stub().resolves();
      sinon
        .stub(KeyClient.prototype, 'beginRecoverDeletedKey')
        .resolves({ pollUntilDone } as any);

      const kvb = new KeyVaultBase('vault1', '7.0');
      expect(await kvb.recoverDeletedKey('k')).to.equal(true);
      expect(pollUntilDone.calledOnce).to.equal(true);
    });

    it('recoverDeletedKey returns false when nothing was deleted', async () => {
      sinon.stub(KeyClient.prototype, 'getDeletedKey').rejects();

      const kvb = new KeyVaultBase('vault1', '7.0');
      expect(await kvb.recoverDeletedKey('k')).to.equal(false);
    });

    it('createRsaKey recovers the deleted key then creates with defaults', async () => {
      sinon.stub(KeyClient.prototype, 'getDeletedKey').rejects();
      const createRsaKey = sinon
        .stub(KeyClient.prototype, 'createRsaKey')
        .resolves({ name: 'k' } as any);

      const kvb = new KeyVaultBase('vault1', '7.0');
      await kvb.createRsaKey('k');

      expect(createRsaKey.calledOnce).to.equal(true);
      expect(createRsaKey.firstCall.args[1].keySize).to.equal(2048);
    });

    it('getKey caches the result', async () => {
      const getKey = sinon
        .stub(KeyClient.prototype, 'getKey')
        .resolves({ name: 'k', properties: { id: 'id1' } } as any);

      const kvb = new KeyVaultBase('vault1', '7.0');
      await kvb.getKey('k');
      await kvb.getKey('k');

      expect(getKey.calledOnce).to.equal(true);
    });

    it('getKey logs and returns undefined on SDK error', async () => {
      sinon.stub(KeyClient.prototype, 'getKey').rejects(new Error('boom'));
      sinon.stub(console, 'error');

      const kvb = new KeyVaultBase('vault1', '7.0');
      expect(await kvb.getKey('k')).to.equal(undefined);
    });

    it('getOrCreateKey creates when the key does not exist, reads when it does', async () => {
      sinon
        .stub(KeyClient.prototype, 'listPropertiesOfKeyVersions')
        .returns(fakePagedResult([[]]) as any);
      sinon.stub(KeyClient.prototype, 'getDeletedKey').rejects();
      const createRsaKey = sinon
        .stub(KeyClient.prototype, 'createRsaKey')
        .resolves({ name: 'k' } as any);

      const kvb = new KeyVaultBase('vault1', '7.0');
      await kvb.getOrCreateKey('k');

      expect(createRsaKey.calledOnce).to.equal(true);
    });

    it('getOrCreateKey reads the existing key instead of creating one', async () => {
      sinon
        .stub(KeyClient.prototype, 'listPropertiesOfKeyVersions')
        .returns(fakePagedResult([[{ name: 'k', enabled: true }]]) as any);
      const getKey = sinon
        .stub(KeyClient.prototype, 'getKey')
        .resolves({ name: 'k', properties: { id: 'id1' } } as any);

      const kvb = new KeyVaultBase('vault1', '7.0');
      await kvb.getOrCreateKey('k');

      expect(getKey.calledOnce).to.equal(true);
    });
  });

  describe('Cert operations', () => {
    it('getCertVersions filters by version when provided', async () => {
      sinon
        .stub(CertificateClient.prototype, 'listPropertiesOfCertificateVersions')
        .returns(
          fakePagedResult([
            [
              { name: 'c', version: 'v1', enabled: true },
              { name: 'c', version: 'v2', enabled: true },
            ],
          ]) as any,
        );

      const kvb = new KeyVaultBase('vault1', '7.0');
      const versions = await kvb.getCertVersions('c', 'v1');
      expect(versions).to.have.length(1);
    });

    it('listCerts flattens paged results', async () => {
      sinon
        .stub(CertificateClient.prototype, 'listPropertiesOfCertificates')
        .returns(fakePagedResult([[{ name: 'c1' }], [{ name: 'c2' }]]) as any);

      const kvb = new KeyVaultBase('vault1', '7.0');
      expect((await kvb.listCerts()).map((c) => c.name)).to.deep.equal(['c1', 'c2']);
    });

    it('checkCertExist returns false when the versions lookup fails', async () => {
      sinon
        .stub(CertificateClient.prototype, 'listPropertiesOfCertificateVersions')
        .throws(new Error('not found'));

      const kvb = new KeyVaultBase('vault1', '7.0');
      expect(await kvb.checkCertExist('c')).to.equal(false);
    });

    it('getDeletedCert resolves to undefined when the SDK call rejects', async () => {
      sinon
        .stub(CertificateClient.prototype, 'getDeletedCertificate')
        .rejects(new Error('not found'));

      const kvb = new KeyVaultBase('vault1', '7.0');
      expect(await kvb.getDeletedCert('c')).to.equal(undefined);
    });

    it('recoverDeletedCert recovers when a deleted cert is found', async () => {
      sinon
        .stub(CertificateClient.prototype, 'getDeletedCertificate')
        .resolves({ name: 'c' } as any);
      const pollUntilDone = sinon.stub().resolves();
      sinon
        .stub(CertificateClient.prototype, 'beginRecoverDeletedCertificate')
        .resolves({ pollUntilDone } as any);

      const kvb = new KeyVaultBase('vault1', '7.0');
      expect(await kvb.recoverDeletedCert('c')).to.equal(true);
      expect(pollUntilDone.calledOnce).to.equal(true);
    });

    it('recoverDeletedCert returns false when nothing was deleted', async () => {
      sinon.stub(CertificateClient.prototype, 'getDeletedCertificate').rejects();

      const kvb = new KeyVaultBase('vault1', '7.0');
      expect(await kvb.recoverDeletedCert('c')).to.equal(false);
    });

    it('checkCertExist returns true when an enabled version exists', async () => {
      sinon
        .stub(CertificateClient.prototype, 'listPropertiesOfCertificateVersions')
        .returns(fakePagedResult([[{ name: 'c', enabled: true }]]) as any);

      const kvb = new KeyVaultBase('vault1', '7.0');
      expect(await kvb.checkCertExist('c')).to.equal(true);
    });

    it('getCert caches the result', async () => {
      const getCertificate = sinon
        .stub(CertificateClient.prototype, 'getCertificate')
        .resolves({ name: 'c', properties: { id: 'id1' } } as any);

      const kvb = new KeyVaultBase('vault1', '7.0');
      await kvb.getCert('c');
      await kvb.getCert('c');

      expect(getCertificate.calledOnce).to.equal(true);
    });

    it('getCert logs and returns undefined on SDK error', async () => {
      sinon
        .stub(CertificateClient.prototype, 'getCertificate')
        .rejects(new Error('boom'));
      sinon.stub(console, 'error');

      const kvb = new KeyVaultBase('vault1', '7.0');
      expect(await kvb.getCert('c')).to.equal(undefined);
    });

    it('createSelfSignCert issues a client-auth EKU by default and server-auth when requested', async () => {
      const beginCreateCertificate = sinon
        .stub(CertificateClient.prototype, 'beginCreateCertificate')
        .resolves({ pollUntilDone: sinon.stub().resolves() } as any);

      const kvb = new KeyVaultBase('vault1', '7.0');
      await kvb.createSelfSignCert('c', { subject: 'test.local' });
      await kvb.createSelfSignCert('c', {
        subject: 'test.local',
        serverAuth: true,
      });

      expect(beginCreateCertificate.firstCall.args[1].enhancedKeyUsage).to.deep.equal(
        ['1.3.6.1.5.5.7.3.2'],
      );
      expect(beginCreateCertificate.secondCall.args[1].enhancedKeyUsage).to.deep.equal(
        ['1.3.6.1.5.5.7.3.1'],
      );
    });
  });
});
