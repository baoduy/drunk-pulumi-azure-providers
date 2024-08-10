import * as forge from 'node-forge';
import * as pulumi from '@pulumi/pulumi';
import { BaseOptions, BaseProvider, BaseResource } from './BaseProvider';
import { generateKeyPair, RSAKeyPairOptions } from 'crypto';
import getKeyVaultBase from './AzBase/KeyVaultBase';

const generateKeys = (options: RSAKeyPairOptions<'pem', 'pem'>) =>
  new Promise<{ publicKey: string; privateKey: string }>((resolve, reject) => {
    generateKeyPair(
      'rsa',
      options,
      (err: Error | null, pK: string, prK: string) => {
        if (err) reject(err);

        const publicKey = forge.ssh.publicKeyToOpenSSH(
          forge.pki.publicKeyFromPem(pK),
        );
        const privateKey = forge.ssh.privateKeyToOpenSSH(
          forge.pki.decryptRsaPrivateKey(
            prK,
            options.privateKeyEncoding.passphrase,
          ),
        );

        resolve({ publicKey, privateKey });
      },
    );
  });

interface SshKeyInputs {
  password: string;
  vaultName: string;
}

type SecretNames = {
  publicKeyName: string;
  privateKeyName: string;
};

interface SshKeyOutputs extends SshKeyInputs {
  //privateKey: string;
  publicKey: string;
  vaultSecretNames: SecretNames;
}

class SshKeyResourceProvider
  implements BaseProvider<SshKeyInputs, SshKeyOutputs>
{
  constructor(private name: string) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  // async diff(
  //   id: string,
  //   previousOutput: SshKeyOutputs,
  //   news: SshKeyInputs,
  // ): Promise<pulumi.dynamic.DiffResult> {
  //   return {
  //     deleteBeforeReplace: false,
  //     changes: previousOutput.password !== news.password,
  //   };
  // }

  async create(
    inputs: SshKeyInputs,
  ): Promise<pulumi.dynamic.CreateResult<SshKeyOutputs>> {
    const { publicKey, privateKey } = await generateKeys({
      modulusLength: 4096,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
        cipher: 'aes-256-cbc',
        passphrase: inputs.password,
      },
    });

    const publicKeyName = `${this.name}-publicKey`;
    const privateKeyName = `${this.name}-privateKey`;

    //Create Key Vault items
    const client = getKeyVaultBase(inputs.vaultName);
    await client.setSecret(publicKeyName, publicKey, this.name);
    await client.setSecret(privateKeyName, privateKey, this.name);

    return {
      id: this.name,
      outs: {
        ...inputs,
        publicKey,
        vaultSecretNames: {
          publicKeyName,
          privateKeyName,
        },
      },
    };
  }

  async delete(id: string, outputs: SshKeyOutputs): Promise<void> {
    //Delete Vaults info
    if (!outputs.vaultSecretNames) return;

    const client = getKeyVaultBase(outputs.vaultName);
    await Promise.all([
      client.deleteSecret(outputs.vaultSecretNames.publicKeyName),
      client.deleteSecret(outputs.vaultSecretNames.privateKeyName),
    ]).catch(console.error);
  }
}

export class SshKeyResource extends BaseResource<SshKeyInputs, SshKeyOutputs> {
  declare readonly name: string;
  declare readonly publicKey: pulumi.Output<string>;
  //declare readonly privateKey: pulumi.Output<string>;
  declare readonly vaultName: pulumi.Output<string>;
  declare readonly vaultSecretNames: pulumi.Output<SecretNames>;

  constructor(
    name: string,
    args: BaseOptions<SshKeyInputs>,
    opts?: pulumi.CustomResourceOptions,
  ) {
    const innerOpts = pulumi.mergeOptions(opts, {
      additionalSecretOutputs: ['publicKey', 'privateKey', 'password'],
    });
    const innerInputs = {
      publicKey: undefined,
      //privateKey: undefined,
      vaultSecretNames: undefined,
      ...args,
      password: pulumi.secret(args.password),
    };

    super(
      new SshKeyResourceProvider(name),
      `csp:SshKeys:${name}`,
      innerInputs,
      innerOpts,
    );
  }
}
