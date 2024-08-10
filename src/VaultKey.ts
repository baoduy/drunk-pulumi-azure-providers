import * as pulumi from '@pulumi/pulumi';
import getKeyVaultBase, { KeyArgs } from './AzBase/KeyVaultBase';
import { helpers } from './AzBase';
import { BaseOptions, BaseProvider, BaseResource } from './BaseProvider';
import { KeyVaultKey } from '@azure/keyvault-keys';

interface VaultKeyInputs {
  name: string;
  key: KeyArgs;
  vaultName: string;
}

interface VaultKeyOutputs {
  id: string;
  name: string;
  vaultName: string;
  vaultUrl: string;
  version: string;
}

class VaultKeyResourceProvider
  implements BaseProvider<VaultKeyInputs, VaultKeyOutputs>
{
  constructor(private name: string) {}

  async create(
    props: VaultKeyInputs,
  ): Promise<pulumi.dynamic.CreateResult<VaultKeyOutputs>> {
    const client = getKeyVaultBase(props.vaultName);
    let key: KeyVaultKey | undefined;

    //Key is existed
    if (await client.checkKeyExist(props.name)) {
      key = await client.getKey(props.name);
    } else key = await client.createRsaKey(props.name, props.key);

    //Await and re-load
    if (!key) {
      key = await helpers.waitAndRetry(() => client.getKey(props.name));
    }

    return {
      id: key?.id ?? key?.properties.id!,
      outs: {
        id: key?.id ?? key?.properties.id!,
        name: key?.properties.name!,
        vaultName: props.vaultName,
        vaultUrl: key?.properties.vaultUrl!,
        version: key?.properties.version!,
      },
    };
  }

  public async update(
    id: string,
    olds: VaultKeyOutputs,
    news: VaultKeyInputs,
  ): Promise<pulumi.dynamic.UpdateResult> {
    return await this.create(news);
  }

  async delete(id: string, props: VaultKeyOutputs): Promise<void> {
    if (!props || !props.vaultName) {
      console.error(`${this.name} - vaultName is undefined.`);
      return;
    }
    const client = getKeyVaultBase(props.vaultName);
    return client.deleteKey(props.name).catch();
  }
}

export class VaultKeyResource extends BaseResource<
  VaultKeyInputs,
  VaultKeyOutputs
> {
  declare readonly name: pulumi.Output<string>;
  declare readonly vaultName: pulumi.Output<string>;
  declare readonly vaultUrl: pulumi.Output<string>;
  declare readonly version: pulumi.Output<string>;

  constructor(
    name: string,
    args: BaseOptions<VaultKeyInputs>,
    opts?: pulumi.CustomResourceOptions,
  ) {
    super(
      new VaultKeyResourceProvider(name),
      `csp:VaultKeys:${name}`,
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
