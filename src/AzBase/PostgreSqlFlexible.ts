import { PostgreSQLManagementFlexibleServerClient } from '@azure/arm-postgresql-flexible';
import { DefaultAzureCredential } from '@azure/identity';
import { ResourceArgs } from '../types';

export class PostgreSqlFlexible {
  private _client: PostgreSQLManagementFlexibleServerClient;
  constructor(private args: ResourceArgs) {
    this._client = new PostgreSQLManagementFlexibleServerClient(
      new DefaultAzureCredential(),
      args.subscriptionId,
    );
  }

  public stop() {
    return this._client.servers.beginStop(
      this.args.resourceGroupName,
      this.args.resourceName,
    );
  }

  public start() {
    return this._client.servers.beginStart(
      this.args.resourceGroupName,
      this.args.resourceName,
    );
  }
}
