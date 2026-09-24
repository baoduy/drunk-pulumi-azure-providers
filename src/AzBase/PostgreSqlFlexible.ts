import { PostgreSQLManagementFlexibleServerClient } from '@azure/arm-postgresql-flexible';
import { ResourceArgs } from '../types';
import { getCredential, searchResources } from './Helpers';

export class PostgreSqlFlexible {
  private _client: PostgreSQLManagementFlexibleServerClient;
  constructor(subscriptionId: string) {
    this._client = new PostgreSQLManagementFlexibleServerClient(
      getCredential(),
      subscriptionId,
    );
  }

  public search(filter?: string) {
    return searchResources(this._client.servers.listBySubscription(), filter);
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
