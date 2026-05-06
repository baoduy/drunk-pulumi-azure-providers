import * as pulumi from '@pulumi/pulumi';
import { SshKeyResource } from '@drunk-pulumi/azure-providers';
import KeyVault from '@drunk-pulumi/azure-providers/AzBase/KeyVaultBase';

const rs = (async () => {
  const rs = new SshKeyResource('global-drunkcoding-vlt', {
    password: '123456',
  });

  const vault = KeyVault('dev-common-afwjjp');
  //Get the secret from Key Vault
  const sr = await vault.getSecret('common-clientid');

  //Get the secret from Key Vault
  const newsr = await vault.setSecret('new-new', 'new-value');

  return { rs, sr, newsr };
})();

export default pulumi.output(rs);
