import { ComputeManagementClient } from '@azure/arm-compute';
import { DefaultAzureCredential } from '@azure/identity';
import { ResourceArgs, ResourceInfo } from '../types';
import { getResourceInfoFromId } from './Helpers';

/** Virtual Machine*/
export class VM {
  private _client: ComputeManagementClient;
  constructor(private subscriptionId: string) {
    this._client = new ComputeManagementClient(
      new DefaultAzureCredential(),
      subscriptionId,
    );
  }
  public async search(filter: string | undefined = undefined) {
    const list = new Array<ResourceInfo>();
    for await (const aks of this._client.virtualMachines.listAll().byPage()) {
      list.push(...aks.map((a) => getResourceInfoFromId(a.id!)));
    }
    return filter ? list.filter((a) => a.resourceName.includes(filter)) : list;
  }

  public stop(args: ResourceArgs) {
    return this._client.virtualMachines.beginDeallocate(
      args.resourceGroupName,
      args.resourceName,
    );
  }

  public start(args: ResourceArgs) {
    return this._client.virtualMachines.beginStart(
      args.resourceGroupName,
      args.resourceName,
    );
  }

  public restart(args: ResourceArgs) {
    return this._client.virtualMachines.beginRestart(
      args.resourceGroupName,
      args.resourceName,
    );
  }
}

/** Virtual Scale Set*/
export class VMS {
  private _client: ComputeManagementClient;
  constructor(private subscriptionId: string) {
    this._client = new ComputeManagementClient(
      new DefaultAzureCredential(),
      subscriptionId,
    );
  }

  public async search(filter: string | undefined = undefined) {
    const list = new Array<ResourceInfo>();
    for await (const aks of this._client.virtualMachineScaleSets
      .listAll()
      .byPage()) {
      list.push(...aks.map((a) => getResourceInfoFromId(a.id!)));
    }
    return filter ? list.filter((a) => a.resourceName.includes(filter)) : list;
  }

  public stop(args: ResourceArgs) {
    return this._client.virtualMachineScaleSets.beginDeallocate(
      args.resourceGroupName,
      args.resourceName,
    );
  }

  public start(args: ResourceArgs) {
    return this._client.virtualMachineScaleSets.beginStart(
      args.resourceGroupName,
      args.resourceName,
    );
  }

  public restart(args: ResourceArgs) {
    return this._client.virtualMachineScaleSets.beginRestart(
      args.resourceGroupName,
      args.resourceName,
    );
  }
}
