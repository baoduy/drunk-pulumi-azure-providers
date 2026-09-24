import { SqlManagementClient } from '@azure/arm-sql';
import { ResourceArgs } from '../types';
import { collect, getCredential, searchResources } from './Helpers';

export class SqlServer {
  private _client: SqlManagementClient;
  constructor(subscriptionId: string) {
    this._client = new SqlManagementClient(getCredential(), subscriptionId);
  }

  public search(filter?: string) {
    return searchResources(this._client.servers.list(), filter);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public pauseDb(sqlInfo: ResourceArgs, dbName: string): Promise<any> {
    return this._client.databases.beginPause(
      sqlInfo.resourceGroupName,
      sqlInfo.resourceName,
      dbName,
    );
  }

  public async pauseAllDbs(sqlInfo: ResourceArgs) {
    const dbs = await this.listDbs(sqlInfo);
    await Promise.all(dbs.map((d) => this.pauseDb(sqlInfo, d.name!)));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public resumeDb(sqlInfo: ResourceArgs, dbName: string): Promise<any> {
    return this._client.databases.beginResume(
      sqlInfo.resourceGroupName,
      sqlInfo.resourceName,
      dbName,
    );
  }

  public async resumeAllDbs(sqlInfo: ResourceArgs) {
    const dbs = await this.listDbs(sqlInfo);
    await Promise.all(dbs.map((d) => this.resumeDb(sqlInfo, d.name!)));
  }

  private listDbs(sqlInfo: ResourceArgs) {
    return collect(
      this._client.databases.listByServer(
        sqlInfo.resourceGroupName,
        sqlInfo.resourceName,
      ),
    );
  }
}
