import { expect } from 'chai';
import sinon from 'sinon';
import { KeyVaultBase } from '../src/AzBase/KeyVaultBase';
import { VaultSecretResourceProvider } from '../src/VaultSecret';

// NOTE: `getKeyVaultBase` is stubbed indirectly: KeyVaultBase's own methods are
// stubbed on its prototype so `getKeyVaultBase(vaultName)` still builds a real
// (but network-inert) KeyVaultBase instance - no DI refactor of src/ needed.
// This suite asserts WHICH client methods are called, with WHAT arguments, in
// WHAT order, and WHAT the provider returns/throws - including the DRK-1038
// propagate-vs-warn delete semantics.

describe('VaultSecretResourceProvider', () => {
  let setSecretStub: sinon.SinonStub;
  let getSecretStub: sinon.SinonStub;
  let deleteSecretStub: sinon.SinonStub;

  beforeEach(() => {
    setSecretStub = sinon.stub(KeyVaultBase.prototype, 'setSecret');
    getSecretStub = sinon.stub(KeyVaultBase.prototype, 'getSecret');
    deleteSecretStub = sinon.stub(KeyVaultBase.prototype, 'deleteSecret');
  });

  afterEach(() => sinon.restore());

  const provider = () => new VaultSecretResourceProvider('test-secret');

  describe('create', () => {
    it('sets the secret and returns id/version/vaultUrl from the result', async () => {
      setSecretStub.resolves({
        properties: {
          id: 'secret-id',
          version: 'v1',
          vaultUrl: 'https://my-vault.vault.azure.net',
        },
      });

      const result = await provider().create({
        name: 'my-secret',
        value: 'shh',
        vaultName: 'my-vault',
        contentType: 'text/plain',
        tags: { env: 'test' },
      });

      expect(
        setSecretStub.calledOnceWithExactly('my-secret', 'shh', 'text/plain', {
          env: 'test',
        }),
      ).to.be.true;
      expect(result.id).to.equal('secret-id');
      expect(result.outs).to.include({
        name: 'my-secret',
        vaultName: 'my-vault',
        version: 'v1',
        vaultUrl: 'https://my-vault.vault.azure.net',
      });
    });

    it('falls back to getSecret when setSecret resolves nothing', async () => {
      setSecretStub.resolves(undefined);
      getSecretStub.resolves({
        properties: {
          id: 'secret-id-2',
          version: 'v2',
          vaultUrl: 'https://my-vault.vault.azure.net',
        },
      });

      const result = await provider().create({
        name: 'my-secret',
        value: 'shh',
        vaultName: 'my-vault',
      });

      expect(getSecretStub.calledOnceWithExactly('my-secret')).to.be.true;
      expect(result.id).to.equal('secret-id-2');
      expect(result.outs.version).to.equal('v2');
    });
  });

  // Renames/moves are replacements decided in diff(); Pulumi then runs create (new)
  // and delete (old) itself, so update() only ever rewrites the value in place.
  describe('diff', () => {
    const olds = {
      name: 'my-secret',
      value: 'v',
      vaultName: 'my-vault',
      version: 'v1',
      vaultUrl: 'https://my-vault.vault.azure.net',
    };

    it('reports no changes when only output fields differ', async () => {
      const result = await provider().diff('id', olds, {
        name: 'my-secret',
        value: 'v',
        vaultName: 'my-vault',
      });

      expect(result).to.deep.equal({ changes: false, replaces: [] });
    });

    it('short-circuits on news.ignoreChange without touching the client', async () => {
      sinon.stub(console, 'log');
      const result = await provider().diff('id', olds, {
        name: 'renamed',
        value: 'new-value',
        vaultName: 'my-vault',
        ignoreChange: true,
      });

      expect(result).to.deep.equal({ changes: false });
      expect(setSecretStub.called).to.be.false;
      expect(deleteSecretStub.called).to.be.false;
    });

    it('applies changes again once ignoreChange is turned off', async () => {
      const result = await provider().diff(
        'id',
        { ...olds, ignoreChange: true },
        { name: 'my-secret', value: 'new-value', vaultName: 'my-vault' },
      );

      expect(result.changes).to.be.true;
    });

    it('updates in place when only the value changes', async () => {
      const result = await provider().diff('id', olds, {
        name: 'my-secret',
        value: 'new-value',
        vaultName: 'my-vault',
      });

      expect(result).to.deep.equal({ changes: true, replaces: [] });
    });

    it('replaces the secret when the name changes', async () => {
      const result = await provider().diff('id', olds, {
        name: 'renamed-secret',
        value: 'v',
        vaultName: 'my-vault',
      });

      expect(result.replaces).to.deep.equal(['name']);
    });

    it('replaces the secret when the vault changes', async () => {
      const result = await provider().diff('id', olds, {
        name: 'my-secret',
        value: 'v',
        vaultName: 'new-vault',
      });

      expect(result.replaces).to.deep.equal(['vaultName']);
    });
  });

  describe('update', () => {
    it('writes the new value in place and never deletes', async () => {
      setSecretStub.resolves({
        properties: { id: 'new-id', version: 'v2', vaultUrl: 'u2' },
      });

      const result = await provider().update(
        'id',
        { name: 'my-secret', vaultName: 'my-vault', version: 'v1', vaultUrl: 'u' },
        { name: 'my-secret', value: 'new-value', vaultName: 'my-vault' },
      );

      expect(
        setSecretStub.calledOnceWithExactly(
          'my-secret',
          'new-value',
          undefined,
          undefined,
        ),
      ).to.be.true;
      expect(deleteSecretStub.called).to.be.false;
      expect(result.outs.version).to.equal('v2');
    });
  });

  describe('delete', () => {
    it('deletes the secret by name', async () => {
      deleteSecretStub.resolves(undefined);

      await provider().delete('id', {
        name: 'my-secret',
        vaultName: 'my-vault',
        version: 'v1',
        vaultUrl: 'u',
      });

      expect(deleteSecretStub.calledOnceWithExactly('my-secret')).to.be.true;
    });

    it('guards against a missing vaultName and makes no SDK call', async () => {
      const errorSpy = sinon.stub(console, 'error');

      await provider().delete('id', { name: 'my-secret' } as any);

      expect(deleteSecretStub.called).to.be.false;
      expect(errorSpy.calledOnce).to.be.true;
    });

    it('propagates a failed delete to the caller', async () => {
      deleteSecretStub.rejects(new Error('vault unreachable'));

      let threw = false;
      try {
        await provider().delete('id1', {
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
});
