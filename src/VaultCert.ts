import * as pulumi from '@pulumi/pulumi';
import getKeyVaultBase, { CertArgs } from './AzBase/KeyVaultBase';
import { helpers } from './AzBase';
import { BaseOptions, BaseProvider, BaseResource } from './BaseProvider';
import { KeyVaultCertificateWithPolicy } from '@azure/keyvault-certificates';

interface VaultCertInputs {
  name: string;
  cert: CertArgs;
  vaultName: string;
}

interface VaultCertOutputs {
  id: string;
  name: string;
  vaultName: string;
  vaultUrl: string;
  version: string;
}

class VaultCertResourceProvider
  implements BaseProvider<VaultCertInputs, VaultCertOutputs>
{
  constructor(private readonly name: string) {}

  async create(
    props: VaultCertInputs,
  ): Promise<pulumi.dynamic.CreateResult<VaultCertOutputs>> {
    const client = getKeyVaultBase(props.vaultName);
    let cert: KeyVaultCertificateWithPolicy | undefined;

    //Cert is existed
    if (await client.checkCertExist(props.name)) {
      cert = await client.getCert(props.name);
    } else
      cert = await (
        await client.createSelfSignCert(props.name, props.cert)
      ).pollUntilDone();

    //Await and re-load
    if (!cert) {
      cert = await helpers.waitAndRetry(() => client.getCert(props.name));
    }

    return {
      id: cert!.id ?? cert!.properties.id!,
      outs: {
        id: cert!.id ?? cert!.properties.id!,
        name: cert!.name!,
        version: cert!.properties.version!,
        vaultName: props.vaultName,
        vaultUrl: cert!.properties.vaultUrl!,
      },
    };
  }

  public async update(
    id: string,
    olds: VaultCertOutputs,
    news: VaultCertInputs,
  ): Promise<pulumi.dynamic.UpdateResult> {
    const rs = await this.create(news);
    return { outs: rs.outs };
  }

  async delete(id: string, props: VaultCertOutputs): Promise<void> {
    const client = getKeyVaultBase(props.vaultName);
    return client.deleteCert(props.name).catch();
  }
}

export class VaultCertResource extends BaseResource<
  VaultCertInputs,
  VaultCertOutputs
> {
  declare readonly name: pulumi.Output<string>;
  declare readonly vaultName: pulumi.Output<string>;
  declare readonly vaultUrl: pulumi.Output<string>;
  declare readonly version: pulumi.Output<string>;

  constructor(
    name: string,
    args: BaseOptions<VaultCertInputs>,
    opts?: pulumi.CustomResourceOptions,
  ) {
    super(
      new VaultCertResourceProvider(name),
      `csp:VaultCerts:${name}`,
      {
        vaultUrl: undefined,
        version: undefined,
        ...args,
        name: args.name ?? name,
      },
      opts,
    );
  }
}
