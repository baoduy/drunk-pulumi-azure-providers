import { expect } from 'chai';
import sinon from 'sinon';
import { SecretClient } from '@azure/keyvault-secrets';
import { KeyVaultBase } from '../src/AzBase/KeyVaultBase';
import { VaultSecretResourceProvider } from '../src/VaultSecret';

describe('VaultSecretResourceProvider', () => {
  afterEach(() => sinon.restore());

  describe('delete', () => {
    it('guards against a missing vaultName and makes no SDK call', async () => {
      const beginDeleteSecret = sinon.stub(
        SecretClient.prototype,
        'beginDeleteSecret',
      );
      sinon.stub(console, 'error');

      const provider = new VaultSecretResourceProvider('test');
      await provider.delete('id1', {
        name: 'secret1',
        vaultName: undefined as any,
        version: 'v1',
        vaultUrl: 'https://x.vault.azure.net',
      });

      expect(beginDeleteSecret.called).to.equal(false);
    });

    it('propagates a failed delete to the caller', async () => {
      // KeyVaultBase.deleteSecret already tolerates SDK failures internally (see
      // KeyVaultBase.test.ts), so a real SDK rejection never reaches this call site.
      // Stub the client boundary itself to prove this provider method has no .catch()
      // of its own and lets a rejection through unmodified.
      sinon
        .stub(KeyVaultBase.prototype, 'deleteSecret')
        .rejects(new Error('vault unreachable'));

      const provider = new VaultSecretResourceProvider('test');
      let threw = false;
      try {
        await provider.delete('id1', {
          name: 'secret1',
          vaultName: 'vault1',
          version: 'v1',
          vaultUrl: 'https://vault1.vault.azure.net',
        });
      } catch (err: any) {
        threw = true;
        expect(err.message).to.equal('vault unreachable');
      }
      expect(threw).to.equal(true);
    });
  });

  describe('update', () => {
    it('skips create/delete entirely when ignoreChange is set', async () => {
      const setSecret = sinon.stub(SecretClient.prototype, 'setSecret');
      const beginDeleteSecret = sinon.stub(
        SecretClient.prototype,
        'beginDeleteSecret',
      );

      const provider = new VaultSecretResourceProvider('test');
      const olds = {
        name: 's',
        vaultName: 'vault1',
        version: 'v1',
        vaultUrl: 'https://vault1.vault.azure.net',
        ignoreChange: true,
      };
      const result = await provider.update('id1', olds, {
        name: 's',
        value: 'new-value',
        vaultName: 'vault1',
        ignoreChange: true,
      });

      expect(result.outs).to.deep.equal(olds);
      expect(setSecret.called).to.equal(false);
      expect(beginDeleteSecret.called).to.equal(false);
    });

    it('does not attempt a delete when name and vault are unchanged', async () => {
      sinon.stub(SecretClient.prototype, 'getDeletedSecret').rejects();
      sinon.stub(SecretClient.prototype, 'setSecret').resolves({
        properties: { id: 'id1', version: 'v2', vaultUrl: 'https://vault1.vault.azure.net' },
      } as any);
      const beginDeleteSecret = sinon.stub(
        SecretClient.prototype,
        'beginDeleteSecret',
      );

      const provider = new VaultSecretResourceProvider('test');
      await provider.update(
        'id1',
        {
          name: 's',
          vaultName: 'vault1',
          version: 'v1',
          vaultUrl: 'https://vault1.vault.azure.net',
        },
        { name: 's', value: 'new-value', vaultName: 'vault1' },
      );

      expect(beginDeleteSecret.called).to.equal(false);
    });

    it('tolerates the superseded-secret delete failing: warns and still returns the new outputs', async () => {
      sinon.stub(SecretClient.prototype, 'getDeletedSecret').rejects();
      sinon.stub(SecretClient.prototype, 'setSecret').resolves({
        properties: {
          id: 'new-id',
          version: 'v2',
          vaultUrl: 'https://vault1.vault.azure.net',
        },
      } as any);
      // KeyVaultBase.deleteSecret already tolerates+warns internally (see
      // KeyVaultBase.test.ts) and would swallow a plain SDK rejection before it ever
      // reaches update()'s own .catch(). Reject at the KeyVaultBase boundary itself so
      // this test actually exercises update()'s own tolerate-and-warn handling.
      sinon
        .stub(KeyVaultBase.prototype, 'deleteSecret')
        .rejects(new Error('old secret locked'));
      const warnSpy = sinon.stub(console, 'warn');

      const provider = new VaultSecretResourceProvider('test');
      const result = await provider.update(
        'id1',
        {
          name: 'old-name',
          vaultName: 'vault1',
          version: 'v1',
          vaultUrl: 'https://vault1.vault.azure.net',
        },
        { name: 'new-name', value: 'new-value', vaultName: 'vault1' },
      );

      expect(result.outs.version).to.equal('v2');
      expect(result.outs.name).to.equal('new-name');
      expect(warnSpy.calledOnce).to.equal(true);
      const message = warnSpy.firstCall.args[0] as string;
      expect(message).to.include('old-name');
      expect(message).to.include('vault1');
      expect(message).to.include('old secret locked');
      expect(message).to.not.include('new-value');
    });
  });
});
