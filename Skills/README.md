# GitHub Copilot Skills for drunk-pulumi-azure-providers

This folder contains GitHub Copilot skills that provide guidance, patterns, and best practices for developing with the drunk-pulumi-azure-providers library.

## What are GitHub Copilot Skills?

GitHub Copilot Skills are documentation files that help GitHub Copilot understand your codebase better, enabling it to:
- Generate more accurate code suggestions
- Follow your project's conventions and patterns
- Understand your architecture and design patterns
- Provide context-aware recommendations

## Available Skills

### 📖 [overview.md](./overview.md)
**Purpose and Architecture**
- Library overview and target users
- Core architecture and components
- Technology stack
- Development workflow
- File structure

**Use when:** You need to understand the overall purpose, architecture, or structure of the library.

### 🔧 [provider-pattern.md](./provider-pattern.md)
**Creating Custom Providers**
- Step-by-step provider implementation guide
- Resource ID patterns
- Lifecycle method implementation
- Common patterns (idempotency, async operations, error handling)
- Testing providers

**Use when:** Creating new custom dynamic providers or modifying existing ones.

### 📝 [naming-conventions.md](./naming-conventions.md)
**Code Style and Naming Guidelines**
- File, class, and interface naming conventions
- Variable and function naming
- Resource type identifiers
- Import organization
- Code formatting rules

**Use when:** Writing new code or refactoring to ensure consistency with the codebase.

### ☁️ [azure-integration.md](./azure-integration.md)
**Azure SDK Integration Patterns**
- Authentication with DefaultAzureCredential
- Key Vault SDK integration
- ARM SDK patterns
- Async operations and polling
- Caching strategies
- Error handling

**Use when:** Integrating with Azure SDKs or implementing Azure resource operations.

### 🔒 [type-safety.md](./type-safety.md)
**TypeScript and Pulumi Type Patterns**
- Generic type system (DeepInput, DeepOutput)
- Provider interface generics
- Pulumi Input/Output types
- Interface design patterns
- Type validation
- Utility types

**Use when:** Working with TypeScript types, Pulumi types, or ensuring type safety in your code.

### 🔐 [secrets-handling.md](./secrets-handling.md)
**Security and Secrets Management**
- Pulumi secret management
- Azure Key Vault integration
- PGP and SSH key generation
- Certificate security
- Secure logging practices
- Access control

**Use when:** Handling sensitive data, secrets, certificates, or implementing security features.

### 🧪 [testing.md](./testing.md)
**Testing Patterns and Best Practices**
- Test framework setup (Mocha)
- Testing dynamic providers
- Mocking Azure SDK clients
- Integration testing
- Testing async operations
- Error handling tests

**Use when:** Writing tests for providers or ensuring code quality through testing.

## How to Use These Skills

### For Developers

1. **Read relevant skills** before starting work on a feature
2. **Reference patterns** when implementing similar functionality
3. **Follow conventions** outlined in the skills
4. **Keep skills updated** as the codebase evolves

### For GitHub Copilot

GitHub Copilot automatically uses these files to provide better suggestions. The skills help Copilot:
- Understand your project structure
- Generate code following your conventions
- Suggest appropriate patterns
- Provide context-aware completions

### Quick Reference Guide

| Task | Relevant Skills |
|------|----------------|
| Creating a new provider | provider-pattern.md, naming-conventions.md, type-safety.md |
| Adding Azure SDK integration | azure-integration.md, secrets-handling.md |
| Handling secrets or certificates | secrets-handling.md, azure-integration.md |
| Writing tests | testing.md, provider-pattern.md |
| Understanding types | type-safety.md, provider-pattern.md |
| Learning the codebase | overview.md, naming-conventions.md |
| Implementing security features | secrets-handling.md, azure-integration.md |

## Skill Development Workflow

When working on a feature:

1. **Start with overview.md** to understand the architecture
2. **Read provider-pattern.md** for implementation guidance
3. **Check naming-conventions.md** for code style
4. **Reference azure-integration.md** for Azure SDK patterns
5. **Review type-safety.md** for type patterns
6. **Consult secrets-handling.md** for security considerations
7. **Follow testing.md** for test implementation

## Example: Creating a New Provider

Let's say you want to create a new provider for Azure Storage. Here's the workflow:

1. **Read [provider-pattern.md](./provider-pattern.md)** 
   - Understand the three-part structure (Inputs, Provider, Resource)
   - Learn lifecycle methods
   - See implementation patterns

2. **Check [naming-conventions.md](./naming-conventions.md)**
   - File name: `StorageAccount.ts`
   - Interfaces: `StorageAccountInputs`, `StorageAccountOutputs`
   - Classes: `StorageAccountResourceProvider`, `StorageAccountResource`
   - Resource ID: `csp:StorageAccounts:${name}`

3. **Review [azure-integration.md](./azure-integration.md)**
   - Use `DefaultAzureCredential` for auth
   - Import `StorageManagementClient` from `@azure/arm-storage`
   - Implement caching if needed
   - Handle async operations properly

4. **Consult [type-safety.md](./type-safety.md)**
   - Use `BaseOptions<StorageAccountInputs>` for constructor
   - Declare outputs with `declare readonly`
   - Initialize output-only fields as `undefined`

5. **Follow [testing.md](./testing.md)**
   - Create `StorageAccount.test.ts` in `z_tests/`
   - Mock Pulumi runtime
   - Test create, update, delete methods
   - Add integration tests

## Contributing to Skills

If you discover new patterns or best practices:

1. Document them in the appropriate skill file
2. Update examples to reflect current best practices
3. Keep skills concise and actionable
4. Use code examples liberally
5. Update this README if adding new skills

## Maintenance

Skills should be reviewed and updated:
- When introducing new patterns
- When refactoring major components
- When updating dependencies
- Quarterly to ensure accuracy
- When onboarding new team members

## Getting Help

If these skills don't answer your questions:

1. Check the main [README.md](../README.md)
2. Review actual implementation in `src/` directory
3. Look at tests in `z_tests/` directory
4. Ask the team or create an issue

## Skills Quality Checklist

Good skills should be:
- ✅ **Accurate** - Reflects current codebase patterns
- ✅ **Concise** - Easy to scan and reference quickly
- ✅ **Practical** - Includes actionable examples
- ✅ **Complete** - Covers common scenarios
- ✅ **Updated** - Kept in sync with code changes
- ✅ **Discoverable** - Easy to find the right skill

## Additional Resources

- **Pulumi Documentation**: https://www.pulumi.com/docs/
- **Azure SDK for JavaScript**: https://github.com/Azure/azure-sdk-for-js
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/handbook/
- **Mocha Testing**: https://mochajs.org/

---

**Note**: These skills are living documents. As the codebase evolves, keep them updated to maintain their usefulness for both developers and GitHub Copilot.
