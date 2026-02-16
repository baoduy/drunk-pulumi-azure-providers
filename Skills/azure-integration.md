# Azure SDK Integration Patterns

## Authentication

### Default Azure Credential Pattern
All Azure SDK clients use the `DefaultAzureCredential` for authentication, which automatically handles various authentication methods.

```typescript
import { DefaultAzureCredential } from '@azure/identity';

const credential = new DefaultAzureCredential();
```

**Authentication Methods (in order of precedence):**
1. Environment variables (`AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`)
2. Managed Identity (when running in Azure)
3. Azure CLI authentication
4. Azure PowerShell authentication
5. Interactive browser authentication

## Key Vault SDK Integration

### Key Vault Client Pattern

All Key Vault interactions go through a cached client factory:

```typescript
import getKeyVaultBase from './AzBase/KeyVaultBase';

// Get cached client for vault
const client = getKeyVaultBase(vaultName);

// Use client methods
const cert = await client.getCert(certName);
const key = await client.getKey(keyName);
const secret = await client.getSecret(secretName);
```

### Key Vault Client Methods

#### Certificate Operations
```typescript
const client = getKeyVaultBase(vaultName);

// Check if certificate exists
const exists = await client.checkCertExist(certName);

// Get certificate
const cert = await client.getCert(certName);

// Create self-signed certificate
const operation = await client.createSelfSignCert(certName, certArgs);
const result = await operation.pollUntilDone();

// Delete certificate
await client.deleteCert(certName);
```

#### Key Operations
```typescript
const client = getKeyVaultBase(vaultName);

// Check if key exists
const exists = await client.checkKeyExist(keyName);

// Get key
const key = await client.getKey(keyName);

// Create key
const key = await client.createKey(keyName, keyType, keyOptions);

// Delete key
await client.deleteKey(keyName);
```

#### Secret Operations
```typescript
const client = getKeyVaultBase(vaultName);

// Check if secret exists
const exists = await client.checkSecretExist(secretName);

// Get secret
const secret = await client.getSecret(secretName);

// Set secret
const secret = await client.setSecret(secretName, value);

// Delete secret
await client.deleteSecret(secretName);
```

### Key Vault URL Format
```typescript
// Vault URL format
const vaultUrl = `https://${vaultName}.vault.azure.net`;

// Full resource ID format
const certId = `https://${vaultName}.vault.azure.net/certificates/${certName}/${version}`;
const keyId = `https://${vaultName}.vault.azure.net/keys/${keyName}/${version}`;
const secretId = `https://${vaultName}.vault.azure.net/secrets/${secretName}/${version}`;
```

## Azure Resource Manager (ARM) SDK Integration

### ARM Client Pattern

ARM clients are created per resource type and authenticated with `DefaultAzureCredential`.

```typescript
import { DefaultAzureCredential } from '@azure/identity';
import { CdnManagementClient } from '@azure/arm-cdn';
import { NetworkManagementClient } from '@azure/arm-network';
import { ComputeManagementClient } from '@azure/arm-compute';

// Create ARM client
const credential = new DefaultAzureCredential();
const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID || '';

const cdnClient = new CdnManagementClient(credential, subscriptionId);
const networkClient = new NetworkManagementClient(credential, subscriptionId);
const computeClient = new ComputeManagementClient(credential, subscriptionId);
```

### Common ARM Operations

#### CDN Operations
```typescript
import { CdnManagementClient } from '@azure/arm-cdn';

const client = new CdnManagementClient(credential, subscriptionId);

// Enable custom HTTPS
await client.customDomains.enableCustomHttps(
  resourceGroup,
  profileName,
  endpointName,
  customDomainName,
  {
    certificateSource: 'Cdn',
    protocolType: 'ServerNameIndication',
    minimumTlsVersion: 'TLS12',
  }
);

