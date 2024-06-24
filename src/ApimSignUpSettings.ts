/* eslint-disable  @typescript-eslint/no-unsafe-return */

import { ApiManagementClient } from "@azure/arm-apimanagement";
import { DefaultAzureCredential } from "@azure/identity";
import * as pulumi from "@pulumi/pulumi";

import {
  BaseOptions,
  BaseProvider,
  BaseResource,
  DefaultInputs,
  DefaultOutputs,
} from "./BaseProvider";

interface ApimSignUpSettingsInputs extends DefaultInputs {
  resourceGroupName: string;
  serviceName: string;
  subscriptionId: string;
  enabled: boolean;
  termsOfService: {
    enabled: boolean;
    text: string;
    consentRequired: boolean;
  };
}

interface ApimSignUpSettingsOutputs
  extends ApimSignUpSettingsInputs,
    DefaultOutputs {}

class ApimSignUpSettingsResourceProvider
  implements BaseProvider<ApimSignUpSettingsInputs, ApimSignUpSettingsOutputs>
{
  constructor(private name: string) {}

  async create(
    props: ApimSignUpSettingsInputs,
  ): Promise<pulumi.dynamic.CreateResult> {
    const client = new ApiManagementClient(
      new DefaultAzureCredential(),
      props.subscriptionId,
    );

    await client.signUpSettings.createOrUpdate(
      props.resourceGroupName,
      props.serviceName,
      {
        enabled: props.enabled,
        termsOfService: props.termsOfService,
      },
    );

    return {
      id: this.name,
      outs: props,
    };
  }

  async update(
    id: string,
    olds: ApimSignUpSettingsOutputs,
    news: ApimSignUpSettingsInputs,
  ): Promise<pulumi.dynamic.UpdateResult> {
    return this.create(news);
  }

  async delete(id: string, props: ApimSignUpSettingsOutputs): Promise<void> {
    const client = new ApiManagementClient(
      new DefaultAzureCredential(),
      props.subscriptionId,
    );

    await client.signUpSettings
      .createOrUpdate(props.resourceGroupName, props.serviceName, {
        enabled: true,
        termsOfService: { consentRequired: true, enabled: true },
      })
      .catch();
  }
}

export class ApimSignUpSettingsResource extends BaseResource<
  ApimSignUpSettingsInputs,
  ApimSignUpSettingsOutputs
> {
  public readonly name: string;

  constructor(
    name: string,
    args: BaseOptions<ApimSignUpSettingsInputs>,
    opts?: pulumi.CustomResourceOptions,
  ) {
    super(
      new ApimSignUpSettingsResourceProvider(name),
      `csp:ApimSignUpSettings:${name}`,
      args,
      opts,
    );
    this.name = name;
  }
}
