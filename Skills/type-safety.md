# TypeScript Type Safety and Pulumi Types

## Generic Type System

The library uses advanced TypeScript generics to provide type safety across the provider system.

### Core Type Definitions

```typescript
// Recursive Input type wrapper
export type DeepInput<T> = T extends object
  ? { [K in keyof T]: DeepInput<T[K]> | pulumi.Input<T[K]> }
  : pulumi.Input<T>;

// Recursive Output type wrapper
export type DeepOutput<T> = T extends object
  ? { [K in keyof T]: DeepOutput<T[K]> | pulumi.Output<T[K]> }
  : pulumi.Output<T>;

// Convenience aliases
export type BaseOptions<TOptions> = DeepInput<TOptions>;
export type BaseOutputs<TOptions> = DeepOutput<TOptions>;
```

### Understanding Deep Input/Output

These recursive types allow nested objects to have Pulumi Input/Output types at any depth:

```typescript
interface MyInputs {
  name: string;
  config: {
    enabled: boolean;
    settings: {
      timeout: number;
    };
  };
}

// DeepInput allows:
const args: DeepInput<MyInputs> = {
  name: pulumi.Output.create('my-name'),  // Can be Output
  config: {
    enabled: true,  // Can be plain value
    settings: {
      timeout: pulumi.Output.create(30),  // Can be Output at any depth
    },
  },
};
```

## Provider Interface Generics

### Base Provider Interface

```typescript
export interface BaseProvider<TInputs, TOutputs>
  extends pulumi.dynamic.ResourceProvider {
  
  create: (inputs: TInputs) => Promise<pulumi.dynamic.CreateResult<TOutputs>>;
  
  update?: (
    id: string,
    olds: TOutputs,
    news: TInputs,
  ) => Promise<pulumi.dynamic.UpdateResult<TOutputs>>;
  
  delete?: (id: string, props: TOutputs) => Promise<void>;
  
  read?: (
    id: string,
    props: TOutputs,
  ) => Promise<pulumi.dynamic.ReadResult<TOutputs>>;
  
  diff?: (
    id: string,
    previousOutput: TOutputs,
    news: TInputs,
  ) => Promise<pulumi.dynamic.DiffResult>;
  
  check?: (
    olds: TInputs,
    news: TInputs,
  ) => Promise<pulumi.dynamic.CheckResult>;
}
```

**Key Points:**
- `TInputs` - User-provided input types
- `TOutputs` - Resource output types (includes inputs + computed values)
- Type safety enforced across all lifecycle methods

### Base Resource Class

```typescript
export abstract class BaseResource<TInputs, TOutputs> extends pulumi.dynamic.Resource {
  protected constructor(
    provider: BaseProvider<TInputs, TOutputs>,
    name: string,
    args: BaseOptions<TInputs & Partial<TOutputs>>,
    opts?: pulumi.CustomResourceOptions,
  ) {
    super(provider, name, args, opts);
  }
}
```

**Key Points:**
- `BaseOptions<TInputs & Partial<TOutputs>>` - Allows passing both inputs and output-only fields
- Output-only fields should be initialized as `undefined`
- Generic types flow through to Pulumi's type system

## Pulumi Type System

### Input Types

Pulumi's `Input<T>` type represents a value that can be:
- A plain value: `string`, `number`, `boolean`
- A Promise: `Promise<string>`
- An Output: `pulumi.Output<string>`

```typescript
// All of these are valid Input<string> values
const input1: pulumi.Input<string> = 'plain-string';
const input2: pulumi.Input<string> = Promise.resolve('async-string');
const input3: pulumi.Input<string> = pulumi.Output.create('output-string');
const input4: pulumi.Input<string> = someResource.name; // Output from resource
```

### Output Types

Pulumi's `Output<T>` type represents a value that will be resolved after resource creation:

