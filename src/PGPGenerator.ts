import * as pulumi from '@pulumi/pulumi';
import { BaseOptions, BaseProvider, BaseResource } from './BaseProvider';
import { diffProps } from './AzBase/Helpers';

type UserInfo = { name: string; email: string };
export interface PGPProps {
  user: UserInfo;
  passphrase?: string;
  type?: 'ecc' | 'rsa';
  validDays?: number;
}

export const generatePGP = async ({
  user,
  passphrase,
  type,
  validDays,
}: PGPProps): Promise<{
  publicKey: string;
  privateKey: string;
  revocationCertificate: string;
}> => {
  const { generateKey } = await import('openpgp');

  return generateKey({
    // Ed25519/Cv25519: native in openpgp and widely supported by GnuPG (brainpool needs an optional native module).
    curve: 'curve25519Legacy',
    format: 'armored',
    type: type ?? 'rsa',
    date: new Date(),
    // openpgp expects seconds from key creation, not a timestamp.
    keyExpirationTime: validDays ? validDays * 24 * 60 * 60 : undefined,
    passphrase,
    userIDs: [user],
  });
};

type PGPInputs = PGPProps;

interface PGPOutputs extends PGPInputs {
  publicKey: string;
  privateKey: string;
  revocationCertificate: string;
}

class PGPResourceProvider implements BaseProvider<PGPInputs, PGPOutputs> {
  constructor(private name: string) {}

  async create(
    inputs: PGPInputs,
  ): Promise<pulumi.dynamic.CreateResult<PGPOutputs>> {
    const { publicKey, privateKey, revocationCertificate } =
      await generatePGP(inputs);

    return {
      id: this.name,
      outs: {
        ...inputs,
        publicKey,
        privateKey,
        revocationCertificate,
      },
    };
  }

  /** Any input change regenerates the key. */
  async diff(_id: string, olds: PGPOutputs, news: PGPInputs) {
    return diffProps(olds, news, {
      replaceKeys: ['user', 'passphrase', 'type', 'validDays'],
      outputKeys: ['publicKey', 'privateKey', 'revocationCertificate'],
    });
  }
}

export class PGPResource extends BaseResource<PGPInputs, PGPOutputs> {
  declare readonly name: string;
  declare readonly publicKey: pulumi.Output<string>;
  declare readonly privateKey: pulumi.Output<string>;
  declare readonly revocationCertificate: pulumi.Output<string>;
  declare readonly passphrase?: pulumi.Output<string>;

  constructor(
    name: string,
    args: BaseOptions<PGPInputs>,
    opts?: pulumi.CustomResourceOptions,
  ) {
    const innerOpts = pulumi.mergeOptions(opts, {
      additionalSecretOutputs: [
        'publicKey',
        'privateKey',
        'passphrase',
        'revocationCertificate',
      ],
    });
    const innerInputs = {
      publicKey: undefined,
      privateKey: undefined,
      revocationCertificate: undefined,
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

export default PGPResource;
