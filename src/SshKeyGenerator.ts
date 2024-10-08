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
}

interface SshKeyOutputs extends SshKeyInputs {
  password: string;
  privateKey: string;
  publicKey: string;
}

class SshKeyResourceProvider
  implements BaseProvider<SshKeyInputs, SshKeyOutputs>
{
  constructor(private name: string) {}

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

    return {
      id: this.name,
      outs: {
        password: inputs.password,
        publicKey,
        privateKey,
      },
    };
  }

  /** The method will be executed when pulumi resource is updating.
   * We do nothing here but just return the output that was created before*/
  async update(
    id: string,
    old: SshKeyOutputs,
    news: SshKeyInputs,
  ): Promise<pulumi.dynamic.UpdateResult<SshKeyOutputs>> {
    //no update needed
    return { outs: old };
  }
}

export class SshKeyResource extends BaseResource<SshKeyInputs, SshKeyOutputs> {
  declare readonly name: string;
  declare readonly publicKey: pulumi.Output<string>;
  declare readonly privateKey: pulumi.Output<string>;
  declare readonly password: pulumi.Output<string>;

  constructor(
    name: string,
    args: BaseOptions<SshKeyInputs>,
    opts?: pulumi.CustomResourceOptions,
  ) {
    const innerOpts = pulumi.mergeOptions(opts, {
      //This is important to tell pulumi to encrypt these outputs in the state. The encrypting and decrypting will be handled bt pulumi automatically
      additionalSecretOutputs: ['publicKey', 'privateKey', 'password'],
    });

    const innerInputs = {
      publicKey: undefined,
      privateKey: undefined,
      //This to tell pulumi that this input is a secret, and it will be encrypted in the state as well.
      password: pulumi.secret(args.password),
    };

    super(
      new SshKeyResourceProvider(name),
      `csp:SshGenerator:${name}`,
      innerInputs,
      innerOpts,
    );
  }
}

//Export the SshGenerator resource as default of the module
export default SshKeyResource;
