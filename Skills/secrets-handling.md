# Secrets and Sensitive Data Handling

## Overview

Security is a critical concern in infrastructure as code. This guide covers best practices for handling secrets, sensitive data, and cryptographic operations in drunk-pulumi-azure-providers.

## Pulumi Secret Management

### Marking Outputs as Secrets

Always mark sensitive outputs as secrets to prevent them from being displayed in logs or state files:

```typescript
export class VaultSecretResource extends BaseResource<VaultSecretInputs, VaultSecretOutputs> {
  declare readonly id: pulumi.Output<string>;
  declare readonly name: pulumi.Output<string>;
  declare readonly value: pulumi.Output<string>;  // Will be marked as secret

  constructor(
    name: string,
    args: BaseOptions<VaultSecretInputs>,
    opts?: pulumi.CustomResourceOptions,
  ) {
    super(
      new VaultSecretResourceProvider(name),
      `csp:VaultSecrets:${name}`,
      args,
      {
        ...opts,
        // Mark these outputs as secrets
        additionalSecretOutputs: ['value'],
      },
    );
  }
}
```

### Creating Secret Values

Wrap sensitive values with `pulumi.secret()` in provider implementations:

```typescript
async create(props: VaultSecretInputs): Promise<pulumi.dynamic.CreateResult<VaultSecretOutputs>> {
  const client = getKeyVaultBase(props.vaultName);
  const secret = await client.setSecret(props.name, props.value);
  
  return {
    id: secret.properties.id!,
    outs: {
      id: secret.properties.id!,
      name: secret.name!,
      vaultName: props.vaultName,
      vaultUrl: secret.properties.vaultUrl!,
      // Wrap sensitive value
      value: pulumi.secret(secret.value!),
    },
  };
}
```

### Accessing Secrets

When accessing secrets as inputs, they maintain their secret status:

```typescript
const dbPassword = new VaultSecretResource('db-password', {
  name: 'db-password',
  vaultName: 'my-vault',
  value: 'super-secret-password',
});

// Use secret in another resource - maintains secret status
const database = new Database('my-db', {
  password: dbPassword.value,  // Still a secret
});
```

## Azure Key Vault Integration

### Storing Secrets in Key Vault

Always store sensitive data in Azure Key Vault, not in code or Pulumi state:

```typescript
// Good: Store in Key Vault
const apiKey = new VaultSecretResource('api-key', {
  name: 'external-api-key',
  vaultName: 'my-vault',
  value: config.require('externalApiKey'),
});

// Avoid: Storing secrets directly in resource properties
const app = new WebApp('my-app', {
  settings: {
    API_KEY: config.require('externalApiKey'),  // Visible in state
  },
});
```

### Retrieving Secrets from Key Vault

```typescript
async create(props: MyResourceInputs): Promise<pulumi.dynamic.CreateResult<MyResourceOutputs>> {
  const client = getKeyVaultBase(props.vaultName);
  
  // Retrieve secret securely
  const secret = await client.getSecret(props.secretName);
  
  // Use secret value internally (don't log it!)
  const result = await someClient.authenticate(secret.value);
  
  return {
    id: result.id,
    outs: {
      id: result.id,
      // If you need to return the secret value, wrap it
      secretValue: pulumi.secret(secret.value),
      // Don't expose secrets without wrapping
      // rawSecret: secret.value,  // BAD - exposes secret
    },
  };
}
```

## PGP Key Generation

The library provides secure PGP key generation with automatic secret handling:

```typescript
import { PGPGenerator } from '@drunk-pulumi/azure-providers';

const pgpKey = new PGPGenerator('user-pgp-key', {
  name: 'John Doe',
  email: 'john@example.com',
  passphrase: 'strong-passphrase',
  vaultName: 'my-vault',  // Stores keys in Key Vault
});

// Outputs (automatically marked as secrets)
export const publicKey = pgpKey.publicKey;    // Can be shared
export const privateKey = pgpKey.privateKey;  // Secret output
```

### PGP Key Security

