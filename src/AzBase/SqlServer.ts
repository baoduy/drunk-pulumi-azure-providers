import { SqlManagementClient } from '@azure/arm-sql';
import { DefaultAzureCredential } from '@azure/identity';
import { ResourceArgs, ResourceInfo } from '../types';
import { getResourceInfoFromId } from './Helpers';

export class SqlServer {
  private _client: SqlManagementClient;
  constructor(private subscriptionId: string) {
    this._client = new SqlManagementClient(
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

  public pauseDb(sqlInfo: ResourceArgs, dbName: string) {
    return this._client.databases.beginPause(
      sqlInfo.resourceGroupName,
      sqlInfo.resourceName,
      dbName,
    );
  }
  public async pauseAllDbs(sqlInfo: ResourceArgs) {
    const dbs = this._client.databases
      .listByServer(sqlInfo.resourceGroupName, sqlInfo.resourceName)
      .byPage({ maxPageSize: 5 });

    for await (const db of dbs) {
      await Promise.all(db.map((d) => this.pauseDb(sqlInfo, d.name!)));
    }
  }
  public resumeDb(sqlInfo: ResourceArgs, dbName: string) {
    return this._client.databases.beginResume(
      sqlInfo.resourceGroupName,
      sqlInfo.resourceName,
      dbName,
    );
  }
  public async resumeAllDbs(sqlInfo: ResourceArgs) {
    const dbs = this._client.databases
      .listByServer(sqlInfo.resourceGroupName, sqlInfo.resourceName)
      .byPage({ maxPageSize: 5 });

    for await (const db of dbs) {
      await Promise.all(db.map((d) => this.resumeDb(sqlInfo, d.name!)));
    }
  }
}
