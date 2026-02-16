# Testing Patterns and Best Practices

## Testing Framework

The library uses Mocha as the testing framework with TypeScript support.

### Test File Structure

```
z_tests/
├── VaultCert.test.ts
├── VaultKey.test.ts
├── VaultSecret.test.ts
└── ... other test files
```

## Running Tests

### Test Commands

```bash
# Run all tests
pnpm test

# Run tests with memory leak detection
pnpm test-leak

# Run specific test file
pnpm testcert

# Run tests with coverage
pnpm test-cover
```

### Test Configuration

Tests use a custom TypeScript configuration:

```json
// tsconfig.test.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2018"
  }
}
```

## Test File Structure

### Basic Test Template

```typescript
import * as pulumi from '@pulumi/pulumi';
import { expect } from 'chai';
import { VaultCertResource } from '../src/VaultCert';

// Set up Pulumi mocks if needed
pulumi.runtime.setMocks({
  newResource: (args: pulumi.runtime.MockResourceArgs): { id: string; state: any } => {
    return {
      id: args.name + '_id',
      state: args.inputs,
    };
  },
  call: (args: pulumi.runtime.MockCallArgs): { outputs: any } => {
    return { outputs: args.inputs };
  },
});

describe('VaultCertResource', () => {
  describe('constructor', () => {
    it('should create a certificate resource', async () => {
      const cert = new VaultCertResource('test-cert', {
        name: 'my-cert',
        vaultName: 'my-vault',
        cert: {
          subject: 'CN=test.example.com',
          validityInMonths: 12,
        },
      });
      
      expect(cert).to.exist;
      expect(cert.name).to.exist;
    });
  });
  
  describe('provider operations', () => {
    it('should handle certificate creation', async () => {
      // Test implementation
    });
  });
});
```

## Testing Dynamic Providers

### Mock Pulumi Runtime

For unit testing dynamic providers, mock the Pulumi runtime:

```typescript
import * as pulumi from '@pulumi/pulumi';

pulumi.runtime.setMocks({
  newResource: (args: pulumi.runtime.MockResourceArgs): { id: string; state: any } => {
    // Return mock resource state
    return {
      id: `${args.name}_id`,
      state: {
        ...args.inputs,
        // Add output-only fields
        version: 'mock-version',
        id: `mock-id-${args.name}`,
      },
    };
  },
  call: (args: pulumi.runtime.MockCallArgs): { outputs: any } => {
    return { outputs: args.inputs };
  },
});
```

### Testing Resource Creation

```typescript
describe('VaultCertResource', () => {
  it('should create with correct properties', async () => {
    const cert = new VaultCertResource('test-cert', {
      name: 'test-certificate',
      vaultName: 'test-vault',
      cert: {
        subject: 'CN=test.example.com',
        dnsNames: ['test.example.com'],
        validityInMonths: 12,
        keySize: 2048,
      },
    });
    
    // Access output values using apply
    const outputs = await new Promise((resolve) => {
      pulumi.all([cert.name, cert.vaultName, cert.version]).apply(([name, vaultName, version]) => {
        resolve({ name, vaultName, version });
      });
    });
    
    expect(outputs.name).to.equal('test-certificate');
    expect(outputs.vaultName).to.equal('test-vault');
  });
});
```

## Testing Provider Lifecycle Methods

### Testing Create Method

```typescript
import { VaultCertResourceProvider } from '../src/VaultCert';

describe('VaultCertResourceProvider', () => {
  describe('create', () => {
    it('should create a new certificate', async () => {
      const provider = new VaultCertResourceProvider('test');
      
      const result = await provider.create({
        name: 'test-cert',
        vaultName: 'test-vault',
        cert: {
          subject: 'CN=test.example.com',
          validityInMonths: 12,
        },
      });
      
      expect(result.id).to.exist;
      expect(result.outs.name).to.equal('test-cert');
      expect(result.outs.vaultName).to.equal('test-vault');
    });
  });
});
```

