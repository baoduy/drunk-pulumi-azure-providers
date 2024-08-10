import * as pulumi from '@pulumi/pulumi';
import { generateKey, SerializedKeyPair } from 'openpgp';
import { BaseOptions, BaseProvider, BaseResource } from './BaseProvider';
import getKeyVaultBase from './AzBase/KeyVaultBase';

type UserInfo = { name: string; email: string };
export interface PGPProps {
  user: UserInfo;
  passphrase?: string;
  type?: 'ecc' | 'rsa';
  validDays?: number;
}

const generatePGP = ({ user, passphrase, type, validDays }: PGPProps) => {
  const now = new Date();
  const expireDate = new Date();
  if (validDays) expireDate.setDate(expireDate.getDate() + validDays);

  return generateKey({
    curve: 'ed25519',
    format: 'armored',
    type: type ?? 'rsa',
    date: now,
    keyExpirationTime: validDays ? expireDate.getTime() : undefined,
    passphrase,
    userIDs: [user],
  });
};

interface PGPInputs extends PGPProps {
  vaultName: string;
}

type SecretNames = {
  publicKeyName: string;
  privateKeyName: string;
  revocationCertificateName: string;
};

interface PGPOutputs extends PGPInputs {
  publicKey: string;
  vaultSecretNames: SecretNames;
}

class PGPResourceProvider implements BaseProvider<PGPInputs, PGPOutputs> {
  constructor(private name: string) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async diff(
    id: string,
    previousOutput: PGPOutputs,
    news: PGPInputs,
  ): Promise<pulumi.dynamic.DiffResult> {
    return {
      deleteBeforeReplace: false,
      changes:
        previousOutput.passphrase !== news.passphrase ||
        previousOutput.validDays !== news.validDays ||
        previousOutput.type !== news.type,
    };
  }

  async create(
    inputs: PGPInputs,
  ): Promise<pulumi.dynamic.CreateResult<PGPOutputs>> {
    const { publicKey, privateKey, revocationCertificate } =
      await generatePGP(inputs);

    const publicKeyName = `${this.name}-publicKey`;
    const privateKeyName = `${this.name}-privateKey`;
    const revocationCertificateName = `${this.name}-revocationCertificate`;

    //Create Key Vault items
    const client = getKeyVaultBase(inputs.vaultName);
    await client.setSecret(publicKeyName, publicKey, this.name);
    await client.setSecret(privateKeyName, privateKey, this.name);
    await client.setSecret(
      revocationCertificateName,
      revocationCertificate,
      this.name,
    );

    return {
      id: this.name,
      outs: {
        ...inputs,
        publicKey,
        //privateKey,
        vaultSecretNames: {
          publicKeyName,
          privateKeyName,
          revocationCertificateName,
        },
      },
    };
  }

  async delete(id: string, outputs: PGPOutputs): Promise<void> {
    //Delete Vaults info
    if (!outputs.vaultSecretNames) return;

    const client = getKeyVaultBase(outputs.vaultName);
    await Promise.all([
      client.deleteSecret(outputs.vaultSecretNames.publicKeyName),
      client.deleteSecret(outputs.vaultSecretNames.privateKeyName),
      client.deleteSecret(outputs.vaultSecretNames.revocationCertificateName),
    ]).catch(console.error);
  }
}

export class PGPResource extends BaseResource<PGPInputs, PGPOutputs> {
  declare readonly name: string;
  declare readonly publicKey: pulumi.Output<string>;
  //declare readonly privateKey: pulumi.Output<string>;
  declare readonly vaultName: pulumi.Output<string>;
  declare readonly vaultSecretNames: pulumi.Output<SecretNames>;

  constructor(
    name: string,
    args: BaseOptions<PGPInputs>,
    opts?: pulumi.CustomResourceOptions,
  ) {
    const innerOpts = pulumi.mergeOptions(opts, {
      additionalSecretOutputs: ['publicKey', 'privateKey', 'passphrase'],
    });
    const innerInputs = {
      publicKey: undefined,
      //privateKey: undefined,
      vaultSecretNames: undefined,
      ...args,
      passphrase: args.passphrase ? pulumi.secret(args.passphrase) : undefined,
    };
    super(
      new PGPResourceProvider(name),
      `csp:PGPs:${name}`,
      innerInputs,
      innerOpts,
    );
    this.name = name;
  }
}
