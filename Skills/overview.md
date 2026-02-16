# drunk-pulumi-azure-providers - Overview

## Purpose
This library provides **custom dynamic Azure resource providers** for Pulumi that extend Azure capabilities with opinionated, type-safe abstractions for managing Azure resources, particularly focused on Azure Key Vault, certificates, encryption keys, and networking.

## Target Users
- Infrastructure as Code developers using Pulumi with TypeScript
- Teams managing Azure infrastructure with enhanced security and type safety
- Developers needing custom Azure resource behaviors not available in standard Pulumi providers

## Key Features
- **Type-safe dynamic providers** using TypeScript generics
- **Azure Key Vault integrations** for certificates, keys, and secrets
- **Security-first design** with secret handling and PGP key generation
- **Idempotent operations** with retry logic and caching
- **Extensible architecture** for creating custom providers

## Architecture Overview

```
BaseProvider<TInputs, TOutputs> (interface)
    ↓
Concrete ResourceProvider (class implementing BaseProvider)
    ↓
BaseResource<TInputs, TOutputs> (abstract generic class)
    ↓
Concrete Resource (extends BaseResource)
```

## Core Components

### Base Classes
- `BaseProvider<TInputs, TOutputs>` - Generic provider interface for CRUD operations
- `BaseResource<TInputs, TOutputs>` - Abstract resource class extending pulumi.dynamic.Resource

### Provider Types
1. **Key Vault Providers**
   - `VaultCertResource` - Certificate management
   - `VaultKeyResource` - Key management
   - `VaultSecretResource` - Secret management
   - `VaultNetworkResource` - Network rules configuration

2. **Security Providers**
   - `PGPGenerator` - PGP key pair generation
   - `SshKeyGenerator` - SSH key pair generation

3. **CDN/Network Providers**
   - `CdnHttpsEnable` - Enable HTTPS on CDN endpoints
   - `NetworkRoute` - Network routing configuration

4. **API Management Providers**
   - `ApimSignInSettings` - APIM sign-in settings
   - `ApimSignUpSettings` - APIM sign-up settings

## Technology Stack
- **Language**: TypeScript
- **IaC Framework**: Pulumi
- **Cloud Provider**: Microsoft Azure
- **Key Dependencies**:
  - `@pulumi/pulumi` - Core Pulumi SDK
  - `@pulumi/azure-native` - Azure Native provider
  - `@azure/identity` - Azure authentication
  - `@azure/keyvault-*` - Key Vault SDKs
  - `@azure/arm-*` - Azure Resource Manager SDKs
  - `openpgp` - PGP encryption
  - `node-forge` - X.509 certificate generation

## Development Workflow
1. Define Input/Output interfaces for resource properties
2. Implement ResourceProvider class with CRUD lifecycle methods
3. Create Resource class extending BaseResource
4. Export from index.ts for public API
5. Test with Pulumi stack operations

## File Structure
```
src/
├── BaseProvider.ts          # Core provider interfaces and base classes
├── types.ts                 # Shared type definitions
├── AzBase/                  # Azure SDK integration helpers
├── VaultCert.ts            # Example provider implementation
├── VaultKey.ts             # Example provider implementation
├── VaultSecret.ts          # Example provider implementation
└── index.ts                # Public API exports
```

## Related Documentation
- [Provider Pattern](./provider-pattern.md) - How to create new providers
- [Naming Conventions](./naming-conventions.md) - Code style and naming
- [Azure Integration](./azure-integration.md) - Azure SDK patterns
- [Type Safety](./type-safety.md) - TypeScript and Pulumi types
- [Secrets Handling](./secrets-handling.md) - Security best practices
