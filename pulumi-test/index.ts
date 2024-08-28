import * as pulumi from '@pulumi/pulumi';
import { KeyVaultBase, VaultKeyResource } from '@drunk-pulumi/azure-providers';

const rs = (async () => {
  const vault = new KeyVaultBase('global-drunkcoding-vlt');
  const secrets = await vault.listSecrets();
  console.log(
    'secrets:',
    secrets.map((i) => i.name),
  );

  const keys = await vault.listKeys();
  console.log(
    'keys:',
    keys.map((i) => i.name),
  );

  const certs = await vault.listCerts();
  console.log(
    'certs:',
    certs.map((i) => i.name),
  );
})();

export default pulumi.output(rs);
