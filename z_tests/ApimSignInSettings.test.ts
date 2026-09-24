import { expect } from 'chai';
import sinon from 'sinon';
import { ApiManagementClient } from '@azure/arm-apimanagement';
import { DefaultAzureCredential } from '@azure/identity';
import { ApimSignInSettingsResourceProvider } from '../src/ApimSignInSettings';

/** The ApiManagementClient constructor's own export binding is frozen (non-configurable
 * getter on the SDK's commonjs barrel), so we can't stub the class itself. Its nested
 * `signInSettings` operation group is a plain, writable object, so we stub its prototype
 * method instead — the technique `Skills/testing.md` calls "mock Azure SDK clients". */
function stubSignInSettingsCreateOrUpdate() {
  const probe = new ApiManagementClient(new DefaultAzureCredential(), 'sub1');
  return sinon.stub(Object.getPrototypeOf(probe.signInSettings), 'createOrUpdate');
}

describe('ApimSignInSettingsResourceProvider', () => {
  afterEach(() => sinon.restore());

  it('create applies the requested enabled flag', async () => {
    const createOrUpdate = stubSignInSettingsCreateOrUpdate().resolves();

    const provider = new ApimSignInSettingsResourceProvider('test');
    const result = await provider.create({
      resourceGroupName: 'rg1',
      serviceName: 'svc1',
      subscriptionId: 'sub1',
      enabled: false,
    });

    expect(createOrUpdate.calledOnceWith('rg1', 'svc1', { enabled: false })).to.equal(
      true,
    );
    expect(result.outs.enabled).to.equal(false);
  });

  it('update delegates to create', async () => {
    const createOrUpdate = stubSignInSettingsCreateOrUpdate().resolves();

    const provider = new ApimSignInSettingsResourceProvider('test');
    const news = {
      resourceGroupName: 'rg1',
      serviceName: 'svc1',
      subscriptionId: 'sub1',
      enabled: true,
    };
    const result = await provider.update('id1', news, news);

    expect(createOrUpdate.calledOnce).to.equal(true);
    expect(result.outs.enabled).to.equal(true);
  });

  it('delete propagates a failed SDK call instead of swallowing it', async () => {
    const createOrUpdate = stubSignInSettingsCreateOrUpdate().rejects(
      new Error('apim down'),
    );

    const provider = new ApimSignInSettingsResourceProvider('test');
    let threw = false;
    try {
      await provider.delete('id1', {
        resourceGroupName: 'rg1',
        serviceName: 'svc1',
        subscriptionId: 'sub1',
        enabled: true,
      });
    } catch (err: any) {
      threw = true;
      expect(err.message).to.equal('apim down');
    }
    expect(threw).to.equal(true);
    expect(createOrUpdate.calledOnce).to.equal(true);
  });
});
