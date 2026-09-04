import { expect } from 'chai';
import sinon from 'sinon';
import { KeyVaultBase } from '../src/AzBase/KeyVaultBase';
import { VaultSecretResourceProvider } from '../src/VaultSecret';

// NOTE (DRK-1046-1 / DRK-1038 interplay): update()/delete() route the old-secret
// deletion through `client.deleteSecret(name).catch()` (a zero-arg .catch()).
// DRK-1038 is an open cycle that changes that exact swallow-vs-propagate
// semantic in this file. We assert WHICH client methods are called, with WHAT
// arguments, in WHAT order, and WHAT the provider returns on the happy path -
// never whether a rejected deleteSecret propagates or is swallowed - so this
// suite holds both before and after DRK-1038 lands.
//
// `getKeyVaultBase` is stubbed indirectly: KeyVaultBase's own methods are
// stubbed on its prototype so `getKeyVaultBase(vaultName)` still builds a real
// (but network-inert) KeyVaultBase instance - no DI refactor of src/ needed.

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
        setSecretStub.calledOnceWith('my-secret', 'shh', 'text/plain', {
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

      expect(getSecretStub.calledOnceWith('my-secret')).to.be.true;
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
        setSecretStub.calledOnceWith(
          'renamed-secret',
          'v',
          undefined,
          undefined,
        ),
      ).to.be.true;
      expect(deleteSecretStub.calledOnceWith('my-secret')).to.be.true;
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

      expect(deleteSecretStub.calledOnceWith('my-secret')).to.be.true;
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

      expect(deleteSecretStub.calledOnceWith('my-secret')).to.be.true;
    });

    it('does nothing when props has no vaultName', async () => {
      await provider().delete('id', { name: 'my-secret' } as any);

      expect(deleteSecretStub.called).to.be.false;
    });
  });
});
