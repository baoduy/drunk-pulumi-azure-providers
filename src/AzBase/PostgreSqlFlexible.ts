import { PostgreSQLManagementFlexibleServerClient } from '@azure/arm-postgresql-flexible';
import { DefaultAzureCredential } from '@azure/identity';
import type { Server } from '@azure/arm-postgresql-flexible';
import { ResourceArgs, ResourceInfo } from '../types';
import { getResourceInfoFromId } from './Helpers';

export class PostgreSqlFlexible {
  private _client: PostgreSQLManagementFlexibleServerClient;
  constructor(private subscriptionId: string) {
    this._client = new PostgreSQLManagementFlexibleServerClient(
      new DefaultAzureCredential(),
      subscriptionId,
    );
  }

  public async search(filter: string | undefined = undefined) {
    const list = new Array<ResourceInfo>();
    for await (const page of this._client.servers.listBySubscription().byPage()) {
      list.push(...page.map((server: Server) => getResourceInfoFromId(server.id!)));
    }
    return filter ? list.filter((a) => a.resourceName.includes(filter)) : list;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public stop(args: ResourceArgs): Promise<any> {
    return this._client.servers.beginStop(
      args.resourceGroupName,
      args.resourceName,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public start(args: ResourceArgs): Promise<any> {
    return this._client.servers.beginStart(
      args.resourceGroupName,
      args.resourceName,
    );
  }
}
