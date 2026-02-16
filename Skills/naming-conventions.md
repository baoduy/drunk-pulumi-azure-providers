# Naming Conventions and Code Style

## File Naming

### TypeScript Files
- **Format**: `PascalCase.ts`
- **Examples**: 
  - `VaultCert.ts`
  - `VaultKey.ts`
  - `PGPGenerator.ts`
  - `ApimSignInSettings.ts`

### Special Files
- `index.ts` - Barrel export file (one per directory)
- `types.ts` - Shared type definitions
- `BaseProvider.ts` - Base classes and interfaces

### Test Files
- **Format**: `*.test.ts`
- **Location**: `z_tests/` directory
- **Example**: `VaultCert.test.ts`

## Class Naming

### Resource Classes
- **Format**: `{ResourceType}Resource`
- **Examples**:
  - `VaultCertResource`
  - `VaultKeyResource`
  - `PGPGeneratorResource`

### Provider Classes
- **Format**: `{ResourceType}ResourceProvider`
- **Examples**:
  - `VaultCertResourceProvider`
  - `VaultKeyResourceProvider`
  - `PGPGeneratorResourceProvider`

### Base Classes
- **Format**: `Base{Purpose}`
- **Examples**:
  - `BaseProvider`
  - `BaseResource`

## Interface Naming

### Input/Output Interfaces
- **Format**: `{ResourceType}{Inputs|Outputs}`
- **Examples**:
  - `VaultCertInputs`
  - `VaultCertOutputs`
  - `VaultKeyInputs`
  - `VaultKeyOutputs`

### Property Interfaces
- **Format**: `{Purpose}{Props|Info|Args|Options}`
- **Examples**:
  - `CertArgs`
  - `NetworkRuleInfo`
  - `KeyVaultProps`

### Generic Interfaces
- **Format**: Descriptive name in PascalCase
- **Examples**:
  - `BaseProvider<TInputs, TOutputs>`
  - `KeyVaultCache`

## Type Alias Naming

### Simple Types
- **Format**: `camelCase` or descriptive `PascalCase`
- **Examples**:
  - `KeySizes`
  - `KeyTypes`
  - `DeepInput<T>`
  - `DeepOutput<T>`
  - `BaseOptions<T>`

## Variable and Function Naming

### Variables
- **Format**: `camelCase`
- **Examples**:
  - `vaultName`
  - `resourceId`
  - `certificateClient`

### Constants
- **Format**: `UPPER_SNAKE_CASE` for true constants, `camelCase` for config values
- **Examples**:
  - `const DEFAULT_RETRY_COUNT = 4;`
  - `const defaultRetryDelay = 15;`

### Functions
- **Format**: `camelCase` with verb prefix
- **Examples**:
  - `getKeyVaultBase()`
  - `waitAndRetry()`
  - `checkCertExist()`
  - `createSelfSignCert()`

### Helper Functions
- **Format**: `camelCase` with descriptive verb
- **Examples**:
  - `getResourceInfoFromId()`
  - `mapToOutputs()`
  - `validateInputs()`

## Property Naming

### Input Properties
- **Format**: `camelCase`
- **Examples**:
  - `name`
  - `vaultName`
  - `keySize`
  - `expirationDate`

### Output Properties
- **Format**: `camelCase` (same as inputs)
- **Examples**:
  - `id`
  - `version`
  - `vaultUrl`
  - `createdDate`

### Azure SDK Properties
- Follow Azure SDK naming (often camelCase)
- Map to our conventions when exposing in interfaces

## Resource Type Identifiers

### Format
- **Pattern**: `csp:ResourceType:${name}`
- **Components**:
  - `csp` - Custom Service Provider namespace
  - `ResourceType` - Plural PascalCase (e.g., VaultCerts, VaultKeys)
  - `${name}` - Instance name variable

### Examples
```typescript
`csp:VaultCerts:${name}`
`csp:VaultKeys:${name}`
`csp:VaultSecrets:${name}`
`csp:VaultNetworks:${name}`
`csp:PGPGenerators:${name}`
`csp:CdnHttpsEnablers:${name}`
```

