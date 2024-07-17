import * as pulumi from '@pulumi/pulumi';
import getKeyVaultBase, { CertArgs } from './AzBase/KeyVaultBase';
import {
  BaseOptions,
  BaseProvider,
  BaseResource,
  DefaultInputs,
  DefaultOutputs,
} from './BaseProvider';
import * as console from 'console';

interface VaultCertInputs extends DefaultInputs {
  name: string;
  cert: CertArgs;
  vaultName: string;

  tags?: {
    [key: string]: string;
  };
}

interface VaultCertOutputs extends VaultCertInputs, DefaultOutputs {}

class VaultCertResourceProvider
  implements BaseProvider<VaultCertInputs, VaultCertOutputs>
{
  constructor(private name: string) {}

  async create(props: VaultCertInputs): Promise<pulumi.dynamic.CreateResult> {
    const rs = {
      id: this.name,
      outs: props,
    };

    if (!props || !props.vaultName) {
      console.error(`${this.name} - vaultName is undefined.`);
      return rs;
    }

    const client = getKeyVaultBase(props.vaultName);

    const n = props.name ?? this.name;
    const ss = await client
      .createSelfSignCert(n, props.cert, props.tags)
      .catch(console.error);

    const cert = await ss!.pollUntilDone();
    rs.id = cert.id ?? this.name;
    return rs;
  }

  async delete(id: string, props: VaultCertOutputs): Promise<void> {
    if (!props || !props.vaultName) {
      console.error(`${this.name} - vaultName is undefined.`);
      return;
    }
    const client = getKeyVaultBase(props.vaultName);
    return client.deleteCert(props.name).catch();
  }
}

export class VaultCertResource extends BaseResource<
  VaultCertInputs,
  VaultCertOutputs
> {
  public readonly name: string;

  constructor(
    name: string,
    args: BaseOptions<VaultCertInputs>,
    opts?: pulumi.CustomResourceOptions,
  ) {
    super(
      new VaultCertResourceProvider(name),
      `csp:VaultCerts:${name}`,
      args,
      opts,
    );
    this.name = name;
  }
}
