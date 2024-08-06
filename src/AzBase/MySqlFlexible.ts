import { MySQLManagementFlexibleServerClient } from '@azure/arm-mysql-flexible';
import { DefaultAzureCredential } from '@azure/identity';
import { ResourceArgs, ResourceInfo } from '../types';
import { getResourceInfoFromId } from './Helpers';

export class MySqlFlexible {
  private _client: MySQLManagementFlexibleServerClient;
  constructor(private subscriptionId: string) {
    this._client = new MySQLManagementFlexibleServerClient(
      new DefaultAzureCredential(),
      subscriptionId,
    );
  }

  public async search(filter: string | undefined = undefined) {
    const list = new Array<ResourceInfo>();
    for await (const aks of this._client.servers.list().byPage()) {
      list.push(...aks.map((a) => getResourceInfoFromId(a.id!)));
    }
    return filter ? list.filter((a) => a.resourceName.includes(filter)) : list;
  }

  public stop(args: ResourceArgs) {
    return this._client.servers.beginStop(
      args.resourceGroupName,
      args.resourceName,
    );
  }

  public start(args: ResourceArgs) {
    return this._client.servers.beginStart(
      args.resourceGroupName,
      args.resourceName,
    );
  }
}