## Module Exports

### Barrel Exports (index.ts)
```typescript
// Export everything from module files
export * from './VaultCert';
export * from './VaultKey';
export * from './VaultSecret';

// Re-export types if needed
export type { CertArgs, KeyArgs } from './types';
```

### Named Exports
- Prefer named exports over default exports
- Export Resource classes, interfaces, and types

```typescript
// Good
export class VaultCertResource { }
export interface VaultCertInputs { }

// Avoid
export default VaultCertResource;
```

## Code Style

### Indentation
- Use **2 spaces** (configured in prettier)

### Quotes
- Use **single quotes** for strings (configured in prettier)
```typescript
const name = 'my-resource';  // Good
const name = "my-resource";  // Avoid
```

### Semicolons
- Use semicolons at end of statements

### Line Length
- Reasonable line length (no strict limit)
- Break long lines for readability

### Async/Await
- Prefer `async/await` over raw promises
```typescript
// Good
const result = await client.getCert(name);

// Avoid
client.getCert(name).then(result => { });
```

### Error Handling
- Use `.catch()` for graceful error handling in delete operations
- Use try/catch for operations that need error recovery
```typescript
// Graceful deletion
return client.delete(name).catch();

// Error recovery
try {
  const result = await client.create(name);
} catch (error) {
  console.error('Failed to create:', error);
  throw error;
}
```

### Type Annotations
- Explicitly type function parameters
- Let TypeScript infer return types when obvious
- Use type annotations for complex types

```typescript
// Good
async create(props: VaultCertInputs): Promise<pulumi.dynamic.CreateResult<VaultCertOutputs>> {
  const client = getKeyVaultBase(props.vaultName);
  // ...
}

// Parameter types are explicit, return type is explicit
```

### Comments
- Use comments sparingly
- Comment complex logic or non-obvious behavior
- Avoid obvious comments

```typescript
// Good - explains non-obvious behavior
//Cert is existed
if (await client.checkCertExist(props.name)) {
  cert = await client.getCert(props.name);
}

// Avoid - obvious comment
// Get the certificate name
const name = cert.name;
```

## Import Organization

### Order
1. External libraries (node modules)
2. Pulumi libraries
3. Azure libraries
4. Local/relative imports

```typescript
import * as pulumi from '@pulumi/pulumi';
import { CertificateClient } from '@azure/keyvault-certificates';
import getKeyVaultBase from './AzBase/KeyVaultBase';
import { BaseOptions, BaseProvider, BaseResource } from './BaseProvider';
```

### Import Style
- Use named imports when possible
- Use namespace imports (`* as`) for large libraries

```typescript
// Good
import * as pulumi from '@pulumi/pulumi';
import { CertificateClient, KeyVaultCertificate } from '@azure/keyvault-certificates';

// Acceptable for specific items
import getKeyVaultBase from './AzBase/KeyVaultBase';
```

## Linting and Formatting

### Tools
- **ESLint** - Code quality and style checking
- **Prettier** - Code formatting

### Running
```bash
# Lint and auto-fix
pnpm run lint

# Build
pnpm run build
```

### Configuration
- ESLint config: `.eslintrc.cjs`
- Prettier config: `package.json` (singleQuote: true)
- TypeScript config: `tsconfig.json`

## Best Practices Summary

1. ✅ Use PascalCase for classes, interfaces, types, and files
2. ✅ Use camelCase for variables, functions, and properties
3. ✅ Use descriptive names that convey purpose
4. ✅ Follow the `{ResourceType}Resource` pattern for resource classes
5. ✅ Follow the `{ResourceType}ResourceProvider` pattern for provider classes
6. ✅ Use `{ResourceType}{Inputs|Outputs}` for interface naming
7. ✅ Use `csp:ResourceType:${name}` pattern for resource identifiers
8. ✅ Export using named exports, not default exports
9. ✅ Use single quotes for strings
10. ✅ Prefer async/await over callbacks or raw promises
11. ✅ Run linter before committing code
12. ✅ Keep imports organized by category
