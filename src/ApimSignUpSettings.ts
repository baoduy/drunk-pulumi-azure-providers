/* eslint-disable  @typescript-eslint/no-unsafe-return */

import * as pulumi from '@pulumi/pulumi';
import {createAxios} from './Tools/Axios';

import {
  BaseOptions,
  BaseProvider,
  BaseResource,
  DefaultInputs,
  DefaultOutputs,
} from './BaseProvider';

interface ApimSignUpSettingsInputs extends DefaultInputs {
  resourceGroupName: string;
  serviceName: string;
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

  // eslint-disable-next-line @typescript-eslint/require-await
  async diff(
    id: string,
    previousOutput: ApimSignUpSettingsOutputs,
    news: ApimSignUpSettingsInputs
  ): Promise<pulumi.dynamic.DiffResult> {
    return {
      deleteBeforeReplace:
        previousOutput.resourceGroupName !== news.resourceGroupName ||
        previousOutput.serviceName !== news.serviceName,
      replaces: [],
      changes:
        previousOutput.enabled !== news.enabled ||
        previousOutput.resourceGroupName !== news.resourceGroupName ||
        previousOutput.serviceName !== news.serviceName,
    };
  }

  async create({
    resourceGroupName,
    serviceName,
    enabled,
    termsOfService,
  }: ApimSignUpSettingsInputs): Promise<pulumi.dynamic.CreateResult> {
    //TODO: Workaround for this issue https://github.com/pulumi/pulumi/issues/5294
    const axios = createAxios();
    const url = `/resourceGroups/${resourceGroupName}/providers/Microsoft.ApiManagement/service/${serviceName}/portalsettings/signup?api-version=2020-06-01-preview`;
    const rs = await axios
      .put(url, {
        properties: {
          enabled: true,
          termsOfService,
        },
      })
      .then((rs) => rs.data);

    return {
      id: this.name,
      outs: { ...rs, resourceGroupName, serviceName, enabled, termsOfService },
    };
  }

  async update(
    id: string,
    olds: ApimSignUpSettingsOutputs,
    news: ApimSignUpSettingsInputs
  ): Promise<pulumi.dynamic.UpdateResult> {
    return this.create(news);
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
    opts?: pulumi.CustomResourceOptions
  ) {
    super(
      new ApimSignUpSettingsResourceProvider(name),
      `csp:ApimSignUpSettings:${name}`,
      args,
      opts
    );
    this.name = name;
  }
}