### Testing Update Method

```typescript
describe('VaultCertResourceProvider', () => {
  describe('update', () => {
    it('should update certificate properties', async () => {
      const provider = new VaultCertResourceProvider('test');
      
      // Create initial resource
      const createResult = await provider.create({
        name: 'test-cert',
        vaultName: 'test-vault',
        cert: { subject: 'CN=test.example.com' },
      });
      
      // Update resource
      const updateResult = await provider.update(
        createResult.id,
        createResult.outs,
        {
          name: 'test-cert',
          vaultName: 'test-vault',
          cert: { subject: 'CN=updated.example.com' },
        },
      );
      
      expect(updateResult.outs).to.exist;
    });
  });
});
```

### Testing Delete Method

```typescript
describe('VaultCertResourceProvider', () => {
  describe('delete', () => {
    it('should delete certificate without errors', async () => {
      const provider = new VaultCertResourceProvider('test');
      
      // This should not throw
      await provider.delete('test-id', {
        id: 'test-id',
        name: 'test-cert',
        vaultName: 'test-vault',
        version: 'v1',
        vaultUrl: 'https://test-vault.vault.azure.net',
      });
    });
  });
});
```

## Integration Testing

### Testing with Real Azure Resources

For integration tests, use real Azure resources (run separately):

```typescript
describe('VaultCertResource Integration', function() {
  // Increase timeout for real Azure operations
  this.timeout(60000);
  
  it('should create a real certificate in Azure Key Vault', async () => {
    // Skip if no Azure credentials
    if (!process.env.AZURE_TENANT_ID) {
      this.skip();
    }
    
    const cert = new VaultCertResource('integration-test-cert', {
      name: `test-cert-${Date.now()}`,
      vaultName: process.env.TEST_VAULT_NAME!,
      cert: {
        subject: 'CN=integration-test.example.com',
        validityInMonths: 1,
      },
    });
    
    // Verify resource was created
    const certName = await cert.name.promise();
    expect(certName).to.include('test-cert-');
  });
});
```

## Mocking Azure SDK Clients

### Mock Key Vault Client

```typescript
import * as sinon from 'sinon';

describe('VaultCertResourceProvider', () => {
  let clientStub: sinon.SinonStub;
  
  beforeEach(() => {
    // Mock getKeyVaultBase function
    clientStub = sinon.stub().returns({
      checkCertExist: sinon.stub().resolves(false),
      getCert: sinon.stub().resolves({
        id: 'mock-cert-id',
        name: 'mock-cert',
        properties: {
          id: 'mock-cert-id',
          vaultUrl: 'https://mock-vault.vault.azure.net',
          version: 'mock-version',
        },
      }),
      createSelfSignCert: sinon.stub().resolves({
        pollUntilDone: sinon.stub().resolves({
          id: 'mock-cert-id',
          name: 'mock-cert',
          properties: {
            id: 'mock-cert-id',
            vaultUrl: 'https://mock-vault.vault.azure.net',
            version: 'mock-version',
          },
        }),
      }),
    });
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  it('should create certificate with mocked client', async () => {
    // Test with mocked Azure client
  });
});
```

## Testing Async Operations

### Testing with waitAndRetry

```typescript
import { helpers } from '../src/AzBase';
import * as sinon from 'sinon';

describe('helpers.waitAndRetry', () => {
  it('should retry on failure', async () => {
    let attempts = 0;
    const fn = sinon.stub().callsFake(async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Not ready yet');
      }
      return 'success';
    });
    
    const result = await helpers.waitAndRetry(fn, 1, 5);
    
    expect(result).to.equal('success');
    expect(attempts).to.equal(3);
  });
  
  it('should throw after max retries', async () => {
    const fn = sinon.stub().rejects(new Error('Always fails'));
    
    try {
      await helpers.waitAndRetry(fn, 1, 3);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error.message).to.equal('Always fails');
    }
  });
});
```

## Testing Pulumi Outputs

