import { KeyVaultBase } from '@drunk-pulumi/azure-providers';
import * as pulumi from '@pulumi/pulumi';

const rs = (async () => {
  const vaultInfo = {
    name: 'dev-Root-vault',
    // group: { resourceGroupName: 'dev-root', location: currentRegionCode },
    // id: '/subscriptions/63a31b41-eb5d-4160-9fc9-d30fc00286c9/resourceGroups/dev-root/providers/Microsoft.KeyVault/vaults/dev-Root-vault',
  };

  console.log(
    'checkSecretExist',
    await new KeyVaultBase(vaultInfo.name).checkKeyExist(
      'dev-StorageEncryption',
    ),
  );

  console.log(
    'checkSecretExist',
    await new KeyVaultBase(vaultInfo.name).checkSecretExist('aks-server-Id'),
  );

  console.log(
    'checkCertExist',
    await new KeyVaultBase(vaultInfo.name).checkCertExist(
      'banking-circle-client-cert',
    ),
  );
})();

export default pulumi.output(rs);
