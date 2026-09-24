import { SecretClient } from '@azure/keyvault-secrets';
import { KeyClient } from '@azure/keyvault-keys';
import {
  ArrayOneOrMore,
  CertificateClient,
  KnownKeyUsageTypes,
} from '@azure/keyvault-certificates';
import { collect, getCredential } from './Helpers';

// Consumers may call KeyVaultBase directly from a Pulumi program; never delete during preview.
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
  /** Default 4096. */
  keySize?: KeySizes;
  /** Default `['wrapKey', 'unwrapKey']` (customer-managed-key encryption). Pass more ops explicitly if needed. */
  keyOps?: Array<KeyOpsTypes>;
  tags?: { [p: string]: string };
};

export type CertArgs = {
  subject: string;
  dnsNames?: ArrayOneOrMore<string>;
  serverAuth?: boolean;
  validityInMonths?: number;
  /** Default 4096. */
  keySize?: KeySizes;
  keyType?: KeyTypes;
  /** Allow the private key to be exported via the secret endpoint (needed by App Gateway/App Service). Default true. */
  exportable?: boolean;
  /** Keep the same key pair on auto-renewal. Default false (rotate the key). */
  reuseKey?: boolean;
  tags?: { [p: string]: string };
};

const logError = (vault: string) => (err: { message?: string }) => {
  console.error(`${vault}: ${err.message || err}`);
  return undefined;
};

export class KeyVaultBase {
  private secretClient: SecretClient;
  private keyClient: KeyClient;
  private certClient: CertificateClient;
  /** Per-instance read cache for latest (unversioned) secrets/keys/certs; writes invalidate it. */
  private cache = new Map<string, unknown>();

  /**
   * @param keyVaultName vault name (public Azure cloud) or the full vault URL for sovereign clouds.
   * @param _apiVersion unused (the SDK picks the API version); kept for backward compatibility.
   */
  public constructor(
    private keyVaultName: string,
    _apiVersion?: string,
  ) {
    const url = keyVaultName.startsWith('https://')
      ? keyVaultName
      : `https://${keyVaultName}.vault.azure.net`;
    const credential = getCredential();

    this.secretClient = new SecretClient(url, credential);
    this.keyClient = new KeyClient(url, credential);
    this.certClient = new CertificateClient(url, credential);
  }

  private async cached<T>(
    key: string,
    version: string | undefined,
    load: () => Promise<T | undefined>,
  ): Promise<T | undefined> {
    // A specific version must never be served from the "latest" cache entry.
    if (version) return load();
    if (this.cache.has(key)) return this.cache.get(key) as T;
    const result = await load();
    if (result) this.cache.set(key, result);
    return result;
  }

  private warnDeleteFailed =
    (kind: string, name: string) => (err: { message?: string }) => {
      console.warn(
        `${this.keyVaultName} - failed to delete ${kind} '${name}': ${err.message || err}`,
      );
    };

  public listSecrets() {
    return collect(this.secretClient.listPropertiesOfSecrets());
  }

  /** Get Secret Versions*/
  public async getSecretVersions(name: string, version?: string) {
    const list = await collect(
      this.secretClient.listPropertiesOfSecretVersions(name),
    );
    return version ? list.filter((s) => s.version === version) : list;
  }

  public listKeys() {
    return collect(this.keyClient.listPropertiesOfKeys());
  }

  /** Get Key Versions*/
  public async getKeyVersions(name: string, version?: string) {
    const list = await collect(this.keyClient.listPropertiesOfKeyVersions(name));
    return version ? list.filter((s) => s.version === version) : list;
  }

  public listCerts() {
    return collect(this.certClient.listPropertiesOfCertificates());
  }

  /** Get Cert Versions*/
  public async getCertVersions(name: string, version?: string) {
    const list = await collect(
      this.certClient.listPropertiesOfCertificateVersions(name),
    );
    return version ? list.filter((s) => s.version === version) : list;
  }

  private async hasEnabledVersion(
    kind: string,
    name: string,
    versions: Promise<Array<{ enabled?: boolean }>>,
  ) {
    const enabled = await versions
      .then((t) => t.filter((s) => s.enabled))
      .catch(() => undefined);

    const exists = Boolean(enabled?.length);
    console.info(`The ${kind} '${name}' is ${exists ? '' : 'NOT '}existed.`);
    return exists;
  }

  /** Check whether Secret is existed or not*/
  public checkSecretExist(name: string, version?: string) {
    return this.hasEnabledVersion(
      'secret',
      name,
      this.getSecretVersions(name, version),
    );
  }

  /** Check whether Key is existed or not*/
  public checkKeyExist(name: string, version?: string) {
    return this.hasEnabledVersion(
      'key',
      name,
      this.getKeyVersions(name, version),
    );
  }

  /** Check whether Cert is existed or not*/
  public checkCertExist(name: string, version?: string) {
    return this.hasEnabledVersion(
      'cert',
      name,
      this.getCertVersions(name, version),
    );
  }

  /**Get deleted Secret*/
  public getDeletedSecret(name: string) {
    return this.secretClient.getDeletedSecret(name).catch(() => undefined);
  }

  /**Get deleted Key*/
  public getDeletedKey(name: string) {
    return this.keyClient.getDeletedKey(name).catch(() => undefined);
  }

  /**Get deleted Cert*/
  public getDeletedCert(name: string) {
    return this.certClient.getDeletedCertificate(name).catch(() => undefined);
  }

