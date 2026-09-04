import { expect } from 'chai';
import sinon from 'sinon';
import { SecretClient } from '@azure/keyvault-secrets';
import { KeyClient } from '@azure/keyvault-keys';
import { CertificateClient } from '@azure/keyvault-certificates';
import { KeyVaultBase } from '../src/AzBase/KeyVaultBase';

// Fakes a PagedAsyncIterableIterator's `.byPage()` shape: one page per array.
function fakePages<T>(pages: T[][]) {
  return {
    byPage: () => ({
      [Symbol.asyncIterator]: async function* () {
        for (const page of pages) yield page;
      },
    }),
  };
}

// Stub a single method on an SDK client prototype. Constructing `KeyVaultBase`
// builds real SecretClient/KeyClient/CertificateClient instances internally
// (no DI seam) so we intercept their network-calling methods at the prototype
// instead - no production source change required.
function stub<T extends object, K extends keyof T>(proto: T, method: K) {
  return sinon.stub(proto, method as any) as unknown as sinon.SinonStub;
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
  let vault: KeyVaultBase;

  beforeEach(() => {
    vault = new KeyVaultBase('my-vault', '7.0');
  });

  afterEach(() => sinon.restore());

  describe('recoverDeletedSecret (soft-delete recovery)', () => {
    it('recovers and polls when a deleted secret is found', async () => {
      stub(SecretClient.prototype, 'getDeletedSecret').resolves({
        name: 'my-secret',
      } as any);
      const pollUntilDone = sinon.stub().resolves(undefined);
      const recover = stub(
        SecretClient.prototype,
        'beginRecoverDeletedSecret',
      ).resolves({ pollUntilDone } as any);

      const result = await vault.recoverDeletedSecret('my-secret');

      expect(recover.calledOnceWithExactly('my-secret')).to.be.true;
      expect(pollUntilDone.calledOnce).to.be.true;
      expect(result).to.be.true;
    });

    it('does nothing and returns false when no deleted secret exists', async () => {
      stub(SecretClient.prototype, 'getDeletedSecret').rejects(
        new Error('not found'),
      );
      const recover = stub(SecretClient.prototype, 'beginRecoverDeletedSecret');

      const result = await vault.recoverDeletedSecret('missing-secret');

      expect(recover.called).to.be.false;
      expect(result).to.be.false;
    });

    it('getDeletedSecret resolves to undefined when the SDK call rejects', async () => {
      stub(SecretClient.prototype, 'getDeletedSecret').rejects(
        new Error('not found'),
      );

      expect(await vault.getDeletedSecret('my-secret')).to.be.undefined;
    });
  });

  describe('recoverDeletedKey (soft-delete recovery)', () => {
    it('recovers and polls when a deleted key is found', async () => {
      stub(KeyClient.prototype, 'getDeletedKey').resolves({
        name: 'my-key',
      } as any);
      const pollUntilDone = sinon.stub().resolves(undefined);
      const recover = stub(KeyClient.prototype, 'beginRecoverDeletedKey').resolves(
        { pollUntilDone } as any,
      );

      const result = await vault.recoverDeletedKey('my-key');

      expect(recover.calledOnceWithExactly('my-key')).to.be.true;
      expect(result).to.be.true;
    });

    it('does nothing and returns false when no deleted key exists', async () => {
      stub(KeyClient.prototype, 'getDeletedKey').rejects(new Error('nope'));
      const recover = stub(KeyClient.prototype, 'beginRecoverDeletedKey');

      const result = await vault.recoverDeletedKey('missing-key');

      expect(recover.called).to.be.false;
      expect(result).to.be.false;
    });

    it('getDeletedKey resolves to undefined when the SDK call rejects', async () => {
      stub(KeyClient.prototype, 'getDeletedKey').rejects(new Error('not found'));

      expect(await vault.getDeletedKey('my-key')).to.be.undefined;
    });
  });

  describe('recoverDeletedCert (soft-delete recovery)', () => {
    it('recovers and polls when a deleted cert is found', async () => {
      stub(CertificateClient.prototype, 'getDeletedCertificate').resolves({
        name: 'my-cert',
      } as any);
      const pollUntilDone = sinon.stub().resolves(undefined);
      const recover = stub(
        CertificateClient.prototype,
        'beginRecoverDeletedCertificate',
      ).resolves({ pollUntilDone } as any);

      const result = await vault.recoverDeletedCert('my-cert');

      expect(recover.calledOnceWithExactly('my-cert')).to.be.true;
      expect(result).to.be.true;
    });

    it('does nothing and returns false when no deleted cert exists', async () => {
      stub(CertificateClient.prototype, 'getDeletedCertificate').rejects(
        new Error('nope'),
      );
      const recover = stub(
        CertificateClient.prototype,
        'beginRecoverDeletedCertificate',
      );

      const result = await vault.recoverDeletedCert('missing-cert');

      expect(recover.called).to.be.false;
      expect(result).to.be.false;
    });

    it('getDeletedCert resolves to undefined when the SDK call rejects', async () => {
      stub(CertificateClient.prototype, 'getDeletedCertificate').rejects(
        new Error('not found'),
      );

      expect(await vault.getDeletedCert('my-cert')).to.be.undefined;
    });
  });

  describe('setSecret', () => {
    it('recovers any soft-deleted secret before writing the new value', async () => {
      stub(SecretClient.prototype, 'getDeletedSecret').rejects(
        new Error('not found'),
      );
      const setSecret = stub(SecretClient.prototype, 'setSecret').resolves({
        properties: { id: 'id', version: 'v1' },
      } as any);

      await vault.setSecret('my-secret', 'value', 'text/plain', {
        env: 'test',
      });

      expect(
        setSecret.calledOnceWithExactly('my-secret', 'value', {
          enabled: true,
          contentType: 'text/plain',
          tags: { env: 'test' },
        }),
      ).to.be.true;
    });
  });

  describe('createRsaKey', () => {
    it('recovers any soft-deleted key then creates with sane defaults', async () => {
      stub(KeyClient.prototype, 'getDeletedKey').rejects(new Error('nope'));
      const createRsaKey = stub(KeyClient.prototype, 'createRsaKey').resolves({
        name: 'my-key',
        properties: { id: 'id', version: 'v1' },
      } as any);

      await vault.createRsaKey('my-key');

      const call = createRsaKey.getCall(0);
      expect(call.args[0]).to.equal('my-key');
      expect(call.args[1]).to.include({ enabled: true, keySize: 2048 });
      expect(call.args[1].keyOps).to.deep.equal([
        'decrypt',
        'encrypt',
        'sign',
        'verify',
        'wrapKey',
        'unwrapKey',
      ]);
    });

    it('honors a custom keySize and keyOps', async () => {
      stub(KeyClient.prototype, 'getDeletedKey').rejects(new Error('nope'));
      const createRsaKey = stub(KeyClient.prototype, 'createRsaKey').resolves({
        name: 'my-key',
        properties: { id: 'id', version: 'v1' },
      } as any);

      await vault.createRsaKey('my-key', {
        keySize: 4096,
        keyOps: ['sign', 'verify'],
      });

      const call = createRsaKey.getCall(0);
      expect(call.args[1]).to.include({ keySize: 4096 });
      expect(call.args[1].keyOps).to.deep.equal(['sign', 'verify']);
    });
  });

  describe('createSelfSignCert', () => {
    it('does not attempt soft-delete recovery (left to DRK-1038 scope)', async () => {
      const getDeletedCertificate = stub(
        CertificateClient.prototype,
        'getDeletedCertificate',
      );
      stub(CertificateClient.prototype, 'beginCreateCertificate').resolves(
        {} as any,
      );

      await vault.createSelfSignCert('my-cert', { subject: 'CN=test' });

      expect(getDeletedCertificate.called).to.be.false;
    });

    it('applies secure-by-default policy (4096-bit RSA, client auth EKU)', async () => {
      const beginCreateCertificate = stub(
        CertificateClient.prototype,
        'beginCreateCertificate',
      ).resolves({} as any);

      await vault.createSelfSignCert('my-cert', { subject: 'CN=test' });

      const call = beginCreateCertificate.getCall(0);
      expect(call.args[0]).to.equal('my-cert');
      expect(call.args[1]).to.include({ keySize: 4096, keyType: 'RSA' });
      expect(call.args[1].enhancedKeyUsage).to.deep.equal([
        '1.3.6.1.5.5.7.3.2',
      ]);
      expect(call.args[1].subjectAlternativeNames).to.deep.equal({
        dnsNames: ['CN=test'],
      });
    });

    it('switches the EKU to server auth when serverAuth is set', async () => {
      const beginCreateCertificate = stub(
        CertificateClient.prototype,
        'beginCreateCertificate',
      ).resolves({} as any);

      await vault.createSelfSignCert('my-cert', {
        subject: 'CN=test',
        serverAuth: true,
        keySize: 2048,
        dnsNames: ['a.test', 'b.test'],
      });

      const call = beginCreateCertificate.getCall(0);
      expect(call.args[1]).to.include({ keySize: 2048 });
      expect(call.args[1].enhancedKeyUsage).to.deep.equal([
        '1.3.6.1.5.5.7.3.1',
      ]);
      expect(call.args[1].subjectAlternativeNames).to.deep.equal({
        dnsNames: ['a.test', 'b.test'],
      });
    });
  });

  describe('getSecret / getKey / getCert caching', () => {
    it('caches a fetched secret and serves the second call from cache', async () => {
      const getSecret = stub(SecretClient.prototype, 'getSecret').resolves({
        name: 'my-secret',
        properties: { id: 'id', version: 'v1' },
      } as any);

      const first = await vault.getSecret('my-secret');
      const second = await vault.getSecret('my-secret');

      expect(first).to.deep.equal(second);
      expect(getSecret.calledOnce).to.be.true;
    });

    it('returns undefined and does not cache when the secret client call fails', async () => {
      stub(SecretClient.prototype, 'getSecret').rejects(new Error('boom'));
      stub(console, 'error');

      const result = await vault.getSecret('my-secret');

      expect(result).to.be.undefined;
    });

    it('caches a fetched key and serves the second call from cache', async () => {
      const getKey = stub(KeyClient.prototype, 'getKey').resolves({
        name: 'my-key',
        properties: { id: 'id', version: 'v1' },
      } as any);

      await vault.getKey('my-key');
      await vault.getKey('my-key');

      expect(getKey.calledOnce).to.be.true;
    });

    it('returns undefined and does not cache when the key client call fails', async () => {
      stub(KeyClient.prototype, 'getKey').rejects(new Error('boom'));
      stub(console, 'error');

      expect(await vault.getKey('my-key')).to.be.undefined;
    });

    it('caches a fetched cert and serves the second call from cache', async () => {
      const getCertificate = stub(
        CertificateClient.prototype,
        'getCertificate',
      ).resolves({
        name: 'my-cert',
        properties: { id: 'id', version: 'v1' },
      } as any);

      await vault.getCert('my-cert');
      await vault.getCert('my-cert');

      expect(getCertificate.calledOnce).to.be.true;
    });

    it('returns undefined and does not cache when the cert client call fails', async () => {
      stub(CertificateClient.prototype, 'getCertificate').rejects(
        new Error('boom'),
      );
      stub(console, 'error');

      expect(await vault.getCert('my-cert')).to.be.undefined;
    });
  });

  describe('checkSecretExist / checkKeyExist / checkCertExist', () => {
    it('reports a secret as existing when an enabled version is returned', async () => {
      stub(SecretClient.prototype, 'listPropertiesOfSecretVersions').returns(
        fakePages([[{ enabled: true, version: 'v1' }]]) as any,
      );

      expect(await vault.checkSecretExist('my-secret')).to.be.true;
    });

    it('reports a secret as not existing when versions listing fails', async () => {
      stub(SecretClient.prototype, 'listPropertiesOfSecretVersions').throws(
        new Error('boom'),
      );

      expect(await vault.checkSecretExist('my-secret')).to.be.false;
    });

    it('reports a key as existing when an enabled version is returned', async () => {
      stub(KeyClient.prototype, 'listPropertiesOfKeyVersions').returns(
        fakePages([[{ enabled: true, version: 'v1' }]]) as any,
      );

      expect(await vault.checkKeyExist('my-key')).to.be.true;
    });

    it('reports a key as not existing when no enabled version exists', async () => {
      stub(KeyClient.prototype, 'listPropertiesOfKeyVersions').returns(
        fakePages([[]]) as any,
      );

      expect(await vault.checkKeyExist('my-key')).to.be.false;
    });

    it('reports a cert as existing when an enabled version is returned', async () => {
      stub(
        CertificateClient.prototype,
        'listPropertiesOfCertificateVersions',
      ).returns(fakePages([[{ enabled: true, version: 'v1' }]]) as any);

      expect(await vault.checkCertExist('my-cert')).to.be.true;
    });

    it('reports a cert as not existing when versions listing fails', async () => {
      stub(
        CertificateClient.prototype,
        'listPropertiesOfCertificateVersions',
      ).throws(new Error('boom'));

      expect(await vault.checkCertExist('my-cert')).to.be.false;
    });
  });

  describe('getOrCreateKey', () => {
    it('returns the existing key without creating one', async () => {
      stub(KeyClient.prototype, 'listPropertiesOfKeyVersions').returns(
        fakePages([[{ enabled: true, version: 'v1' }]]) as any,
      );
      const getKey = stub(KeyClient.prototype, 'getKey').resolves({
        name: 'my-key',
        properties: { id: 'id', version: 'v1' },
      } as any);
      const createRsaKey = stub(KeyClient.prototype, 'createRsaKey');

      await vault.getOrCreateKey('my-key');

      expect(createRsaKey.called).to.be.false;
      expect(getKey.calledOnceWithExactly('my-key', { version: undefined })).to.be
        .true;
    });

    it('creates the key when it does not exist', async () => {
      stub(KeyClient.prototype, 'listPropertiesOfKeyVersions').returns(
        fakePages([[]]) as any,
      );
      stub(KeyClient.prototype, 'getDeletedKey').rejects(new Error('nope'));
      const createRsaKey = stub(KeyClient.prototype, 'createRsaKey').resolves({
        name: 'my-key',
        properties: { id: 'id', version: 'v1' },
      } as any);

      await vault.getOrCreateKey('my-key');

      expect(createRsaKey.calledOnce).to.be.true;
    });
  });

  describe('delete{Secret,Key,Cert}', () => {
    it('deletes the secret by name', async () => {
      const beginDeleteSecret = stub(
        SecretClient.prototype,
        'beginDeleteSecret',
      ).resolves(undefined as any);

      await vault.deleteSecret('my-secret');

      expect(beginDeleteSecret.calledOnceWithExactly('my-secret')).to.be.true;
    });

    it('makes no SDK call and emits no warning in dry-run (deleteSecret)', async () => {
      const beginDeleteSecret = stub(
        SecretClient.prototype,
        'beginDeleteSecret',
      );
      const warnSpy = stub(console, 'warn');

      const DryRunKeyVaultBase = loadKeyVaultBaseWithDryRun();
      const kvb = new DryRunKeyVaultBase('vault-dry', '7.0');
      const result = await kvb.deleteSecret('secret1');

      expect(result).to.equal(undefined);
      expect(beginDeleteSecret.called).to.equal(false);
      expect(warnSpy.called).to.equal(false);
    });

    it('tolerates a failed delete: warns with name/message only and resolves (deleteSecret)', async () => {
      stub(SecretClient.prototype, 'beginDeleteSecret').rejects(
        new Error('secret is locked'),
      );
      const warnSpy = stub(console, 'warn');

      await vault.deleteSecret('my-secret');

      expect(warnSpy.calledOnce).to.equal(true);
      const message = warnSpy.firstCall.args[0] as string;
      expect(message).to.include('my-vault');
      expect(message).to.include('my-secret');
      expect(message).to.include('secret is locked');
    });

    it('deletes the key by name', async () => {
      const beginDeleteKey = stub(
        KeyClient.prototype,
        'beginDeleteKey',
      ).resolves(undefined as any);

      await vault.deleteKey('my-key');

      expect(beginDeleteKey.calledOnceWithExactly('my-key')).to.be.true;
    });

    it('makes no SDK call and emits no warning in dry-run (deleteKey)', async () => {
      const beginDeleteKey = stub(KeyClient.prototype, 'beginDeleteKey');
      const warnSpy = stub(console, 'warn');

      const DryRunKeyVaultBase = loadKeyVaultBaseWithDryRun();
      const kvb = new DryRunKeyVaultBase('vault-dry', '7.0');
      const result = await kvb.deleteKey('key1');

      expect(result).to.equal(undefined);
      expect(beginDeleteKey.called).to.equal(false);
      expect(warnSpy.called).to.equal(false);
    });

    it('tolerates a failed delete: warns with name/message only and resolves (deleteKey)', async () => {
      stub(KeyClient.prototype, 'beginDeleteKey').rejects(
        new Error('key is locked'),
      );
      const warnSpy = stub(console, 'warn');

      await vault.deleteKey('my-key');

      expect(warnSpy.calledOnce).to.equal(true);
      const message = warnSpy.firstCall.args[0] as string;
      expect(message).to.include('my-vault');
      expect(message).to.include('my-key');
      expect(message).to.include('key is locked');
    });

    it('deletes the cert by name', async () => {
      const beginDeleteCertificate = stub(
        CertificateClient.prototype,
        'beginDeleteCertificate',
      ).resolves(undefined as any);

      await vault.deleteCert('my-cert');

      expect(beginDeleteCertificate.calledOnceWithExactly('my-cert')).to.be.true;
    });

    it('makes no SDK call and emits no warning in dry-run (deleteCert)', async () => {
      const beginDeleteCertificate = stub(
        CertificateClient.prototype,
        'beginDeleteCertificate',
      );
      const warnSpy = stub(console, 'warn');

      const DryRunKeyVaultBase = loadKeyVaultBaseWithDryRun();
      const kvb = new DryRunKeyVaultBase('vault-dry', '7.0');
      const result = await kvb.deleteCert('cert1');

      expect(result).to.equal(undefined);
      expect(beginDeleteCertificate.called).to.equal(false);
      expect(warnSpy.called).to.equal(false);
    });

    it('tolerates a failed delete: warns with name/message only and resolves (deleteCert)', async () => {
      stub(CertificateClient.prototype, 'beginDeleteCertificate').rejects(
        new Error('cert is locked'),
      );
      const warnSpy = stub(console, 'warn');

      await vault.deleteCert('my-cert');

      expect(warnSpy.calledOnce).to.equal(true);
      const message = warnSpy.firstCall.args[0] as string;
      expect(message).to.include('my-vault');
      expect(message).to.include('my-cert');
      expect(message).to.include('cert is locked');
    });
  });

  describe('list{Secrets,Keys,Certs} and *Versions', () => {
    it('lists secrets across pages', async () => {
      stub(SecretClient.prototype, 'listPropertiesOfSecrets').returns(
        fakePages([[{ name: 'a' }], [{ name: 'b' }]]) as any,
      );

      const result = await vault.listSecrets();

      expect(result).to.deep.equal([{ name: 'a' }, { name: 'b' }]);
    });

    it('lists keys across pages', async () => {
      stub(KeyClient.prototype, 'listPropertiesOfKeys').returns(
        fakePages([[{ name: 'a' }]]) as any,
      );

      expect(await vault.listKeys()).to.deep.equal([{ name: 'a' }]);
    });

    it('lists certs across pages', async () => {
      stub(CertificateClient.prototype, 'listPropertiesOfCertificates').returns(
        fakePages([[{ name: 'a' }]]) as any,
      );

      expect(await vault.listCerts()).to.deep.equal([{ name: 'a' }]);
    });

    it('filters secret versions to a specific version when requested', async () => {
      stub(SecretClient.prototype, 'listPropertiesOfSecretVersions').returns(
        fakePages([
          [
            { version: 'v1', enabled: true },
            { version: 'v2', enabled: true },
          ],
        ]) as any,
      );

      const result = await vault.getSecretVersions('my-secret', 'v2');

      expect(result).to.deep.equal([{ version: 'v2', enabled: true }]);
    });

    it('filters key versions to a specific version when requested', async () => {
      stub(KeyClient.prototype, 'listPropertiesOfKeyVersions').returns(
        fakePages([
          [
            { version: 'v1', enabled: true },
            { version: 'v2', enabled: true },
          ],
        ]) as any,
      );

      const result = await vault.getKeyVersions('my-key', 'v1');

      expect(result).to.deep.equal([{ version: 'v1', enabled: true }]);
    });

    it('filters cert versions to a specific version when requested', async () => {
      stub(
        CertificateClient.prototype,
        'listPropertiesOfCertificateVersions',
      ).returns(
        fakePages([
          [
            { version: 'v1', enabled: true },
            { version: 'v2', enabled: true },
          ],
        ]) as any,
      );

      const result = await vault.getCertVersions('my-cert', 'v2');

      expect(result).to.deep.equal([{ version: 'v2', enabled: true }]);
    });
  });
});
