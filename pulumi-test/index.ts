import * as pulumi from '@pulumi/pulumi';
import { SshKeyResource } from '@drunk-pulumi/azure-providers';
import KeyVault from '@drunk-pulumi/azure-providers/AzBase/KeyVaultBase';

const rs = (async () => {
  const rs = new SshKeyResource('global-drunkcoding-vlt', {
    password: '123456',
  });

  var sr = await KeyVault('dev-common-afwjjp').getSecret('common-clientid');

  return { rs, sr };
})();

export default pulumi.output(rs);
