import { SecretClient, SecretProperties } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';
import { KeyClient, KeyProperties } from '@azure/keyvault-keys';
import {
  ArrayOneOrMore,
  CertificateClient,
  CertificateProperties,
  KnownKeyUsageTypes,
} from '@azure/keyvault-certificates';
import { getKeyVaultCache, KeyVaultCacheType } from './KeyVaultCache';

const isDryRun = Boolean(process.env.PULUMI_NODEJS_DRY_RUN);

type KeySizes = 2048 | 3072 | 4096;
type KeyTypes = 'EC' | 'EC-HSM' | 'RSA' | 'RSA-HSM' | 'oct';
type KeyOpsTypes =
  | 'decrypt'
  | 'encrypt'
  | 'sign'
  | 'verify'
  | 'wrapKey'
  | 'unwrapKey';

export type KeyArgs = {
  keySize?: KeySizes;
  keyOps?: Array<KeyOpsTypes>;
  tags?: { [p: string]: string };
};

export type CertArgs = {
  subject: string;
  dnsNames?: ArrayOneOrMore<string>;
  serverAuth?: boolean;
  validityInMonths?: number;
  keySize?: KeySizes;
  keyType?: KeyTypes;
  tags?: { [p: string]: string };
};

export class KeyVaultBase {
  private secretClient: SecretClient;
  private keyClient: KeyClient;
  private certClient: CertificateClient;
  private cache: KeyVaultCacheType;

  public constructor(private keyVaultName: string) {
    const url = `https://${keyVaultName}.vault.azure.net?api-version=7.0`;
    const credential = new DefaultAzureCredential();

    this.secretClient = new SecretClient(url, credential);
    this.keyClient = new KeyClient(url, credential);
    this.certClient = new CertificateClient(url, credential);
    this.cache = getKeyVaultCache(keyVaultName);
  }

  /** Get Secret Versions*/
  public async getSecretVersions(
    name: string,
    version: string | undefined = undefined,
  ) {
    const rs = this.secretClient
      .listPropertiesOfSecretVersions(name)
      .byPage({ maxPageSize: 10 });

    const versionsList = new Array<SecretProperties>();
    for await (const s of rs) {
      s.forEach((p) => versionsList.push(p));
    }

    //Filter for specific version only
    if (version) return versionsList.filter((s) => s.version === version);
    return versionsList;
  }

  /** Get Key Versions*/
  public async getKeyVersions(
    name: string,
    version: string | undefined = undefined,
  ) {
    const rs = this.keyClient
      .listPropertiesOfKeyVersions(name)
      .byPage({ maxPageSize: 10 });

    const versionsList = new Array<KeyProperties>();
    for await (const s of rs) {
      s.forEach((p) => versionsList.push(p));
    }

    //Filter for specific version only
    if (version) return versionsList.filter((s) => s.version === version);
    return versionsList;
  }

  /** Get Cert Versions*/
  public async getCertVersions(
    name: string,
    version: string | undefined = undefined,
  ) {
    const rs = this.certClient
      .listPropertiesOfCertificateVersions(name)
      .byPage({ maxPageSize: 10 });

    const versionsList = new Array<CertificateProperties>();
    for await (const s of rs) {
      s.forEach((p) => versionsList.push(p));
    }

    //Filter for specific version only
    if (version) return versionsList.filter((s) => s.version === version);
    return versionsList;
  }

  /** Check whether Secret is existed or not*/
  public async checkSecretExist(
    name: string,
    version: string | undefined = undefined,
  ) {
    const versions = await this.getSecretVersions(name, version)
      .then((t) => t.filter((s) => s.enabled))
      .catch(() => undefined);

    if (versions && versions.length > 0) {
      console.info(`The secret '${name}' is existed.`);
      return true;
    }

    console.warn(`The secret '${name}' is NOT existed.`);
    return false;
  }

  /** Check whether Key is existed or not*/
  public async checkKeyExist(
    name: string,
    version: string | undefined = undefined,
  ) {
    const items = await this.getKeyVersions(name, version)
      .then((t) => t.filter((s) => s.enabled))
      .catch(() => undefined);

    if (items && items.length > 0) {
      console.info(`The key '${name}' is existed.`);
      return true;
    }

    console.warn(`The key '${name}' is NOT existed.`);
    return false;
  }

  /** Check whether Cert is existed or not*/
  public async checkCertExist(
    name: string,
    version: string | undefined = undefined,
  ) {
    const versions = await this.getCertVersions(name, version)
      .then((t) => t.filter((s) => s.enabled))
      .catch(() => undefined);

    if (versions && versions.length > 0) {
      console.info(`The Cert '${name}' is existed.`);
      return true;
    }

    console.warn(`The Cert '${name}' is NOT existed.`);
    return false;
  }

  /**Get deleted Secret*/
  public async getDeletedSecret(name: string) {
    return await this.secretClient
      .getDeletedSecret(name)
      .catch(() => undefined);
  }

  /**Get deleted Key*/
  public async getDeletedKey(name: string) {
    return await this.keyClient.getDeletedKey(name).catch(() => undefined);
  }

  /**Get deleted Cert*/
  public async getDeletedCert(name: string) {
    return await this.certClient
      .getDeletedCertificate(name)
      .catch(() => undefined);
  }

  /**Recover the deleted Secret*/
  public async recoverDeletedSecret(name: string) {
    //if (isDryRun) return undefined;

    const deleted = await this.getDeletedSecret(name);
    //Recover deleted items
    if (deleted) {
      await (
        await this.secretClient.beginRecoverDeletedSecret(deleted.name)
      ).pollUntilDone();
      return true;
    }
    return false;
  }

