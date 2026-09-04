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

  describe('update', () => {
    const olds = {
      name: 'my-secret',
      vaultName: 'my-vault',
      version: 'v1',
      vaultUrl: 'https://my-vault.vault.azure.net',
    };

    it('short-circuits on olds.ignoreChange without touching the client', async () => {
      const result = await provider().update(
        'id',
        { ...olds, ignoreChange: true },
        { name: 'my-secret', value: 'v', vaultName: 'my-vault' },
      );

      expect(result).to.deep.equal({ outs: { ...olds, ignoreChange: true } });
      expect(setSecretStub.called).to.be.false;
      expect(deleteSecretStub.called).to.be.false;
    });

    it('short-circuits on news.ignoreChange without touching the client', async () => {
      const result = await provider().update('id', olds, {
        name: 'my-secret',
        value: 'v',
        vaultName: 'my-vault',
        ignoreChange: true,
      });

      expect(result).to.deep.equal({ outs: olds });
      expect(setSecretStub.called).to.be.false;
    });

    it('skips create/delete entirely when ignoreChange is set on both sides', async () => {
      const olds2 = { ...olds, ignoreChange: true };

      const result = await provider().update('id', olds2, {
        name: 'my-secret',
        value: 'new-value',
        vaultName: 'my-vault',
        ignoreChange: true,
      });

      expect(result.outs).to.deep.equal(olds2);
      expect(setSecretStub.called).to.be.false;
      expect(deleteSecretStub.called).to.be.false;
    });

    it('creates the new secret then deletes the old one when the name changes', async () => {
      setSecretStub.resolves({
        properties: { id: 'new-id', version: 'v2', vaultUrl: 'u2' },
      });
      deleteSecretStub.resolves(undefined);

      await provider().update('id', olds, {
        name: 'renamed-secret',
        value: 'v',
        vaultName: 'my-vault',
      });

      expect(
        setSecretStub.calledOnceWithExactly(
          'renamed-secret',
          'v',
          undefined,
          undefined,
        ),
      ).to.be.true;
      expect(deleteSecretStub.calledOnceWithExactly('my-secret')).to.be.true;
      expect(setSecretStub.calledBefore(deleteSecretStub)).to.be.true;
    });

    it('creates the new secret then deletes the old one when the vault changes', async () => {
      setSecretStub.resolves({
        properties: { id: 'new-id', version: 'v2', vaultUrl: 'u2' },
      });
      deleteSecretStub.resolves(undefined);

      await provider().update('id', olds, {
        name: 'my-secret',
        value: 'v',
        vaultName: 'new-vault',
      });

      expect(deleteSecretStub.calledOnceWithExactly('my-secret')).to.be.true;
    });

    it('does not delete the old secret when name and vault are unchanged', async () => {
      setSecretStub.resolves({
        properties: { id: 'new-id', version: 'v2', vaultUrl: 'u2' },
      });

      await provider().update('id', olds, {
        name: 'my-secret',
        value: 'v',
        vaultName: 'my-vault',
      });

      expect(deleteSecretStub.called).to.be.false;
    });

    it('tolerates the superseded-secret delete failing: warns and still returns the new outputs', async () => {
      setSecretStub.resolves({
        properties: {
          id: 'new-id',
          version: 'v2',
          vaultUrl: 'https://vault1.vault.azure.net',
        },
      });
      deleteSecretStub.rejects(new Error('old secret locked'));
      const warnSpy = sinon.stub(console, 'warn');

      const result = await provider().update(
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