// Get custom domain
const domain = await client.customDomains.get(
  resourceGroup,
  profileName,
  endpointName,
  customDomainName
);
```

#### Network Operations
```typescript
import { NetworkManagementClient } from '@azure/arm-network';

const client = new NetworkManagementClient(credential, subscriptionId);

// Create or update network rule
await client.virtualNetworks.beginCreateOrUpdate(
  resourceGroup,
  vnetName,
  {
    location: 'eastus',
    addressSpace: { addressPrefixes: ['10.0.0.0/16'] },
  }
);

// Get network security group
const nsg = await client.networkSecurityGroups.get(
  resourceGroup,
  nsgName
);
```

#### Compute Operations
```typescript
import { ComputeManagementClient } from '@azure/arm-compute';

const client = new ComputeManagementClient(credential, subscriptionId);

// Get VM
const vm = await client.virtualMachines.get(
  resourceGroup,
  vmName
);

// Update VM
await client.virtualMachines.beginUpdate(
  resourceGroup,
  vmName,
  vmParameters
);
```

## Async Operations and Polling

### Long-Running Operations (LRO)

Many Azure operations are asynchronous and return a poller object.

```typescript
// Pattern 1: Poll until done
const operation = await client.beginCreateOrUpdate(resourceGroup, name, params);
const result = await operation.pollUntilDone();

// Pattern 2: Poll with custom interval
const operation = await client.beginCreateOrUpdate(resourceGroup, name, params);
const result = await operation.pollUntilDone({
  intervalInMs: 5000, // Poll every 5 seconds
});

// Pattern 3: Check status
const operation = await client.beginCreateOrUpdate(resourceGroup, name, params);
while (!operation.done) {
  await operation.poll();
  // Do something
}
const result = operation.getResult();
```

### Wait and Retry Pattern

For eventual consistency scenarios, use the `waitAndRetry` helper:

```typescript
import { helpers } from './AzBase';

// Wait for resource to be available
const result = await helpers.waitAndRetry(
  () => client.getCert(certName),
  15,  // Retry delay in seconds (default)
  4    // Number of retries (default)
);

// Custom retry configuration
const result = await helpers.waitAndRetry(
  () => client.getSecret(secretName),
  30,  // 30 seconds between retries
  10   // 10 retry attempts
);
```

## Caching Pattern

### Key Vault Client Cache

To reduce API calls and improve performance, Key Vault clients are cached:

```typescript
// Internal caching mechanism
const clientCache = new Map<string, KeyVaultCache>();

function getKeyVaultBase(vaultName: string): KeyVaultCache {
  if (!clientCache.has(vaultName)) {
    const vaultUrl = `https://${vaultName}.vault.azure.net`;
    const credential = new DefaultAzureCredential();
    
    clientCache.set(vaultName, {
      certClient: new CertificateClient(vaultUrl, credential),
      keyClient: new KeyClient(vaultUrl, credential),
      secretClient: new SecretClient(vaultUrl, credential),
      // ... helper methods
    });
  }
  
  return clientCache.get(vaultName)!;
}
```

**Benefits:**
- Reduces authentication overhead
- Improves performance for multiple operations
- Maintains connection pooling

## Resource ID Parsing

### Parse Azure Resource IDs

```typescript
// Extract resource information from Azure resource ID
function getResourceInfoFromId(id: string) {
  // Format: /subscriptions/{sub}/resourceGroups/{rg}/providers/{provider}/{type}/{name}
  const parts = id.split('/');
  
  return {
    subscriptionId: parts[2],
    resourceGroup: parts[4],
    provider: parts[6],
    resourceType: parts[7],
    resourceName: parts[8],
  };
}
```

### Key Vault Resource ID Format

```typescript
// Certificate ID
// https://{vault}.vault.azure.net/certificates/{name}/{version}
function parseCertId(id: string) {
  const match = id.match(/https:\/\/(.+)\.vault\.azure\.net\/certificates\/(.+)\/(.+)/);
  return {
    vaultName: match?.[1],
    certName: match?.[2],
    version: match?.[3],
  };
}