  /**Recover deleted Key*/
  public async recoverDeletedKey(name: string) {
    //if (isDryRun) return undefined;

    const deleted = await this.getDeletedKey(name);
    //Recover deleted items
    if (deleted) {
      await (
        await this.keyClient.beginRecoverDeletedKey(deleted.name)
      ).pollUntilDone();
      return true;
    }
    return false;
  }

  /**Recover deleted Cert*/
  public async recoverDeletedCert(name: string) {
    //if (isDryRun) return undefined;

    const deleted = await this.getDeletedCert(name);
    //Recover deleted items
    if (deleted) {
      await (
        await this.certClient.beginRecoverDeletedCertificate(deleted.name)
      ).pollUntilDone();
      return true;
    }
    return false;
  }

  /** Create or update the Secret. This will recover the deleted automatically.*/
  public async setSecret(
    name: string,
    value: string,
    contentType: string | undefined = undefined,
    tags: { [p: string]: string } | undefined = undefined,
  ) {
    //if (isDryRun) return undefined;

    //Try to recover the deleted secret
    await this.recoverDeletedSecret(name);
    //Set a new value to the secret
    return await this.secretClient.setSecret(name, value, {
      enabled: true,
      contentType,
      tags,
    });
  }

  /** Create Rsa Key*/
  public async createRsaKey(
    name: string,
    args: KeyArgs | undefined = undefined,
  ) {
    //if (isDryRun) return undefined;

    await this.recoverDeletedKey(name);
    const expiresOn = new Date(
      new Date().setFullYear(new Date().getFullYear() + 3),
    );

    return await this.keyClient.createRsaKey(name, {
      enabled: true,
      tags: args?.tags,
      keySize: args?.keySize ?? 2048,
      keyOps: args?.keyOps ?? [
        'decrypt',
        'encrypt',
        'sign',
        'verify',
        'wrapKey',
        'unwrapKey',
      ],
      expiresOn,
    });
  }

  /** Create or update the Cert. This will recover the deleted automatically.*/
  public async createSelfSignCert(name: string, args: CertArgs) {
    //if (isDryRun) return undefined;
    //Try to recover the deleted secret
    //await this.recoverDeletedCert(name);
    //Set a new value to the secret
    return await this.certClient.beginCreateCertificate(
      name,
      {
        enabled: true,
        exportable: true,
        keySize: 4096,
        keyType: 'RSA',
        reuseKey: true,
        keyUsage: [
          KnownKeyUsageTypes.KeyCertSign,
          KnownKeyUsageTypes.KeyAgreement,
          KnownKeyUsageTypes.CRLSign,
          KnownKeyUsageTypes.KeyEncipherment,
          KnownKeyUsageTypes.DataEncipherment,
          KnownKeyUsageTypes.DigitalSignature,
        ],
        enhancedKeyUsage: args.serverAuth
          ? ['1.3.6.1.5.5.7.3.1']
          : ['1.3.6.1.5.5.7.3.2'],
        contentType: 'application/x-pkcs12',
        //certificateType: 'Self',
        issuerName: 'Self',
        lifetimeActions: [
          {
            daysBeforeExpiry: 30,
            action: 'AutoRenew',
          },
        ],
        subjectAlternativeNames: {
          dnsNames: args.dnsNames ?? [args.subject],
        },
        subject: `CN=${args.subject}`,
        validityInMonths: args.validityInMonths,
      },
      {
        enabled: true,
        tags: args.tags,
      },
    );
  }

  /** Get Secret*/
  public async getSecret(
    name: string,
    version: string | undefined = undefined,
  ) {
    let result = this.cache.getSecret(name);
    if (result) return result;

    result = await this.secretClient
      .getSecret(name, { version })
      .catch((err) => {
        console.error(`${this.keyVaultName}: ${err.message || err}`);
        return undefined;
      });

    if (result) this.cache.setSecret(result);
    return result;
  }

  /** Get Key*/
  public async getKey(name: string, version: string | undefined = undefined) {
    let result = this.cache.getKey(name);
    if (result) return result;

    result = await this.keyClient.getKey(name, { version }).catch((err) => {
      console.error(`${this.keyVaultName}: ${err.message || err}`);
      return undefined;
    });

    if (result) this.cache.setKey(result);
    return result;
  }

  /** Get or create Key */
  public async getOrCreateKey(
    name: string,
    type: 'Rsa' = 'Rsa',
    args: KeyArgs | undefined = undefined,
  ) {
    if (await this.checkKeyExist(name, undefined))
      return await this.getKey(name, undefined);
    return await this.createRsaKey(name, args);
  }

  /** Get Cert*/
  public async getCert(name: string) {
    let result = this.cache.getCert(name);
    if (result) return result;

    result = await this.certClient.getCertificate(name).catch((err) => {
      console.error(`${this.keyVaultName}: ${err.message || err}`);
      return undefined;
    });

    if (result) this.cache.setCert(result);
    return result;
  }

  /** Delete Secret */
  public async deleteSecret(name: string) {
    if (isDryRun) return undefined;
    await this.secretClient.beginDeleteSecret(name).catch();
  }

  /** Delete Key */
  public async deleteKey(name: string) {
    if (isDryRun) return undefined;
    await this.keyClient.beginDeleteKey(name).catch();
  }

  /** Delete Cert */
  public async deleteCert(name: string) {
    if (isDryRun) return undefined;
    await this.certClient.beginDeleteCertificate(name).catch();
  }
}

export default (keyVaultName: string) => new KeyVaultBase(keyVaultName);
