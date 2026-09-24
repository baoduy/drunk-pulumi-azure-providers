import { MySQLManagementFlexibleServerClient } from '@azure/arm-mysql-flexible';
import { ResourceArgs } from '../types';
import { getCredential, searchResources } from './Helpers';

export class MySqlFlexible {
  private _client: MySQLManagementFlexibleServerClient;
  constructor(subscriptionId: string) {
    this._client = new MySQLManagementFlexibleServerClient(
      getCredential(),
      subscriptionId,
    );
  }

  public search(filter?: string) {
    return searchResources(this._client.servers.list(), filter);
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
