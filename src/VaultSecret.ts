import * as pulumi from '@pulumi/pulumi';
import getKeyVaultBase from './AzBase/KeyVaultBase';
import { BaseOptions, BaseProvider, BaseResource } from './BaseProvider';
import { helpers } from './AzBase';
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
      ss = await helpers.waitAndRetry(() => client.getSecret(props.name));
    }

    return {
      id: ss?.properties.id!,
      outs: {
        ...props,
        version: ss?.properties.version!,
        vaultUrl: ss?.properties.vaultUrl!,
      },
    };
  }

  async update(
    id: string,
    olds: VaultSecretOutputs,
    news: VaultSecretInputs,
  ): Promise<pulumi.dynamic.UpdateResult<VaultSecretOutputs>> {
    if (olds.ignoreChange || news.ignoreChange) {
      console.log(`the ${news.name} will be ignored from the update.`);
      return { outs: olds };
    }

    //Create the new secret
    const rs = await this.create(news);
    //Delete the old Secret
    if (olds.name !== news.name || olds.vaultName !== news.vaultName)
      await this.delete(id, olds).catch();

    return rs;
  }

  async delete(id: string, props: VaultSecretOutputs) {
    if (!props || !props.vaultName) {
      console.error(`${this.name} - vaultName is undefined.`);
      return;
    }
    const client = getKeyVaultBase(props.vaultName);
    return await client.deleteSecret(props.name).catch();
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
