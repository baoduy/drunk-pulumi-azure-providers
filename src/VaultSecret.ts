import * as pulumi from "@pulumi/pulumi";
import { getKeyVaultBase } from "./AzBase/KeyVaultBase";
import {
  BaseOptions,
  BaseProvider,
  BaseResource,
  DefaultInputs,
  DefaultOutputs,
} from "./BaseProvider";
import * as console from "console";

interface VaultSecretInputs extends DefaultInputs {
  name: string;
  value: string;
  vaultName: string;
  contentType?: string;
  ignoreChange?: boolean;
  tags?: {
    [key: string]: string;
  };
}

interface VaultSecretOutputs extends VaultSecretInputs, DefaultOutputs {}

class VaultSecretResourceProvider
  implements BaseProvider<VaultSecretInputs, VaultSecretOutputs>
{
  constructor(private name: string) {}

  async create(props: VaultSecretInputs): Promise<pulumi.dynamic.CreateResult> {
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
      .setSecret(n, props.value, props.contentType, props.tags)
      .catch(console.error);

    rs.id = ss!.properties.id ?? this.name;
    return rs;
  }

  async update(
    id: string,
    olds: VaultSecretOutputs,
    news: VaultSecretInputs,
  ): Promise<pulumi.dynamic.UpdateResult> {
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

  async delete(id: string, props: VaultSecretOutputs): Promise<void> {
    if (!props || !props.vaultName) {
      console.error(`${this.name} - vaultName is undefined.`);
      return;
    }
    const client = getKeyVaultBase(props.vaultName);
    return client.deleteSecret(props.name).catch();
  }
}

export class VaultSecretResource extends BaseResource<
  VaultSecretInputs,
  VaultSecretOutputs
> {
  public readonly name: string;

  constructor(
    name: string,
    args: BaseOptions<VaultSecretInputs>,
    opts?: pulumi.CustomResourceOptions,
  ) {
    super(
      new VaultSecretResourceProvider(name),
      `csp:VaultSecrets:${name}`,
      args,
      opts,
    );
    this.name = name;
  }
}
