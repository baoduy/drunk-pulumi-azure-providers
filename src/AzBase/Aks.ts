import { ContainerServiceClient } from '@azure/arm-containerservice';
import { DefaultAzureCredential } from '@azure/identity';
import { ResourceArgs } from '../types';

export class Aks {
  private _client: ContainerServiceClient;
  constructor(private args: ResourceArgs) {
    this._client = new ContainerServiceClient(
      new DefaultAzureCredential(),
      args.subscriptionId,
    );
  }

  public stop() {
    return this._client.managedClusters.beginStop(
      this.args.resourceGroupName,
      this.args.resourceName,
    );
  }
  public start() {
    return this._client.managedClusters.beginStart(
      this.args.resourceGroupName,
      this.args.resourceName,
    );
  }
}
