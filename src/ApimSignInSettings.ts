/* eslint-disable  @typescript-eslint/no-unsafe-return */

import { ApiManagementClient } from '@azure/arm-apimanagement';
import { DefaultAzureCredential } from '@azure/identity';
import * as pulumi from '@pulumi/pulumi';

import {
  BaseOptions,
  BaseProvider,
  BaseResource,
  DefaultInputs,
  DefaultOutputs,
} from './BaseProvider';
import { ResourceArgs } from './types';

interface ApimSignInSettingsInputs
  extends Omit<ResourceArgs, 'resourceName'>,
    DefaultInputs {
  serviceName: string;
  subscriptionId: string;
  enabled: boolean;
}

interface ApimSignInSettingsOutputs
  extends ApimSignInSettingsInputs,
    DefaultOutputs {}

class ApimSignInSettingsResourceProvider
  implements BaseProvider<ApimSignInSettingsInputs, ApimSignInSettingsOutputs>
{
  constructor(private name: string) {}

  async create(
    props: ApimSignInSettingsInputs,
  ): Promise<pulumi.dynamic.CreateResult> {
    const client = new ApiManagementClient(
      new DefaultAzureCredential(),
      props.subscriptionId,
    );

    await client.signInSettings.createOrUpdate(
      props.resourceGroupName,
      props.serviceName,
      {
        enabled: props.enabled,
      },
    );

    return {
      id: this.name,
      outs: props,
    };
  }

  async update(
    id: string,
    olds: ApimSignInSettingsOutputs,
    news: ApimSignInSettingsInputs,
  ): Promise<pulumi.dynamic.UpdateResult> {
    return this.create(news);
  }

  async delete(id: string, props: ApimSignInSettingsOutputs): Promise<void> {
    const client = new ApiManagementClient(
      new DefaultAzureCredential(),
      props.subscriptionId,
    );

    await client.signInSettings
      .createOrUpdate(props.resourceGroupName, props.serviceName, {
        enabled: true,
      })
      .catch();
  }
}

export class ApimSignInSettingsResource extends BaseResource<
  ApimSignInSettingsInputs,
  ApimSignInSettingsOutputs
> {
  public readonly name: string;

  constructor(
    name: string,
    args: BaseOptions<ApimSignInSettingsInputs>,
    opts?: pulumi.CustomResourceOptions,
  ) {
    super(
      new ApimSignInSettingsResourceProvider(name),
      `csp:ApimSignInSettings:${name}`,
      args,
      opts,
    );
    this.name = name;
  }
}
