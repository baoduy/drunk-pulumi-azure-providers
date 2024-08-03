import { ComputeManagementClient } from '@azure/arm-compute';
import { DefaultAzureCredential } from '@azure/identity';
import { ResourceArgs } from '../types';

/** Virtual Machine*/
export class VM {
  private _client: ComputeManagementClient;
  constructor(private args: ResourceArgs) {
    this._client = new ComputeManagementClient(
      new DefaultAzureCredential(),
      args.subscriptionId,
    );
  }

  public stop() {
    return this._client.virtualMachines.beginDeallocate(
      this.args.resourceGroupName,
      this.args.resourceName,
    );
  }

  public start() {
    return this._client.virtualMachines.beginStart(
      this.args.resourceGroupName,
      this.args.resourceName,
    );
  }

  public restart() {
    return this._client.virtualMachines.beginRestart(
      this.args.resourceGroupName,
      this.args.resourceName,
    );
  }
}

/** Virtual Scale Set*/
export class VMS {
  private _client: ComputeManagementClient;
  constructor(private args: ResourceArgs) {
    this._client = new ComputeManagementClient(
      new DefaultAzureCredential(),
      args.subscriptionId,
    );
  }

  public stop() {
    return this._client.virtualMachineScaleSets.beginDeallocate(
      this.args.resourceGroupName,
      this.args.resourceName,
    );
  }

  public start() {
    return this._client.virtualMachineScaleSets.beginStart(
      this.args.resourceGroupName,
      this.args.resourceName,
    );
  }

  public restart() {
    return this._client.virtualMachineScaleSets.beginRestart(
      this.args.resourceGroupName,
      this.args.resourceName,
    );
  }
}
