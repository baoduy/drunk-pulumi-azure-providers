import * as pulumi from "@pulumi/pulumi";
import {
  BaseOptions,
  BaseResource,
  DefaultInputs,
  DefaultOutputs,
  BaseProvider,
} from "./BaseProvider";
import {
  CdnManagedHttpsParameters,
  CdnManagementClient,
  UserManagedHttpsParameters,
} from "@azure/arm-cdn";
import { DefaultAzureCredential } from "@azure/identity";

export interface CdnHttpsEnableInputs extends DefaultInputs {
  resourceGroupName: string;
  profileName: string;
  endpointName: string;
  customDomainName: string;
  subscriptionId: string;

  vaultSecretInfo?: {
    resourceGroupName: string;
    secretName: string;
    secretVersion: string;
    vaultName: string;
  };
}

export interface CdnHttpsEnableOutputs
  extends CdnHttpsEnableInputs,
    DefaultOutputs {}

class CdnHttpsEnableProvider
  implements BaseProvider<CdnHttpsEnableInputs, CdnHttpsEnableOutputs>
{
  constructor(private name: string) {}

  async create(
    props: CdnHttpsEnableInputs,
  ): Promise<pulumi.dynamic.CreateResult> {
    const client = new CdnManagementClient(
      new DefaultAzureCredential(),
      props.subscriptionId,
    );

    const customDomainHttpsParameters = props.vaultSecretInfo
      ? ({
          certificateSource: "AzureKeyVault",
          certificateSourceParameters: {
            typeName: "KeyVaultCertificateSourceParameters",
            "@odata.type":
              "#Microsoft.Azure.Cdn.Models.KeyVaultCertificateSourceParameters",
            deleteRule: "NoAction",
            updateRule: "NoAction",
            subscriptionId: props.subscriptionId,
            ...props.vaultSecretInfo,
          },
          protocolType: "ServerNameIndication",
          minimumTlsVersion: "TLS12",
        } as UserManagedHttpsParameters)
      : ({
          certificateSource: "Cdn",
          certificateSourceParameters: {
            typeName: "CdnCertificateSourceParameters",
            certificateType: "Dedicated",
            "@odata.type":
              "#Microsoft.Azure.Cdn.Models.CdnCertificateSourceParameters",
          },
          protocolType: "ServerNameIndication",
          minimumTlsVersion: "TLS12",
        } as CdnManagedHttpsParameters);

    const rs = await client.customDomains.beginEnableCustomHttps(
      props.resourceGroupName,
      props.profileName,
      props.endpointName,
      props.customDomainName,
      {
        customDomainHttpsParameters,
      },
    );

    return {
      id: `/subscriptions/${props.subscriptionId}/resourcegroups/${props.resourceGroupName}/providers/Microsoft.Cdn/profiles/${props.profileName}/endpoints/${props.endpointName}/customdomains/${props.customDomainName}`,
      outs: props,
    };
  }
}

export default class CdnHttpsEnableResource extends BaseResource<
  CdnHttpsEnableInputs,
  CdnHttpsEnableOutputs
> {
  public readonly name: string;

  constructor(
    name: string,
    props: BaseOptions<CdnHttpsEnableInputs>,
    opts?: pulumi.CustomResourceOptions,
  ) {
    super(
      new CdnHttpsEnableProvider(name),
      `azure-native:custom:CdnHttpsEnableProvider:${name}`,
      props,
      opts,
    );
    this.name = name;
  }
}
