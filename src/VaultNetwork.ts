import {
  BaseOptions,
  BaseProvider,
  BaseResource,
  DefaultInputs,
  DefaultOutputs,
} from "./BaseProvider";
import * as pulumi from "@pulumi/pulumi";
import { KeyVaultManagementClient } from "@azure/arm-keyvault";
import { DefaultAzureCredential } from "@azure/identity";

interface VaultNetworkInputs extends DefaultInputs {
  subscriptionId: string;
  resourceGroupName: string;
  vaultName: string;
  ipAddresses?: string[];
  subnetIds?: Array<string>;
}

interface VaultNetworkOutputs extends VaultNetworkInputs, DefaultOutputs {}

const updateSet = (
  currentSet: Set<string>,
  oldItems: string[] | undefined,
  newItems: string[] | undefined,
) => {
  oldItems?.forEach((item) => currentSet.delete(item));
  newItems?.forEach((item) => currentSet.add(item));
};

class VaultNetworkProvider
  implements BaseProvider<VaultNetworkInputs, VaultNetworkOutputs>
{
  constructor(private name: string) {}

  public async create(inputs: VaultNetworkInputs) {
    await this.update(
      this.name,
      {
        name: this.name,
        ...inputs,
        ipAddresses: undefined,
        subnetIds: undefined,
      },
      inputs,
    );
    return {
      id: this.name,
      outs: inputs,
    };
  }

  public async update(
    id: string,
    olds: VaultNetworkOutputs,
    news: VaultNetworkInputs,
  ) {
    const subscriptionId = olds.subscriptionId ?? news.subscriptionId;
    const resourceGroupName = olds.resourceGroupName ?? news.resourceGroupName;
    const vaultName = olds.vaultName ?? news.vaultName;

    const client = new KeyVaultManagementClient(
      new DefaultAzureCredential(),
      subscriptionId,
    );
    const vaultInfo = await client.vaults.get(resourceGroupName, vaultName);
    //Collect current infos
    const currentIps = new Set<string>(
      vaultInfo.properties.networkAcls?.ipRules?.map((i) => i.value),
    );
    const currentSubnets = new Set<string>(
      vaultInfo.properties.networkAcls?.virtualNetworkRules?.map((i) => i.id),
    );

    updateSet(currentIps, olds.ipAddresses, news.ipAddresses);
    updateSet(currentSubnets, olds.subnetIds, news.subnetIds);

    //Update the new VaultInfo
    let updated = false;
    const networkAcls = vaultInfo.properties.networkAcls ?? {
      bypass: "AzureServices",
      defaultAction: "Allow",
    };
    if (currentIps.size > 0) {
      updated = true;
      networkAcls.ipRules = Array.from(currentIps)
        .sort()
        .map((i) => ({ value: i }));
    }
    if (currentSubnets.size > 0) {
      updated = true;
      networkAcls.virtualNetworkRules = Array.from(currentSubnets)
        .sort()
        .map((i) => ({ id: i, ignoreMissingVnetServiceEndpoint: true }));
    }
    if (updated) {
      await client.vaults.update(resourceGroupName, vaultName, {
        properties: { networkAcls },
      });
    }

    return { id, outs: { ...olds, ...news } };
  }

  public async delete(id: string, props: VaultNetworkOutputs) {
    await this.update(id, props, {
      ...props,
      ipAddresses: undefined,
      subnetIds: undefined,
    });
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
      args,
      opts,
    );
    this.name = name;
  }
}
