import { expect } from 'chai';
import sinon from 'sinon';
import { KeyVaultBase } from '../src/AzBase/KeyVaultBase';
import { VaultCertResourceProvider } from '../src/VaultCert';

// `getKeyVaultBase` is stubbed indirectly: KeyVaultBase's own methods are
// stubbed on its prototype so `getKeyVaultBase(vaultName)` still builds a real
// (but network-inert) KeyVaultBase instance - no DI refactor of src/ needed.

describe('VaultCertResourceProvider', () => {
  let checkCertExistStub: sinon.SinonStub;
  let getCertStub: sinon.SinonStub;
  let createSelfSignCertStub: sinon.SinonStub;
  let deleteCertStub: sinon.SinonStub;

  beforeEach(() => {
    checkCertExistStub = sinon.stub(KeyVaultBase.prototype, 'checkCertExist');
    getCertStub = sinon.stub(KeyVaultBase.prototype, 'getCert');
    createSelfSignCertStub = sinon.stub(
      KeyVaultBase.prototype,
      'createSelfSignCert',
    );
    deleteCertStub = sinon.stub(KeyVaultBase.prototype, 'deleteCert');
  });

  afterEach(() => sinon.restore());

  const provider = () => new VaultCertResourceProvider('test-cert');
  const certArgs = { subject: 'CN=test.example.com' };

  describe('create', () => {
    it('creates a self-signed cert and polls until done when none exists', async () => {
      checkCertExistStub.resolves(false);
      const pollUntilDone = sinon.stub().resolves({
        id: 'cert-id',
        name: 'my-cert',
        properties: { id: 'cert-id', vaultUrl: 'u', version: 'v1' },
      });
      createSelfSignCertStub.resolves({ pollUntilDone });

      const result = await provider().create({
        name: 'my-cert',
        vaultName: 'my-vault',
        cert: certArgs,
      });

      expect(
        createSelfSignCertStub.calledOnceWithExactly('my-cert', certArgs),
      ).to.be.true;
      expect(pollUntilDone.calledOnce).to.be.true;
      expect(getCertStub.called).to.be.false;
      expect(result.id).to.equal('cert-id');
      expect(result.outs).to.include({
        name: 'my-cert',
        vaultName: 'my-vault',
        version: 'v1',
        vaultUrl: 'u',
      });
    });

    it('reuses the existing cert without recreating it', async () => {
      checkCertExistStub.resolves(true);
      getCertStub.resolves({
        id: 'cert-id',
        name: 'my-cert',
        properties: { id: 'cert-id', vaultUrl: 'u', version: 'v1' },
      });

      const result = await provider().create({
        name: 'my-cert',
        vaultName: 'my-vault',
        cert: certArgs,
      });

      expect(createSelfSignCertStub.called).to.be.false;
      expect(getCertStub.calledOnceWithExactly('my-cert')).to.be.true;
      expect(result.outs.version).to.equal('v1');
    });

    it('falls back to waitAndRetry(getCert) when neither path returns a cert', async () => {
      checkCertExistStub.resolves(false);
      const pollUntilDone = sinon.stub().resolves(undefined);
      createSelfSignCertStub.resolves({ pollUntilDone });
      getCertStub.resolves({
        id: 'cert-id',
        name: 'my-cert',
        properties: { id: 'cert-id', vaultUrl: 'u', version: 'v2' },
      });

      const result = await provider().create({
        name: 'my-cert',
        vaultName: 'my-vault',
        cert: certArgs,
      });

      expect(getCertStub.calledOnceWithExactly('my-cert')).to.be.true;
      expect(result.outs.version).to.equal('v2');
    });
  });

  describe('update', () => {
    it('recreates the cert via create() and returns its outs', async () => {
      checkCertExistStub.resolves(false);
      const pollUntilDone = sinon.stub().resolves({
        id: 'cert-id',
        name: 'my-cert',
        properties: { id: 'cert-id', vaultUrl: 'u', version: 'v2' },
      });
      createSelfSignCertStub.resolves({ pollUntilDone });

      const result = await provider().update(
        'id',
        {
          id: 'id',
          name: 'my-cert',
          vaultName: 'my-vault',
          vaultUrl: 'u',
          version: 'v1',
        },
        { name: 'my-cert', vaultName: 'my-vault', cert: certArgs },
      );

      expect(
        createSelfSignCertStub.calledOnceWithExactly('my-cert', certArgs),
      ).to.be.true;
      expect(result.outs.version).to.equal('v2');
    });
  });

  describe('delete', () => {
    it('deletes the cert by name', async () => {
      deleteCertStub.resolves(undefined);

      await provider().delete('id', {
        id: 'id',
        name: 'my-cert',
        vaultName: 'my-vault',
        vaultUrl: 'u',
        version: 'v1',
      });

      expect(deleteCertStub.calledOnceWithExactly('my-cert')).to.be.true;
    });

    it('propagates a failed delete to the caller', async () => {
      deleteCertStub.rejects(new Error('vault unreachable'));

      let threw = false;
      try {
        await provider().delete('id1', {
          id: 'id1',
          name: 'cert1',
          vaultName: 'vault1',
          vaultUrl: 'https://vault1.vault.azure.net',
          version: 'v1',
        });
      } catch (err: any) {
        threw = true;
        expect(err.message).to.equal('vault unreachable');
      }
      expect(threw).to.equal(true);
    });
  });
});
