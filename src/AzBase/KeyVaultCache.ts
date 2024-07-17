import { KeyVaultSecret } from '@azure/keyvault-secrets';
import { KeyVaultKey } from '@azure/keyvault-keys';
import { KeyVaultCertificateWithPolicy } from '@azure/keyvault-certificates';

export type KeyVaultCacheType = {
  setSecret: (secret: KeyVaultSecret) => void;
  getSecret: (name: string) => KeyVaultSecret | undefined;
  setKey: (key: KeyVaultKey) => void;
  getKey: (name: string) => KeyVaultKey | undefined;
  setCert: (cert: KeyVaultCertificateWithPolicy) => void;
  getCert: (name: string) => KeyVaultCertificateWithPolicy | undefined;
};

export function getKeyVaultCache(keyVaultName: string): KeyVaultCacheType {
  const secretsCache: Record<string, KeyVaultSecret | undefined> = {};
  const keyCache: Record<string, KeyVaultKey | undefined> = {};
  const certCache: Record<string, KeyVaultCertificateWithPolicy | undefined> =
    {};

  const getName = (name: string) => `${keyVaultName}-${name}`;

  return {
    setSecret: (secret: KeyVaultSecret) =>
      (secretsCache[getName(secret.name)] = secret),
    getSecret: (name: string) => secretsCache[getName(name)],
    setKey: (key: KeyVaultKey) => (keyCache[getName(key.name)] = key),
    getKey: (name: string) => keyCache[getName(name)],
    setCert: (cert: KeyVaultCertificateWithPolicy) =>
      (certCache[getName(cert.name)] = cert),
    getCert: (name: string) => certCache[getName(name)],
  };
}
