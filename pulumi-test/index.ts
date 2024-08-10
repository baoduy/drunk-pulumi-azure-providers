import * as pulumi from '@pulumi/pulumi';
import { VaultKeyResource } from '@drunk-pulumi/azure-providers';

const rs = (async () => {
  const item = new VaultKeyResource('devdrunkcodingstg-encrypt-key', {
    name: 'devdrunkcodingstg-encrypt-key',
    key: { keySize: 4096, keyOps: ['wrapKey'] },
    vaultName: 'global-drunkcoding-vlt',
  });
  return item;
})();

export default pulumi.output(rs);
