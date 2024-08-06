import { ContainerServiceClient } from '@azure/arm-containerservice';
import { DefaultAzureCredential } from '@azure/identity';
import { ResourceArgs, ResourceInfo } from '../types';
import { getResourceInfoFromId } from './Helpers';

export class Aks {
  private _client: ContainerServiceClient;
  constructor(private subscriptionId: string) {
    this._client = new ContainerServiceClient(
      new DefaultAzureCredential(),
      subscriptionId,
    );
  }

  public async search(filter: string | undefined = undefined) {
    const list = new Array<ResourceInfo>();
    for await (const aks of this._client.managedClusters.list().byPage()) {
      list.push(...aks.map((a) => getResourceInfoFromId(a.id!)));
    }
    return filter ? list.filter((a) => a.resourceName.includes(filter)) : list;
  }

  public stop(args: ResourceArgs) {
    return this._client.managedClusters.beginStop(
      args.resourceGroupName,
      args.resourceName,
    );
  }
  public start(args: ResourceArgs) {
    return this._client.managedClusters.beginStart(
      args.resourceGroupName,
      args.resourceName,
    );
  }
}
