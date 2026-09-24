import { expect } from 'chai';
import sinon from 'sinon';
import { ApiManagementClient } from '@azure/arm-apimanagement';
import { DefaultAzureCredential } from '@azure/identity';
import { ApimSignUpSettingsResourceProvider } from '../src/ApimSignUpSettings';

/** See ApimSignInSettings.test.ts for why we stub the nested operation's prototype
 * rather than the ApiManagementClient export itself. */
function stubSignUpSettingsCreateOrUpdate() {
  const probe = new ApiManagementClient(new DefaultAzureCredential(), 'sub1');
  return sinon.stub(Object.getPrototypeOf(probe.signUpSettings), 'createOrUpdate');
}

const termsOfService = { enabled: true, text: '', consentRequired: true };

describe('ApimSignUpSettingsResourceProvider', () => {
  afterEach(() => sinon.restore());

  it('create applies the requested settings', async () => {
    const createOrUpdate = stubSignUpSettingsCreateOrUpdate().resolves();

    const provider = new ApimSignUpSettingsResourceProvider('test');
    const result = await provider.create({
      resourceGroupName: 'rg1',
      serviceName: 'svc1',
      subscriptionId: 'sub1',
      enabled: false,
      termsOfService,
    });

    expect(
      createOrUpdate.calledOnceWith('rg1', 'svc1', {
        enabled: false,
        termsOfService,
      }),
    ).to.equal(true);
    expect(result.outs.enabled).to.equal(false);
  });

  it('update delegates to create', async () => {
    const createOrUpdate = stubSignUpSettingsCreateOrUpdate().resolves();

    const provider = new ApimSignUpSettingsResourceProvider('test');
    const news = {
      resourceGroupName: 'rg1',
      serviceName: 'svc1',
      subscriptionId: 'sub1',
      enabled: true,
      termsOfService,
    };
    const result = await provider.update('id1', news, news);

    expect(createOrUpdate.calledOnce).to.equal(true);
    expect(result.outs.enabled).to.equal(true);
  });

  it('delete propagates a failed SDK call instead of swallowing it', async () => {
    const createOrUpdate = stubSignUpSettingsCreateOrUpdate().rejects(
      new Error('apim down'),
    );

    const provider = new ApimSignUpSettingsResourceProvider('test');
    let threw = false;
    try {
      await provider.delete('id1', {
        resourceGroupName: 'rg1',
        serviceName: 'svc1',
        subscriptionId: 'sub1',
        enabled: true,
        termsOfService,
      });
    } catch (err: any) {
      threw = true;
      expect(err.message).to.equal('apim down');
    }
    expect(threw).to.equal(true);
    expect(createOrUpdate.calledOnce).to.equal(true);
  });
});
