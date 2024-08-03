import { MySQLManagementFlexibleServerClient } from '@azure/arm-mysql-flexible';
import { DefaultAzureCredential } from '@azure/identity';
import { ResourceArgs } from '../types';

export class MySqlFlexible {
  private _client: MySQLManagementFlexibleServerClient;
  constructor(private args: ResourceArgs) {
    this._client = new MySQLManagementFlexibleServerClient(
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
