import { Input } from '@pulumi/pulumi';

export type ResourceArgs = {
  resourceGroupName: string;
  resourceName: string;
};
export type ResourceInfo = ResourceArgs & {
  id: string;
  subscriptionId: string;
};
export interface ResourceGroupInfo {
  resourceGroupName: string;
  location?: Input<string>;
}

export interface KeyVaultInfo {
  name: string;
  group: ResourceGroupInfo;
  id: Input<string>;
}