```typescript
// Declaring output properties
export class VaultCertResource extends BaseResource<VaultCertInputs, VaultCertOutputs> {
  // Use 'declare readonly' for output properties
  declare readonly id: pulumi.Output<string>;
  declare readonly name: pulumi.Output<string>;
  declare readonly version: pulumi.Output<string>;
  declare readonly vaultUrl: pulumi.Output<string>;
}
```

### Working with Outputs

```typescript
// Apply transformations to outputs
const cert = new VaultCertResource('my-cert', { ... });

// Transform output value
const certId = cert.id.apply(id => id.toUpperCase());

// Combine multiple outputs
const combined = pulumi.all([cert.id, cert.version])
  .apply(([id, version]) => `${id}:${version}`);

// Use in other resources
const secret = new VaultSecretResource('my-secret', {
  name: cert.name,  // Output can be used as Input
  vaultName: cert.vaultName,
});
```

## Interface Design Patterns

### Separate Input and Output Interfaces

Always define separate interfaces for inputs and outputs:

```typescript
// Input interface - what user provides
interface VaultCertInputs {
  name: string;
  cert: CertArgs;
  vaultName: string;
}

// Output interface - inputs + computed values
interface VaultCertOutputs {
  // Copy input fields
  name: string;
  vaultName: string;
  // Add computed fields
  id: string;
  version: string;
  vaultUrl: string;
}
```

**Benefits:**
- Clear separation between what user provides vs. what resource returns
- Type safety in lifecycle methods
- Better IDE autocomplete

### Optional vs Required Properties

```typescript
interface MyResourceInputs {
  // Required properties
  name: string;
  vaultName: string;
  
  // Optional properties
  enabled?: boolean;
  tags?: Record<string, string>;
}

interface MyResourceOutputs {
  // All input properties (maintain optionality)
  name: string;
  vaultName: string;
  enabled?: boolean;
  tags?: Record<string, string>;
  
  // Computed properties (usually required)
  id: string;
  createdDate: string;
}
```

### Nested Type Definitions

For complex nested structures, define separate types:

```typescript
// Certificate arguments
interface CertArgs {
  subject: string;
  dnsNames?: string[];
  validityInMonths?: number;
  keySize?: KeySizes;
  exportable?: boolean;
}

// Key sizes enum
type KeySizes = 2048 | 3072 | 4096;

// Main input interface uses nested types
interface VaultCertInputs {
  name: string;
  cert: CertArgs;
  vaultName: string;
}
```

## Type Narrowing and Validation

### Type Guards

```typescript
// Type guard function
function isValidKeySize(size: number): size is KeySizes {
  return size === 2048 || size === 3072 || size === 4096;
}

// Usage in validation
async check(olds: MyResourceInputs, news: MyResourceInputs): Promise<pulumi.dynamic.CheckResult> {
  const failures: pulumi.dynamic.CheckFailure[] = [];
  
  if (news.keySize && !isValidKeySize(news.keySize)) {
    failures.push({
      property: 'keySize',
      reason: 'keySize must be 2048, 3072, or 4096',
    });
  }
  
  return { inputs: news, failures };
}
```

### Runtime Type Checking

```typescript
// Validate required fields
async check(olds: MyResourceInputs, news: MyResourceInputs): Promise<pulumi.dynamic.CheckResult> {
  const failures: pulumi.dynamic.CheckFailure[] = [];
  
  if (!news.name || news.name.trim() === '') {
    failures.push({
      property: 'name',
      reason: 'name is required and cannot be empty',
    });
  }
  
  if (!news.vaultName || news.vaultName.trim() === '') {
    failures.push({
      property: 'vaultName',
      reason: 'vaultName is required and cannot be empty',
    });
  }
  
  return { inputs: news, failures };
}
```

## Type-Safe Secret Handling

### Marking Outputs as Secrets

```typescript
// In resource constructor
constructor(name: string, args: BaseOptions<MyResourceInputs>, opts?: pulumi.CustomResourceOptions) {
  super(
    new MyResourceProvider(name),
    `csp:MyResources:${name}`,
    args,
    {
      ...opts,
      // Mark specific outputs as secrets
      additionalSecretOutputs: ['password', 'privateKey', 'connectionString'],
    },
  );
}
```

