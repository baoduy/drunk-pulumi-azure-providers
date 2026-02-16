# Provider Pattern - Creating New Custom Providers

## Standard Provider Implementation Pattern

All custom providers in this library follow a consistent three-part structure:

### 1. Define Input/Output Interfaces

```typescript
interface MyResourceInputs {
  // User-provided inputs (required and optional)
  name: string;
  vaultName: string;
  property1: string;
  property2?: number;
}

interface MyResourceOutputs {
  // Computed outputs (includes inputs + computed values)
  id: string;
  name: string;
  vaultName: string;
  property1: string;
  property2?: number;
  // Output-only fields
  version: string;
  url: string;
}
```

**Key Principles:**
- `Inputs` = What users provide
- `Outputs` = Inputs + computed/returned values
- Output-only fields should be initialized as `undefined` in resource constructor

### 2. Implement ResourceProvider Class

```typescript
class MyResourceProvider implements BaseProvider<MyResourceInputs, MyResourceOutputs> {
  constructor(private readonly name: string) {}

  // REQUIRED: Create the resource
  async create(props: MyResourceInputs): Promise<pulumi.dynamic.CreateResult<MyResourceOutputs>> {
    // 1. Get Azure client
    const client = getAzureClient(props.vaultName);
    
    // 2. Check if resource exists
    if (await client.checkExists(props.name)) {
      const existing = await client.get(props.name);
      return { id: existing.id, outs: mapToOutputs(existing) };
    }
    
    // 3. Create new resource
    const result = await client.create(props.name, props);
    
    // 4. Wait for completion if async operation
    const final = await helpers.waitAndRetry(() => client.get(props.name));
    
    return {
      id: final.id,
      outs: {
        id: final.id,
        name: final.name,
        vaultName: props.vaultName,
        property1: props.property1,
        property2: props.property2,
        version: final.version,
        url: final.url,
      },
    };
  }

  // OPTIONAL: Update the resource
  async update(
    id: string,
    olds: MyResourceOutputs,
    news: MyResourceInputs,
  ): Promise<pulumi.dynamic.UpdateResult<MyResourceOutputs>> {
    // Simple approach: recreate
    const rs = await this.create(news);
    return { outs: rs.outs };
    
    // OR implement partial update logic
    // const client = getAzureClient(news.vaultName);
    // const updated = await client.update(news.name, news);
    // return { outs: mapToOutputs(updated) };
  }

  // OPTIONAL: Delete the resource
  async delete(id: string, props: MyResourceOutputs): Promise<void> {
    const client = getAzureClient(props.vaultName);
    // Catch and ignore errors for graceful deletion
    return client.delete(props.name).catch();
  }

  // OPTIONAL: Check inputs before create/update
  async check(olds: MyResourceInputs, news: MyResourceInputs): Promise<pulumi.dynamic.CheckResult> {
    const failures: pulumi.dynamic.CheckFailure[] = [];
    
    if (!news.name) {
      failures.push({ property: 'name', reason: 'name is required' });
    }
    
    return { inputs: news, failures };
  }

  // OPTIONAL: Compute differences for update decision
  async diff(
    id: string,
    previousOutput: MyResourceOutputs,
    news: MyResourceInputs,
  ): Promise<pulumi.dynamic.DiffResult> {
    const replaces: string[] = [];
    const changes = false;
    
    // Force replacement if name changes
    if (previousOutput.name !== news.name) {
      replaces.push('name');
    }
    
    return { replaces, changes };
  }

  // OPTIONAL: Read/refresh resource state
  async read(
    id: string,
    props: MyResourceOutputs,
  ): Promise<pulumi.dynamic.ReadResult<MyResourceOutputs>> {
    const client = getAzureClient(props.vaultName);
    const current = await client.get(props.name);
    return { id: current.id, props: mapToOutputs(current) };
  }
}
```

### 3. Create Public Resource Class

```typescript
export class MyResource extends BaseResource<MyResourceInputs, MyResourceOutputs> {
  // Declare output properties for IDE autocomplete
  declare readonly id: pulumi.Output<string>;
  declare readonly name: pulumi.Output<string>;
  declare readonly vaultName: pulumi.Output<string>;
  declare readonly version: pulumi.Output<string>;
  declare readonly url: pulumi.Output<string>;

  constructor(
    name: string,
    args: BaseOptions<MyResourceInputs>,
    opts?: pulumi.CustomResourceOptions,
  ) {
    super(
      new MyResourceProvider(name),
      `csp:MyResources:${name}`,  // Resource type identifier
      {
        // Initialize output-only fields as undefined
        id: undefined,
        version: undefined,
        url: undefined,
        ...args,
        // Use resource name as default if not provided
        name: args.name ?? name,
      },
      opts,
    );
  }
}
```

## Resource ID Pattern

All resources should use the format: `csp:ResourceType:${name}`

Examples:
- `csp:VaultCerts:my-cert`
- `csp:VaultKeys:my-key`
- `csp:VaultSecrets:my-secret`

## Lifecycle Method Implementation Guide

### Required Methods
- **`create()`** - MUST be implemented

### Optional Methods (implement as needed)
- **`update()`** - Handle updates (can delegate to create for simple cases)
- **`delete()`** - Clean up resources (catch errors for graceful deletion)
- **`check()`** - Validate inputs before create/update
- **`diff()`** - Determine if update is needed and if replacement is required
- **`read()`** - Refresh resource state from Azure

## Common Patterns

### Pattern 1: Idempotent Create
```typescript
// Check if exists before creating
if (await client.checkExists(props.name)) {
  const existing = await client.get(props.name);
  return { id: existing.id, outs: mapToOutputs(existing) };
}
const result = await client.create(props.name, props);
```

### Pattern 2: Async Operation Handling
```typescript
// For long-running operations
const operation = await client.beginCreate(props);
const result = await operation.pollUntilDone();

// Or with retry helper
const result = await helpers.waitAndRetry(() => client.get(props.name));
```

### Pattern 3: Graceful Error Handling
```typescript
// Delete should not throw errors
async delete(id: string, props: MyResourceOutputs): Promise<void> {
  const client = getAzureClient(props.vaultName);
  return client.delete(props.name).catch();  // Ignore errors
}
```

### Pattern 4: Update via Recreate
```typescript
// Simplest update: recreate the resource
async update(id: string, olds: MyResourceOutputs, news: MyResourceInputs): Promise<pulumi.dynamic.UpdateResult> {
  const rs = await this.create(news);
  return { outs: rs.outs };
}
```

## Testing Your Provider

```typescript
import * as pulumi from '@pulumi/pulumi';

// In your Pulumi program
const myResource = new MyResource('test-resource', {
  name: 'my-resource',
  vaultName: 'my-vault',
  property1: 'value1',
});

// Access outputs
export const resourceId = myResource.id;
export const resourceVersion = myResource.version;
```

## Best Practices

1. **Always check if resource exists** before creating to ensure idempotency
2. **Use waitAndRetry** for eventual consistency scenarios
3. **Catch and ignore delete errors** for graceful resource cleanup
4. **Initialize output-only fields** as `undefined` in constructor
5. **Use type-safe interfaces** for all inputs and outputs
6. **Follow the naming convention** `csp:ResourceType:${name}` for resource IDs
7. **Implement minimal lifecycle methods** - only what you need
8. **Store resource name** in provider constructor for debugging
9. **Use pulumi.secret()** for sensitive outputs
10. **Test with actual Pulumi stack** operations before committing
