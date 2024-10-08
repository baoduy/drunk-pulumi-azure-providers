import * as pulumi from '@pulumi/pulumi';
import { generateKey } from 'openpgp';
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
  user: UserInfo;
  passphrase?: string;
}

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

  /** The method will be executed when pulumi resource is updating.
   * We do nothing here but just return the output that was created before*/
  async update(
    id: string,
    old: PGPOutputs,
    news: PGPInputs,
  ): Promise<pulumi.dynamic.UpdateResult<PGPOutputs>> {
    //no update needed
    return { outs: old };
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