### Creating Secret Values

```typescript
// Wrap sensitive values with pulumi.secret()
async create(props: MyResourceInputs): Promise<pulumi.dynamic.CreateResult<MyResourceOutputs>> {
  const result = await client.generatePassword();
  
  return {
    id: result.id,
    outs: {
      id: result.id,
      name: props.name,
      // Mark as secret in output
      password: pulumi.secret(result.password),
    },
  };
}
```

## Utility Types

### Omit Pattern

Use `Omit` to create derived types:

```typescript
// Omit computed fields for input type
interface VaultCertInputs extends Omit<VaultCertOutputs, 'id' | 'version' | 'vaultUrl'> {
  cert: CertArgs;
}

// Omit sensitive fields for logging
type SafeOutputs = Omit<VaultSecretOutputs, 'value'>;
```

### Pick Pattern

Use `Pick` to select specific properties:

```typescript
// Select only identifying properties
type ResourceIdentifier = Pick<VaultCertOutputs, 'name' | 'vaultName'>;

function logResourceId(resource: ResourceIdentifier) {
  console.log(`Resource: ${resource.name} in vault: ${resource.vaultName}`);
}
```

### Partial Pattern

Use `Partial` for optional updates:

```typescript
// Update interface with all optional fields
interface UpdateInputs extends Partial<MyResourceInputs> {
  name: string; // Keep name required
}
```

## Best Practices

1. ✅ **Use DeepInput<T>** for resource constructor arguments
2. ✅ **Use DeepOutput<T>** for resource return types
3. ✅ **Define separate Input and Output interfaces** for clarity
4. ✅ **Use 'declare readonly'** for output properties in resource classes
5. ✅ **Initialize output-only fields as undefined** in resource constructor
6. ✅ **Use type guards** for runtime type validation
7. ✅ **Mark sensitive outputs** using `additionalSecretOutputs`
8. ✅ **Use pulumi.secret()** to wrap sensitive values
9. ✅ **Leverage utility types** (Omit, Pick, Partial) for derived types
10. ✅ **Define nested types** for complex structures
11. ✅ **Use TypeScript strict mode** for maximum type safety
12. ✅ **Validate inputs** in the `check()` lifecycle method

## Type Safety Checklist

When creating a new provider, ensure:

- [ ] Input interface defined with correct property types
- [ ] Output interface defined extending/including input properties
- [ ] Provider class implements `BaseProvider<TInputs, TOutputs>`
- [ ] Resource class extends `BaseResource<TInputs, TOutputs>`
- [ ] Output properties declared with `declare readonly`
- [ ] Constructor accepts `BaseOptions<TInputs>`
- [ ] Sensitive outputs marked in `additionalSecretOutputs`
- [ ] Output-only fields initialized as `undefined`
- [ ] Type guards added for complex validation
- [ ] No type assertions (`as`) used without validation

## Common Type Errors and Solutions

### Error: Type 'Output<string>' is not assignable to type 'string'

**Problem:** Trying to use an Output where a plain value is expected

**Solution:** Use `.apply()` to unwrap the Output
```typescript
// Wrong
const length = cert.name.length;

// Right
const length = cert.name.apply(name => name.length);
```

### Error: Property does not exist on type

**Problem:** Forgot to declare output properties

**Solution:** Add `declare readonly` declarations
```typescript
export class MyResource extends BaseResource<MyResourceInputs, MyResourceOutputs> {
  declare readonly id: pulumi.Output<string>;
  declare readonly name: pulumi.Output<string>;
}
```

### Error: Argument not assignable to parameter of type 'Input<T>'

**Problem:** Pulumi Input type expects value, Promise, or Output

**Solution:** Ensure the value is one of the accepted types
```typescript
// All valid
const input1: pulumi.Input<string> = 'value';
const input2: pulumi.Input<string> = Promise.resolve('value');
const input3: pulumi.Input<string> = pulumi.Output.create('value');
```