```typescript
class PGPGeneratorResourceProvider implements BaseProvider<PGPGeneratorInputs, PGPGeneratorOutputs> {
  async create(props: PGPGeneratorInputs): Promise<pulumi.dynamic.CreateResult<PGPGeneratorOutputs>> {
    // Generate key pair
    const { privateKey, publicKey } = await generateKey({
      userIDs: [{ name: props.name, email: props.email }],
      curve: 'ed25519',
      passphrase: props.passphrase,
    });
    
    // Store in Key Vault
    const client = getKeyVaultBase(props.vaultName);
    await client.setSecret(`${props.name}-private`, privateKey);
    
    return {
      id: `pgp:${props.name}`,
      outs: {
        name: props.name,
        // Mark private key as secret
        privateKey: pulumi.secret(privateKey),
        publicKey: publicKey,  // Public key is not secret
      },
    };
  }
}
```

## SSH Key Generation

Secure SSH key pair generation with Key Vault storage:

```typescript
import { SshKeyGenerator } from '@drunk-pulumi/azure-providers';

const sshKey = new SshKeyGenerator('vm-ssh-key', {
  name: 'vm-admin',
  vaultName: 'my-vault',
});

// Outputs
export const publicKey = sshKey.publicKey;    // Can be used in VMs
export const privateKey = sshKey.privateKey;  // Secret output
```

## Certificate Management

### Self-Signed Certificates

```typescript
const cert = new VaultCertResource('app-cert', {
  name: 'app-tls-cert',
  vaultName: 'my-vault',
  cert: {
    subject: 'CN=app.example.com',
    dnsNames: ['app.example.com', 'www.app.example.com'],
    validityInMonths: 12,
    keySize: 2048,
    exportable: false,  // Prevent private key export
  },
});
```

### Certificate Security Best Practices

1. **Set exportable to false** for production certificates
2. **Use Key Vault** for certificate storage
3. **Rotate certificates** before expiration
4. **Use managed identities** to access certificates

```typescript
const cert = new VaultCertResource('prod-cert', {
  name: 'production-certificate',
  vaultName: 'prod-vault',
  cert: {
    subject: 'CN=api.production.com',
    keySize: 4096,        // Stronger key
    exportable: false,    // Prevent export
    validityInMonths: 12, // Annual rotation
  },
});
```

## Environment Variables and Configuration

### Secure Configuration

Never commit secrets to source control. Use Pulumi config with encryption:

```bash
# Set encrypted config value
pulumi config set --secret dbPassword SuperSecretPassword123

# Set plaintext config value
pulumi config set dbUsername admin
```

### Reading Config in Code

```typescript
import * as pulumi from '@pulumi/pulumi';

const config = new pulumi.Config();

// Read secret config (automatically marked as secret)
const dbPassword = config.requireSecret('dbPassword');

// Read plaintext config
const dbUsername = config.require('dbUsername');

// Store in Key Vault
const secret = new VaultSecretResource('db-password', {
  name: 'database-password',
  vaultName: 'my-vault',
  value: dbPassword,  // Maintains secret status
});
```

## Logging Security

### Safe Logging Practices

Never log sensitive data:

```typescript
// BAD - Logs secret value
async create(props: VaultSecretInputs): Promise<pulumi.dynamic.CreateResult<VaultSecretOutputs>> {
  console.log('Creating secret:', props.name, props.value);  // DON'T DO THIS
  
  const client = getKeyVaultBase(props.vaultName);
  const secret = await client.setSecret(props.name, props.value);
  
  return { ... };
}

// GOOD - Logs only non-sensitive information
async create(props: VaultSecretInputs): Promise<pulumi.dynamic.CreateResult<VaultSecretOutputs>> {
  console.log('Creating secret:', props.name, 'in vault:', props.vaultName);
  
  const client = getKeyVaultBase(props.vaultName);
  const secret = await client.setSecret(props.name, props.value);
  
  return { ... };
}
```

### Redacting Sensitive Data

Create safe versions of objects for logging:

```typescript
// Type with sensitive fields removed
type SafeOutputs = Omit<VaultSecretOutputs, 'value'>;

function logSafely(outputs: VaultSecretOutputs) {
  const safe: SafeOutputs = {
    id: outputs.id,
    name: outputs.name,
    vaultName: outputs.vaultName,
    vaultUrl: outputs.vaultUrl,
    // Omit: value
  };
  
  console.log('Secret details:', JSON.stringify(safe));
}
```

## Access Control

### Azure RBAC for Key Vault