### Unwrapping Output Values

```typescript
describe('Resource Outputs', () => {
  it('should have correct output values', async () => {
    const resource = new VaultCertResource('test', {
      name: 'test-cert',
      vaultName: 'test-vault',
      cert: { subject: 'CN=test.example.com' },
    });
    
    // Method 1: Using promise()
    const name = await resource.name.promise();
    expect(name).to.equal('test-cert');
    
    // Method 2: Using apply()
    const outputs = await new Promise((resolve) => {
      pulumi.all({
        name: resource.name,
        vaultName: resource.vaultName,
      }).apply(resolve);
    });
    
    expect(outputs.name).to.equal('test-cert');
    expect(outputs.vaultName).to.equal('test-vault');
  });
});
```

## Testing Error Handling

### Testing Validation Errors

```typescript
describe('VaultCertResourceProvider', () => {
  describe('check', () => {
    it('should validate required fields', async () => {
      const provider = new VaultCertResourceProvider('test');
      
      const result = await provider.check({}, {
        name: '',  // Invalid: empty name
        vaultName: 'test-vault',
        cert: { subject: 'CN=test' },
      });
      
      expect(result.failures).to.have.length.greaterThan(0);
      expect(result.failures[0].property).to.equal('name');
    });
  });
});
```

### Testing Error Recovery

```typescript
describe('VaultCertResourceProvider', () => {
  describe('create', () => {
    it('should handle Azure errors gracefully', async () => {
      // Mock client that throws error
      const clientStub = {
        checkCertExist: sinon.stub().rejects(new Error('Azure Error')),
      };
      
      const provider = new VaultCertResourceProvider('test');
      
      try {
        await provider.create({
          name: 'test-cert',
          vaultName: 'test-vault',
          cert: { subject: 'CN=test' },
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.message).to.include('Azure Error');
      }
    });
  });
});
```

## Test Organization

### Describe Blocks

Organize tests hierarchically:

```typescript
describe('VaultCertResource', () => {
  describe('constructor', () => {
    it('should initialize with valid inputs', () => { });
    it('should throw with invalid inputs', () => { });
  });
  
  describe('outputs', () => {
    it('should expose name output', () => { });
    it('should expose version output', () => { });
  });
});

describe('VaultCertResourceProvider', () => {
  describe('create', () => {
    it('should create new certificate', () => { });
    it('should return existing certificate', () => { });
  });
  
  describe('update', () => {
    it('should update certificate', () => { });
  });
  
  describe('delete', () => {
    it('should delete certificate', () => { });
  });
});
```

## Best Practices

1. ✅ **Use Pulumi mocks** for unit tests
2. ✅ **Separate unit and integration tests**
3. ✅ **Mock Azure SDK clients** for predictable tests
4. ✅ **Test all lifecycle methods** (create, update, delete)
5. ✅ **Test error conditions** and validation
6. ✅ **Use appropriate timeouts** for integration tests
7. ✅ **Clean up test resources** in Azure after integration tests
8. ✅ **Test with realistic data** that matches production scenarios
9. ✅ **Use descriptive test names** that explain what is being tested
10. ✅ **Organize tests hierarchically** with describe blocks
11. ✅ **Test async operations** properly with async/await
12. ✅ **Verify output values** using apply() or promise()
13. ✅ **Skip tests gracefully** when dependencies aren't available
14. ✅ **Use sinon for stubbing** Azure clients and methods
15. ✅ **Test secret handling** to ensure values are properly wrapped

## Test Checklist

Before committing:

- [ ] All tests pass locally
- [ ] New features have corresponding tests
- [ ] Edge cases are covered
- [ ] Error conditions are tested
- [ ] Async operations are tested properly
- [ ] Mocks are used for Azure clients
- [ ] Integration tests marked appropriately
- [ ] Test names are descriptive
- [ ] Tests are organized logically
- [ ] No tests are skipped unnecessarily
- [ ] Test coverage is adequate (run `pnpm test-cover`)
