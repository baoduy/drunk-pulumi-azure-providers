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
  networkAcls?: {
    ipAddresses?: string[];
    subnetIds?: Array<string>;
  };
}

interface VaultNetworkOutputs extends VaultNetworkInputs, DefaultOutputs {}

class VaultNetworkProvider
  implements BaseProvider<VaultNetworkInputs, VaultNetworkOutputs>
{
  constructor(private name: string) {}

  public async create(inputs: VaultNetworkInputs) {
    await this.update(
      this.name,
      { name: this.name, ...inputs, networkAcls: undefined },
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
    //Remove the olds Ips
    if (olds.networkAcls) {
      olds.networkAcls.ipAddresses?.forEach((i) => {
        currentIps.delete(i);
      });
      olds.networkAcls.subnetIds?.forEach((i) => {
        currentSubnets.delete(i);
      });
    }
    //Add the new one
    if (news.networkAcls) {
      news.networkAcls.ipAddresses?.forEach((i) => {
        currentIps.add(i);
      });
      news.networkAcls.subnetIds?.forEach((i) => {
        currentSubnets.add(i);
      });
    }

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
    await this.update(id, props, { ...props, networkAcls: undefined });
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
