import { expect } from 'chai';
import sinon from 'sinon';
import { CertificateClient } from '@azure/keyvault-certificates';
import { KeyVaultBase } from '../src/AzBase/KeyVaultBase';
import { VaultCertResourceProvider } from '../src/VaultCert';

function fakePagedResult<T>(pages: T[][]) {
  return {
    byPage: () => ({
      [Symbol.asyncIterator]: async function* () {
        for (const page of pages) yield page;
      },
    }),
  };
}

describe('VaultCertResourceProvider', () => {
  afterEach(() => sinon.restore());

  describe('delete', () => {
    it('propagates a failed delete to the caller', async () => {
      // KeyVaultBase.deleteCert already tolerates SDK failures internally (see
      // KeyVaultBase.test.ts); stub the client boundary itself to prove this provider
      // method has no .catch() of its own and lets a rejection through unmodified.
      sinon
        .stub(KeyVaultBase.prototype, 'deleteCert')
        .rejects(new Error('vault unreachable'));

      const provider = new VaultCertResourceProvider('test');
      let threw = false;
      try {
        await provider.delete('id1', {
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

  describe('create / update', () => {
    it('creates a new self-signed cert when none exists', async () => {
      sinon
        .stub(CertificateClient.prototype, 'listPropertiesOfCertificateVersions')
        .returns(fakePagedResult([[]]) as any);
      const pollUntilDone = sinon.stub().resolves({
        id: 'id1',
        name: 'c',
        properties: { id: 'id1', vaultUrl: 'https://vault1.vault.azure.net', version: 'v1' },
      });
      const beginCreateCertificate = sinon
        .stub(CertificateClient.prototype, 'beginCreateCertificate')
        .resolves({ pollUntilDone } as any);

      const provider = new VaultCertResourceProvider('test');
      const result = await provider.create({
        name: 'c',
        vaultName: 'vault1',
        cert: { subject: 'test.local' },
      });

      expect(beginCreateCertificate.calledOnce).to.equal(true);
      expect(result.outs.name).to.equal('c');
    });

    it('reuses an existing cert instead of re-issuing it', async () => {
      sinon
        .stub(CertificateClient.prototype, 'listPropertiesOfCertificateVersions')
        .returns(fakePagedResult([[{ name: 'c', enabled: true }]]) as any);
      const getCertificate = sinon
        .stub(CertificateClient.prototype, 'getCertificate')
        .resolves({
          id: 'id1',
          name: 'c',
          properties: { id: 'id1', vaultUrl: 'https://vault1.vault.azure.net', version: 'v1' },
        } as any);
      const beginCreateCertificate = sinon.stub(
        CertificateClient.prototype,
        'beginCreateCertificate',
      );

      const provider = new VaultCertResourceProvider('test');
      await provider.update(
        'id1',
        {
          id: 'id1',
          name: 'c',
          vaultName: 'vault1',
          vaultUrl: 'https://vault1.vault.azure.net',
          version: 'v1',
        },
        { name: 'c', vaultName: 'vault1', cert: { subject: 'test.local' } },
      );

      expect(getCertificate.calledOnce).to.equal(true);
      expect(beginCreateCertificate.called).to.equal(false);
    });
  });
});
