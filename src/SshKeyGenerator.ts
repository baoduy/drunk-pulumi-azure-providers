import * as forge from 'node-forge';
import * as pulumi from '@pulumi/pulumi';
import { generateKeyPair } from 'crypto';
import { promisify } from 'util';
import { BaseOptions, BaseProvider, BaseResource } from './BaseProvider';
import { diffProps } from './AzBase/Helpers';

const generateKeyPairAsync = promisify(generateKeyPair);

/** RSA 4096 key pair in OpenSSH format; the private key is encrypted with `password`. */
export const generateSshKeys = async (password: string) => {
  const { publicKey, privateKey } = await generateKeyPairAsync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  });

  return {
    publicKey: forge.ssh.publicKeyToOpenSSH(forge.pki.publicKeyFromPem(publicKey)),
    privateKey: forge.ssh.privateKeyToOpenSSH(
      forge.pki.privateKeyFromPem(privateKey),
      password,
    ),
  };
};

interface SshKeyInputs {
  password: string;
}

interface SshKeyOutputs extends SshKeyInputs {
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
    const { publicKey, privateKey } = await generateSshKeys(inputs.password);

    return {
      id: this.name,
      outs: { password: inputs.password, publicKey, privateKey },
    };
  }

  /** Changing the password regenerates the key pair. */
  async diff(_id: string, olds: SshKeyOutputs, news: SshKeyInputs) {
    return diffProps(olds, news, {
      replaceKeys: ['password'],
      outputKeys: ['publicKey', 'privateKey'],
    });
  }
}

export class SshKeyResource extends BaseResource<SshKeyInputs, SshKeyOutputs> {
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