  /**Recover the deleted Secret*/
  public async recoverDeletedSecret(name: string) {
    const deleted = await this.getDeletedSecret(name);
    if (!deleted) return false;
    await (
      await this.secretClient.beginRecoverDeletedSecret(deleted.name)
    ).pollUntilDone();
    return true;
  }

  /**Recover deleted Key*/
  public async recoverDeletedKey(name: string) {
    const deleted = await this.getDeletedKey(name);
    if (!deleted) return false;
    await (
      await this.keyClient.beginRecoverDeletedKey(deleted.name)
    ).pollUntilDone();
    return true;
  }

  /**Recover deleted Cert*/
  public async recoverDeletedCert(name: string) {
    const deleted = await this.getDeletedCert(name);
    if (!deleted) return false;
    await (
      await this.certClient.beginRecoverDeletedCertificate(deleted.name!)
    ).pollUntilDone();
    return true;
  }

  /** Create or update the Secret. This will recover the deleted automatically.*/
  public async setSecret(
    name: string,
    value: string,
    contentType?: string,
    tags?: { [p: string]: string },
  ) {
    await this.recoverDeletedSecret(name);
    this.cache.delete(`secret:${name}`);
    return this.secretClient.setSecret(name, value, {
      enabled: true,
      contentType,
      tags,
    });
  }

  /** Create Rsa Key. This will recover the deleted automatically.*/
  public async createRsaKey(name: string, args?: KeyArgs) {
    await this.recoverDeletedKey(name);
    this.cache.delete(`key:${name}`);
    const expiresOn = new Date();
    expiresOn.setFullYear(expiresOn.getFullYear() + 3);

    return this.keyClient.createRsaKey(name, {
      enabled: true,
      tags: args?.tags,
      keySize: args?.keySize ?? 4096,
      keyOps: args?.keyOps ?? ['wrapKey', 'unwrapKey'],
      expiresOn,
    });
  }

  /** Create or update the self-signed Cert. This will recover the deleted automatically.*/
  public async createSelfSignCert(name: string, args: CertArgs) {
    await this.recoverDeletedCert(name);
    this.cache.delete(`cert:${name}`);
    return this.certClient.beginCreateCertificate(
      name,
      {
        enabled: true,
        exportable: args.exportable ?? true,
        keySize: args.keySize ?? 4096,
        keyType: args.keyType ?? 'RSA',
        reuseKey: args.reuseKey ?? false,
        // Leaf certificate: no KeyCertSign/CRLSign (those make it CA-capable).
        keyUsage: [
          KnownKeyUsageTypes.DigitalSignature,
          KnownKeyUsageTypes.KeyEncipherment,
        ],
        enhancedKeyUsage: args.serverAuth
          ? ['1.3.6.1.5.5.7.3.1']
          : ['1.3.6.1.5.5.7.3.2'],
        contentType: 'application/x-pkcs12',
        issuerName: 'Self',
        lifetimeActions: [{ daysBeforeExpiry: 30, action: 'AutoRenew' }],
        subjectAlternativeNames: {
          dnsNames: args.dnsNames ?? [args.subject],
        },
        subject: `CN=${args.subject}`,
        validityInMonths: args.validityInMonths,
      },
      { enabled: true, tags: args.tags },
    );
  }

  /** Get Secret*/
  public getSecret(name: string, version?: string) {
    return this.cached(`secret:${name}`, version, () =>
      this.secretClient
        .getSecret(name, { version })
        .catch(logError(this.keyVaultName)),
    );
  }

  /** Get Key*/
  public getKey(name: string, version?: string) {
    return this.cached(`key:${name}`, version, () =>
      this.keyClient
        .getKey(name, { version })
        .catch(logError(this.keyVaultName)),
    );
  }

  /** Get or create Key */
  public async getOrCreateKey(
    name: string,
    /** @deprecated only RSA is supported; kept for backward compatibility. */
    _type: 'Rsa' = 'Rsa',
    args?: KeyArgs,
  ) {
    if (await this.checkKeyExist(name)) return this.getKey(name);
    return this.createRsaKey(name, args);
  }

  /** Get Cert*/
  public getCert(name: string) {
    return this.cached(`cert:${name}`, undefined, () =>
      this.certClient
        .getCertificate(name)
        .catch(logError(this.keyVaultName)),
    );
  }

  // Deletes are tolerant: a failure is logged as a warning and the call resolves.

  /** Delete Secret */
  public async deleteSecret(name: string) {
    if (isDryRun) return undefined;
    this.cache.delete(`secret:${name}`);
    await this.secretClient
      .beginDeleteSecret(name)
      .catch(this.warnDeleteFailed('secret', name));
  }

  /** Delete Key */
  public async deleteKey(name: string) {
    if (isDryRun) return undefined;
    this.cache.delete(`key:${name}`);
    await this.keyClient
      .beginDeleteKey(name)
      .catch(this.warnDeleteFailed('key', name));
  }

  /** Delete Cert */
  public async deleteCert(name: string) {
    if (isDryRun) return undefined;
    this.cache.delete(`cert:${name}`);
    await this.certClient
      .beginDeleteCertificate(name)
      .catch(this.warnDeleteFailed('certificate', name));
  }
}

export default (keyVaultName: string, apiVersion?: string) =>
  new KeyVaultBase(keyVaultName, apiVersion);
