import { ComputeManagementClient } from '@azure/arm-compute';
import { ResourceArgs } from '../types';
import { getCredential, searchResources } from './Helpers';

/** Virtual Machine*/
export class VM {
  private _client: ComputeManagementClient;
  constructor(subscriptionId: string) {
    this._client = new ComputeManagementClient(getCredential(), subscriptionId);
  }

  public search(filter?: string) {
    return searchResources(this._client.virtualMachines.listAll(), filter);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public stop(args: ResourceArgs): Promise<any> {
    return this._client.virtualMachines.beginDeallocate(
      args.resourceGroupName,
      args.resourceName,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public start(args: ResourceArgs): Promise<any> {
    return this._client.virtualMachines.beginStart(
      args.resourceGroupName,
      args.resourceName,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public restart(args: ResourceArgs): Promise<any> {
    return this._client.virtualMachines.beginRestart(
      args.resourceGroupName,
      args.resourceName,
    );
  }
}

/** Virtual Scale Set*/
export class VMS {
  private _client: ComputeManagementClient;
  constructor(subscriptionId: string) {
    this._client = new ComputeManagementClient(getCredential(), subscriptionId);
  }

  public search(filter?: string) {
    return searchResources(
      this._client.virtualMachineScaleSets.listAll(),
      filter,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public stop(args: ResourceArgs): Promise<any> {
    return this._client.virtualMachineScaleSets.beginDeallocate(
      args.resourceGroupName,
      args.resourceName,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public start(args: ResourceArgs): Promise<any> {
    return this._client.virtualMachineScaleSets.beginStart(
      args.resourceGroupName,
      args.resourceName,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public restart(args: ResourceArgs): Promise<any> {
    return this._client.virtualMachineScaleSets.beginRestart(
      args.resourceGroupName,
      args.resourceName,
    );
  }
}
