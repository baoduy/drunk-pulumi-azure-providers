import { BaseOptions, BaseProvider, BaseResource } from './BaseProvider';
import * as pulumi from '@pulumi/pulumi';
import { KeyVaultManagementClient, NetworkRuleSet } from '@azure/arm-keyvault';
import { diffProps, getCredential } from './AzBase/Helpers';

interface VaultNetworkInputs {
  subscriptionId: string;
  resourceGroupName: string;
  vaultName: string;
  ipAddresses?: string[];
  subnetIds?: Array<string>;
}

type VaultNetworkOutputs = VaultNetworkInputs;
type RuleChange = Pick<VaultNetworkInputs, 'ipAddresses' | 'subnetIds'>;

const applyChange = (
  current: string[] | undefined,
  oldItems: string[] | undefined,
  newItems: string[] | undefined,
) => {
  const set = new Set(current);
  oldItems?.forEach((item) => set.delete(item));
  newItems?.forEach((item) => set.add(item));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
};

/**
 * Removes the rules this resource owned before (`olds`) and adds the ones it owns now (`news`),
 * keeping rules managed elsewhere. Returns undefined when there is nothing to write.
 */
export const buildNetworkAcls = (
  current: NetworkRuleSet | undefined,
  olds: RuleChange,
  news: RuleChange,
): NetworkRuleSet | undefined => {
  const ips = applyChange(
    current?.ipRules?.map((i) => i.value),
    olds.ipAddresses,
    news.ipAddresses,
  );
  const subnets = applyChange(
    current?.virtualNetworkRules?.map((i) => i.id),
    olds.subnetIds,
    news.subnetIds,
  );

  // No ACLs on the vault and nothing to add: leave the vault untouched.
  if (!current && ips.length === 0 && subnets.length === 0) return undefined;

  return {
    // IP/subnet rules only restrict access when the default action is Deny.
    ...(current ?? { bypass: 'AzureServices', defaultAction: 'Deny' }),
    ipRules: ips.map((value) => ({ value })),
    virtualNetworkRules: subnets.map((id) => ({
      id,
      ignoreMissingVnetServiceEndpoint: true,
    })),
  };
};

class VaultNetworkProvider
  implements BaseProvider<VaultNetworkInputs, VaultNetworkOutputs>
{
  constructor(private name: string) {}

  public async create(inputs: VaultNetworkInputs) {
    await this.apply(inputs, {}, inputs);
    return { id: this.name, outs: inputs };
  }

  /** Pointing at a different vault replaces the resource (rules added there, removed here). */
  public async diff(
    _id: string,
    olds: VaultNetworkOutputs,
    news: VaultNetworkInputs,
  ) {
    return diffProps(olds, news, {
      replaceKeys: ['subscriptionId', 'resourceGroupName', 'vaultName'],
    });
  }

  public async update(
    _id: string,
    olds: VaultNetworkOutputs,
    news: VaultNetworkInputs,
  ) {
    await this.apply(news, olds, news);
    return { outs: news };
  }

  public async delete(_id: string, props: VaultNetworkOutputs) {
    await this.apply(props, props, {});
  }

  // ponytail: read-modify-write of the vault ACLs; parallel VaultNetworkResources on the same vault can race. Use dependsOn between them.
  private async apply(
    vault: VaultNetworkInputs,
    olds: RuleChange,
    news: RuleChange,
  ) {
    const client = new KeyVaultManagementClient(
      getCredential(),
      vault.subscriptionId,
    );
    const vaultInfo = await client.vaults.get(
      vault.resourceGroupName,
      vault.vaultName,
    );
    const networkAcls = buildNetworkAcls(
      vaultInfo.properties.networkAcls,
      olds,
      news,
    );

    if (networkAcls) {
      await client.vaults.update(vault.resourceGroupName, vault.vaultName, {
        properties: { networkAcls },
      });
    }
  }
}

export class VaultNetworkResource extends BaseResource<
  VaultNetworkInputs,
  VaultNetworkOutputs
> {
  public readonly name: string;

  constructor(
    name: string,
    args: BaseOptions<VaultNetworkInputs>,
    opts?: pulumi.CustomResourceOptions,
  ) {
    super(
      new VaultNetworkProvider(name),
      `csp:KeyVaultNetwork:${name}`,
      { ...args },
      opts,
    );
    this.name = name;
  }
}
