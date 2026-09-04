import { expect } from 'chai';
import sinon from 'sinon';
import { KeyClient } from '@azure/keyvault-keys';
import { KeyVaultBase } from '../src/AzBase/KeyVaultBase';
import { VaultKeyResourceProvider } from '../src/VaultKey';

function fakePagedResult<T>(pages: T[][]) {
  return {
    byPage: () => ({
      [Symbol.asyncIterator]: async function* () {
        for (const page of pages) yield page;
      },
    }),
  };
}

describe('VaultKeyResourceProvider', () => {
  afterEach(() => sinon.restore());

  describe('delete', () => {
    it('guards against a missing vaultName and makes no SDK call', async () => {
      const beginDeleteKey = sinon.stub(KeyClient.prototype, 'beginDeleteKey');
      sinon.stub(console, 'error');

      const provider = new VaultKeyResourceProvider('test');
      await provider.delete('id1', {
        id: 'id1',
        name: 'key1',
        vaultName: undefined as any,
        vaultUrl: 'https://x.vault.azure.net',
        version: 'v1',
        key: {},
      });

      expect(beginDeleteKey.called).to.equal(false);
    });

    it('propagates a failed delete to the caller', async () => {
      // KeyVaultBase.deleteKey already tolerates SDK failures internally (see
      // KeyVaultBase.test.ts); stub the client boundary itself to prove this provider
      // method has no .catch() of its own and lets a rejection through unmodified.
      sinon
        .stub(KeyVaultBase.prototype, 'deleteKey')
        .rejects(new Error('vault unreachable'));

      const provider = new VaultKeyResourceProvider('test');
      let threw = false;
      try {
        await provider.delete('id1', {
          id: 'id1',
          name: 'key1',
          vaultName: 'vault1',
          vaultUrl: 'https://vault1.vault.azure.net',
          version: 'v1',
          key: {},
        });
      } catch (err: any) {
        threw = true;
        expect(err.message).to.equal('vault unreachable');
      }
      expect(threw).to.equal(true);
    });
  });

  describe('create / update', () => {
    it('creates a new key when none exists', async () => {
      sinon
        .stub(KeyClient.prototype, 'listPropertiesOfKeyVersions')
        .returns(fakePagedResult([[]]) as any);
      sinon.stub(KeyClient.prototype, 'getDeletedKey').rejects();
      const createRsaKey = sinon.stub(KeyClient.prototype, 'createRsaKey').resolves({
        id: 'id1',
        name: 'k',
        properties: { id: 'id1', vaultUrl: 'https://vault1.vault.azure.net', version: 'v1' },
      } as any);

      const provider = new VaultKeyResourceProvider('test');
      const result = await provider.create({
        name: 'k',
        vaultName: 'vault1',
        key: { keySize: 2048 },
      });

      expect(createRsaKey.calledOnce).to.equal(true);
      expect(result.outs.name).to.equal('k');
    });

    it('forces re-creation on update when keySize changes', async () => {
      sinon.stub(KeyClient.prototype, 'getDeletedKey').rejects();
      const createRsaKey = sinon.stub(KeyClient.prototype, 'createRsaKey').resolves({
        id: 'id2',
        name: 'k',
        properties: { id: 'id2', vaultUrl: 'https://vault1.vault.azure.net', version: 'v2' },
      } as any);
      const checkKeyExist = sinon.stub(
        KeyClient.prototype,
        'listPropertiesOfKeyVersions',
      );

      const provider = new VaultKeyResourceProvider('test');
      await provider.update(
        'id1',
        {
          id: 'id1',
          name: 'k',
          vaultName: 'vault1',
          vaultUrl: 'https://vault1.vault.azure.net',
          version: 'v1',
          key: { keySize: 2048 },
        },
        { name: 'k', vaultName: 'vault1', key: { keySize: 4096 } },
      );

      // forced update bypasses the exist-check and re-creates directly
      expect(checkKeyExist.called).to.equal(false);
      expect(createRsaKey.calledOnce).to.equal(true);
    });
  });
});