// Key ID
// https://{vault}.vault.azure.net/keys/{name}/{version}
function parseKeyId(id: string) {
  const match = id.match(/https:\/\/(.+)\.vault\.azure\.net\/keys\/(.+)\/(.+)/);
  return {
    vaultName: match?.[1],
    keyName: match?.[2],
    version: match?.[3],
  };
}

// Secret ID
// https://{vault}.vault.azure.net/secrets/{name}/{version}
function parseSecretId(id: string) {
  const match = id.match(/https:\/\/(.+)\.vault\.azure\.net\/secrets\/(.+)\/(.+)/);
  return {
    vaultName: match?.[1],
    secretName: match?.[2],
    version: match?.[3],
  };
}
```

## Error Handling

### Common Azure SDK Errors

```typescript
import { RestError } from '@azure/core-rest-pipeline';

try {
  const result = await client.getCert(certName);
} catch (error) {
  if (error instanceof RestError) {
    if (error.statusCode === 404) {
      // Resource not found
      console.log('Certificate not found');
    } else if (error.statusCode === 403) {
      // Access denied
      console.error('Access denied to Key Vault');
    } else if (error.statusCode === 429) {
      // Rate limited
      console.error('Rate limited, retry later');
    }
  }
  throw error;
}
```

### Graceful Error Handling for Delete

```typescript
// Ignore errors during deletion
async delete(id: string, props: MyResourceOutputs): Promise<void> {
  const client = getKeyVaultBase(props.vaultName);
  return client.deleteCert(props.name).catch(); // Swallow errors
}
```

## Environment Variables

### Required Environment Variables

```bash
# Azure Authentication
AZURE_TENANT_ID=<tenant-id>
AZURE_CLIENT_ID=<client-id>
AZURE_CLIENT_SECRET=<client-secret>

# Or for subscription-level operations
AZURE_SUBSCRIPTION_ID=<subscription-id>
```

### Dry Run Detection

```typescript
// Check if running in Pulumi dry run mode
const isDryRun = process.env.PULUMI_NODEJS_DRY_RUN === 'true';

if (isDryRun) {
  // Skip actual Azure API calls
  return { id: 'dry-run-id', outs: mockOutputs };
}
```

## Best Practices

1. ✅ **Always use DefaultAzureCredential** for authentication
2. ✅ **Cache clients** to reduce authentication overhead
3. ✅ **Use waitAndRetry** for eventual consistency scenarios
4. ✅ **Poll long-running operations** until completion
5. ✅ **Handle 404 errors** gracefully (resource not found is often OK)
6. ✅ **Catch and ignore delete errors** for idempotent cleanup
7. ✅ **Parse resource IDs** consistently using helper functions
8. ✅ **Check for dry run mode** before making API calls
9. ✅ **Use typed SDK clients** instead of REST API directly
10. ✅ **Log operations** at appropriate levels for debugging

## Common SDK Packages

```typescript
// Authentication
import { DefaultAzureCredential } from '@azure/identity';

// Key Vault
import { CertificateClient } from '@azure/keyvault-certificates';
import { KeyClient } from '@azure/keyvault-keys';
import { SecretClient } from '@azure/keyvault-secrets';

// ARM - Resource Management
import { CdnManagementClient } from '@azure/arm-cdn';
import { NetworkManagementClient } from '@azure/arm-network';
import { ComputeManagementClient } from '@azure/arm-compute';
import { ApiManagementClient } from '@azure/arm-apimanagement';
import { KeyVaultManagementClient } from '@azure/arm-keyvault';
import { SqlManagementClient } from '@azure/arm-sql';
import { MySQLManagementClient } from '@azure/arm-mysql-flexible';
import { PostgreSQLManagementClient } from '@azure/arm-postgresql-flexible';
import { ContainerServiceClient } from '@azure/arm-containerservice';
```
