import { SqlManagementClient } from '@azure/arm-sql';
import { DefaultAzureCredential } from '@azure/identity';
import { ResourceArgs } from '../types';

export class SqlServer {
  private _client: SqlManagementClient;
  constructor(private args: ResourceArgs) {
    this._client = new SqlManagementClient(
      new DefaultAzureCredential(),
      args.subscriptionId,
    );
  }

  public pauseDb(dbName: string) {
    return this._client.databases.beginPause(
      this.args.resourceGroupName,
      this.args.resourceName,
      dbName,
    );
  }
  public async pauseAllDbs() {
    const dbs = this._client.databases
      .listByServer(this.args.resourceGroupName, this.args.resourceName)
      .byPage({ maxPageSize: 5 });

    for await (const db of dbs) {
      await Promise.all(db.map((d) => this.pauseDb(d.name!)));
    }
  }
  public resumeDb(dbName: string) {
    return this._client.databases.beginResume(
      this.args.resourceGroupName,
      this.args.resourceName,
      dbName,
    );
  }
  public async resumeAllDbs() {
    const dbs = this._client.databases
      .listByServer(this.args.resourceGroupName, this.args.resourceName)
      .byPage({ maxPageSize: 5 });

    for await (const db of dbs) {
      await Promise.all(db.map((d) => this.resumeDb(d.name!)));
    }
  }
}
