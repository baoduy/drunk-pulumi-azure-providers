import { expect } from 'chai';
import sinon from 'sinon';
import { KeyVaultBase } from '../src/AzBase/KeyVaultBase';
import { VaultKeyResourceProvider } from '../src/VaultKey';

// `getKeyVaultBase` is stubbed indirectly: KeyVaultBase's own methods are
// stubbed on its prototype so `getKeyVaultBase(vaultName)` still builds a real
// (but network-inert) KeyVaultBase instance - no DI refactor of src/ needed.

describe('VaultKeyResourceProvider', () => {
  let checkKeyExistStub: sinon.SinonStub;
  let getKeyStub: sinon.SinonStub;
  let createRsaKeyStub: sinon.SinonStub;
  let deleteKeyStub: sinon.SinonStub;

  beforeEach(() => {
    checkKeyExistStub = sinon.stub(KeyVaultBase.prototype, 'checkKeyExist');
    getKeyStub = sinon.stub(KeyVaultBase.prototype, 'getKey');
    createRsaKeyStub = sinon.stub(KeyVaultBase.prototype, 'createRsaKey');
    deleteKeyStub = sinon.stub(KeyVaultBase.prototype, 'deleteKey');
  });

  afterEach(() => sinon.restore());

  const provider = () => new VaultKeyResourceProvider('test-key');
  const keyArgs = { keySize: 2048 as const };

  describe('create', () => {
    it('creates a new key when none exists', async () => {
      checkKeyExistStub.resolves(false);
      createRsaKeyStub.resolves({
        id: 'key-id',
        name: 'my-key',
        properties: { id: 'key-id', vaultUrl: 'u', version: 'v1' },
      });

      const result = await provider().create({
        name: 'my-key',
        vaultName: 'my-vault',
        key: keyArgs,
      });

      expect(checkKeyExistStub.calledOnceWithExactly('my-key')).to.be.true;
      expect(createRsaKeyStub.calledOnceWithExactly('my-key', keyArgs)).to.be.true;
      expect(getKeyStub.called).to.be.false;
      expect(result.id).to.equal('key-id');
      expect(result.outs).to.include({
        name: 'my-key',
        vaultName: 'my-vault',
        version: 'v1',
        vaultUrl: 'u',
      });
    });

    it('reuses the existing key without recreating it', async () => {
      checkKeyExistStub.resolves(true);
      getKeyStub.resolves({
        id: 'key-id',
        name: 'my-key',
        properties: { id: 'key-id', vaultUrl: 'u', version: 'v1' },
      });

      const result = await provider().create({
        name: 'my-key',
        vaultName: 'my-vault',
        key: keyArgs,
      });

      expect(createRsaKeyStub.called).to.be.false;
      expect(getKeyStub.calledOnceWithExactly('my-key')).to.be.true;
      expect(result.outs.version).to.equal('v1');
    });

    it('forces recreation and skips the existence check when forceUpdate is true', async () => {
      createRsaKeyStub.resolves({
        id: 'key-id',
        name: 'my-key',
        properties: { id: 'key-id', vaultUrl: 'u', version: 'v2' },
      });

      await provider().create(
        { name: 'my-key', vaultName: 'my-vault', key: keyArgs },
        true,
      );

      expect(checkKeyExistStub.called).to.be.false;
      expect(createRsaKeyStub.calledOnceWithExactly('my-key', keyArgs)).to.be.true;
    });

    it('falls back to waitAndRetry(getKey) when neither path returns a key', async () => {
      checkKeyExistStub.resolves(false);
      createRsaKeyStub.resolves(undefined);
      getKeyStub.resolves({
        id: 'key-id',
        name: 'my-key',
        properties: { id: 'key-id', vaultUrl: 'u', version: 'v3' },
      });

      const result = await provider().create({
        name: 'my-key',
        vaultName: 'my-vault',
        key: keyArgs,
      });

      expect(getKeyStub.calledOnceWithExactly('my-key')).to.be.true;
      expect(result.outs.version).to.equal('v3');
    });
  });

  describe('update', () => {
    it('forces recreation when keySize changes', async () => {
      createRsaKeyStub.resolves({
        id: 'key-id',
        name: 'my-key',
        properties: { id: 'key-id', vaultUrl: 'u', version: 'v4' },
      });

      await provider().update(
        'id',
        {
          id: 'id',
          name: 'my-key',
          vaultName: 'my-vault',
          vaultUrl: 'u',
          version: 'v1',
          key: { keySize: 2048 },
        },
        { name: 'my-key', vaultName: 'my-vault', key: { keySize: 4096 } },
      );

      expect(checkKeyExistStub.called).to.be.false;
      expect(
        createRsaKeyStub.calledOnceWithExactly('my-key', { keySize: 4096 }),
      ).to.be.true;
    });

    it('reuses the existing key when keySize is unchanged', async () => {
      checkKeyExistStub.resolves(true);
      getKeyStub.resolves({
        id: 'key-id',
        name: 'my-key',
        properties: { id: 'key-id', vaultUrl: 'u', version: 'v1' },
      });

      await provider().update(
        'id',
        {
          id: 'id',
          name: 'my-key',
          vaultName: 'my-vault',
          vaultUrl: 'u',
          version: 'v1',
          key: { keySize: 2048 },
        },
        { name: 'my-key', vaultName: 'my-vault', key: { keySize: 2048 } },
      );

      expect(createRsaKeyStub.called).to.be.false;
    });
  });

  describe('delete', () => {
    it('deletes the key by name', async () => {
      deleteKeyStub.resolves(undefined);

      await provider().delete('id', {
        id: 'id',
        name: 'my-key',
        vaultName: 'my-vault',
        vaultUrl: 'u',
        version: 'v1',
        key: keyArgs,
      });

      expect(deleteKeyStub.calledOnceWithExactly('my-key')).to.be.true;
    });

    it('does nothing when props has no vaultName', async () => {
      await provider().delete('id', { name: 'my-key' } as any);

      expect(deleteKeyStub.called).to.be.false;
    });
  });
});