Ensure proper access control is configured:

```typescript
const vaultNetwork = new VaultNetworkResource('vault-access', {
  vaultName: 'my-vault',
  networkRules: {
    // Restrict to specific IP ranges
    ipRules: ['203.0.113.0/24'],
    // Allow trusted Azure services
    bypass: 'AzureServices',
    defaultAction: 'Deny',
  },
});
```

### Managed Identity Authentication

Use managed identities instead of service principals when possible:

```typescript
import { DefaultAzureCredential } from '@azure/identity';

// This automatically uses managed identity in Azure environments
const credential = new DefaultAzureCredential();
const client = new SecretClient(vaultUrl, credential);
```

## Encryption at Rest

### Key Vault Encryption

All data in Key Vault is encrypted at rest automatically:
- Secrets are encrypted with 256-bit AES
- Keys are protected by FIPS 140-2 Level 2 validated HSMs (standard tier) or Level 3 (premium tier)
- Certificates include encrypted private keys

### Customer-Managed Keys

For additional control, use customer-managed keys:

```typescript
const encryptionKey = new VaultKeyResource('encryption-key', {
  name: 'customer-managed-key',
  vaultName: 'my-vault',
  keyType: 'RSA',
  keySize: 4096,
  keyOps: ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey'],
});
```

## Audit and Compliance

### Enable Key Vault Logging

```typescript
// Enable diagnostic settings for Key Vault
const diagnostics = new azure.insights.DiagnosticSetting('vault-diagnostics', {
  targetResourceId: vault.id,
  logAnalyticsWorkspaceId: workspace.id,
  logs: [{
    category: 'AuditEvent',
    enabled: true,
  }],
});
```

### Track Secret Access

Monitor who accesses secrets:

```typescript
// Log secret access for audit trail
async read(id: string, props: VaultSecretOutputs): Promise<pulumi.dynamic.ReadResult<VaultSecretOutputs>> {
  console.log(`Secret access: ${props.name} in ${props.vaultName} at ${new Date().toISOString()}`);
  
  const client = getKeyVaultBase(props.vaultName);
  const secret = await client.getSecret(props.name);
  
  return {
    id: secret.properties.id!,
    props: {
      id: secret.properties.id!,
      name: secret.name!,
      vaultName: props.vaultName,
      vaultUrl: secret.properties.vaultUrl!,
      value: pulumi.secret(secret.value!),
    },
  };
}
```

## Best Practices Summary

1. ✅ **Always mark sensitive outputs** using `additionalSecretOutputs`
2. ✅ **Wrap secret values** with `pulumi.secret()`
3. ✅ **Store secrets in Azure Key Vault**, not in code or Pulumi state
4. ✅ **Use Pulumi config --secret** for sensitive configuration
5. ✅ **Never log secret values** or sensitive data
6. ✅ **Set exportable to false** for production certificates
7. ✅ **Use managed identities** for authentication when possible
8. ✅ **Restrict network access** to Key Vault
9. ✅ **Enable audit logging** for compliance
10. ✅ **Rotate secrets and certificates** regularly
11. ✅ **Use strong key sizes** (RSA 2048+, RSA 4096 for production)
12. ✅ **Implement least privilege** access control
13. ✅ **Test in dry-run mode** to avoid accidental secret exposure
14. ✅ **Review Pulumi state files** to ensure no secrets are leaked
15. ✅ **Use .gitignore** to prevent committing sensitive files

## Security Checklist

Before deploying, verify:

- [ ] All sensitive outputs marked in `additionalSecretOutputs`
- [ ] Secret values wrapped with `pulumi.secret()`
- [ ] No secrets logged to console or files
- [ ] Pulumi config uses `--secret` for sensitive values
- [ ] Key Vault access restricted to necessary IP ranges
- [ ] Managed identities used instead of service principals
- [ ] Certificates have `exportable: false` for production
- [ ] Audit logging enabled on Key Vault
- [ ] No secrets committed to source control
- [ ] .gitignore includes state files and config
- [ ] Certificate expiration monitoring configured
- [ ] RBAC configured with least privilege
- [ ] Key sizes meet security requirements (2048+ for RSA)
- [ ] Network rules configured for Key Vault
- [ ] Backup and recovery procedures documented
