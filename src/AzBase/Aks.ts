import { ContainerServiceClient } from '@azure/arm-containerservice';
import { ResourceArgs } from '../types';
import { getCredential, searchResources } from './Helpers';

export class Aks {
  private _client: ContainerServiceClient;
  constructor(subscriptionId: string) {
    this._client = new ContainerServiceClient(getCredential(), subscriptionId);
  }

  public search(filter?: string) {
    return searchResources(this._client.managedClusters.list(), filter);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public stop(args: ResourceArgs): Promise<any> {
    return this._client.managedClusters.beginStop(
      args.resourceGroupName,
      args.resourceName,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public start(args: ResourceArgs): Promise<any> {
    return this._client.managedClusters.beginStart(
      args.resourceGroupName,
      args.resourceName,
    );
  }
}
