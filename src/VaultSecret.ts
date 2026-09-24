import * as pulumi from '@pulumi/pulumi';
import getKeyVaultBase from './AzBase/KeyVaultBase';
import { BaseOptions, BaseProvider, BaseResource } from './BaseProvider';
import { diffProps, waitAndRetry } from './AzBase/Helpers';
import { KeyVaultSecret } from '@azure/keyvault-secrets';

interface VaultSecretInputs {
  name: string;
  value: string;
  vaultName: string;
  contentType?: string;
  ignoreChange?: boolean;
  tags?: {
    [key: string]: string;
  };
}

interface VaultSecretOutputs extends Omit<VaultSecretInputs, 'value'> {
  version: string;
  vaultUrl: string;
}

class VaultSecretResourceProvider
  implements BaseProvider<VaultSecretInputs, VaultSecretOutputs>
{
  constructor(private name: string) {}

  async create(
    props: VaultSecretInputs,
  ): Promise<pulumi.dynamic.CreateResult<VaultSecretOutputs>> {
    const client = getKeyVaultBase(props.vaultName);

    let ss: KeyVaultSecret | undefined = await client.setSecret(
      props.name,
      props.value,
      props.contentType,
      props.tags,
    );

    if (!ss) {
      ss = await waitAndRetry(() => client.getSecret(props.name));
    }

    return {
      id: ss!.properties.id!,
      outs: {
        ...props,
        version: ss!.properties.version!,
        vaultUrl: ss!.properties.vaultUrl!,
      },
    };
  }

  /** Renaming or moving the secret replaces it (new created, old deleted). */
  async diff(_id: string, olds: VaultSecretOutputs, news: VaultSecretInputs) {
    if (news.ignoreChange) {
      console.log(`the ${news.name} will be ignored from the update.`);
      return { changes: false };
    }
    return diffProps(olds, news, {
      replaceKeys: ['name', 'vaultName'],
      outputKeys: ['version', 'vaultUrl'],
    });
  }

  async update(
    _id: string,
    _olds: VaultSecretOutputs,
    news: VaultSecretInputs,
  ): Promise<pulumi.dynamic.UpdateResult<VaultSecretOutputs>> {
    const { outs } = await this.create(news);
    return { outs };
  }

  async delete(id: string, props: VaultSecretOutputs) {
    if (!props || !props.vaultName) {
      console.error(`${this.name} - vaultName is undefined.`);
      return;
    }
    const client = getKeyVaultBase(props.vaultName);
    return client.deleteSecret(props.name);
  }
}

export class VaultSecretResource extends BaseResource<
  VaultSecretInputs,
  VaultSecretOutputs
> {
  declare readonly name: pulumi.Output<string>;
  declare readonly vaultName: pulumi.Output<string>;
  declare readonly vaultUrl: pulumi.Output<string>;
  declare readonly version: pulumi.Output<string>;

  constructor(
    name: string,
    args: BaseOptions<VaultSecretInputs>,
    opts?: pulumi.CustomResourceOptions,
  ) {
    const innerOpts = pulumi.mergeOptions(opts, {
      additionalSecretOutputs: ['value'],
    });
    const innerInputs = {
      vaultUrl: undefined,
      version: undefined,
      ...args,
      value: pulumi.secret(args.value),
    };
    super(
      new VaultSecretResourceProvider(name),
      `csp:VaultSecrets:${name}`,
      innerInputs,
      innerOpts,
    );
  }
}
