import * as pulumi from "@pulumi/pulumi";
import { KeyVaultInfo } from "./types";
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
    const client = getKeyVaultBase(props.vaultName);

    const n = props.name ?? this.name;
    if (!n) throw new Error("The name is not defined.");

    const ss = await client
      .setSecret(
        props.name ?? this.name,
        props.value,
        props.contentType,
        props.tags,
      )
      .catch(console.error);

    return {
      id: ss!.properties.id || this.name,
      outs: { name: props.name, contentType: props.contentType },
    };
  }

  async update(
    id: string,
    olds: VaultSecretOutputs,
    news: VaultSecretInputs,
  ): Promise<pulumi.dynamic.UpdateResult> {
    if (olds.ignoreChange || news.ignoreChange) {
      console.log(`${news.name} will be ignored the update.`);
      return { outs: { id, ...olds, ...news } };
    }

    const rs = await this.create(news);

    //Delete the old Secret
    if (olds.name !== news.name || olds.vaultName !== news.vaultName)
      await this.delete(id, olds).catch();

    return rs;
  }

  async delete(id: string, props: VaultSecretOutputs): Promise<void> {
    const client = getKeyVaultBase(props.vaultName);
    return client.deleteSecret(props.name).catch();
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async diff(
    id: string,
    previousOutput: VaultSecretOutputs,
    news: VaultSecretInputs,
  ): Promise<pulumi.dynamic.DiffResult> {
    return {
      deleteBeforeReplace: false,
      changes:
        previousOutput.name !== news.name ||
        previousOutput.vaultName !== news.vaultName ||
        previousOutput.value !== news.value ||
        previousOutput.contentType !== news.contentType,
    };
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
