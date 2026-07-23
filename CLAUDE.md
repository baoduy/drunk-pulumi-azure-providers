# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project purpose

`@drunk-pulumi/azure-providers` is a library of custom Pulumi **dynamic providers** for Azure. It sits on top of `@pulumi/azure-native` and the Azure SDKs to give infra-as-code developers simplified, opinionated resource types (Key Vault secrets/keys/certs, SSH/PGP key generation, APIM sign-in/up settings, CDN HTTPS, network rules) that are **secure by default** (secrets always wrapped/marked, strong key sizes, idempotent Key Vault recovery of soft-deleted items) while still exposing every Azure option through typed, optional inputs for customization.

Package is built to `.out-bin/` and published to npm as `@drunk-pulumi/azure-providers`. `pulumi-test/` is a real Pulumi program that consumes the built package (`file:/../.out-bin`) to manually verify providers against actual Azure resources — it's not part of the automated test suite.

## Commands

```bash
pnpm install                # install deps (pnpm workspace)
pnpm run build              # regenerate tsconfig files list, tsc build to .out-bin, copy package.json + README
pnpm run lint               # eslint --fix on **/*.ts
pnpm run test               # mocha over z_tests/**/*.test.ts (tsx loader, TSX_TSCONFIG_PATH=tsconfig.test.json)
pnpm run test-cover         # same, under nyc coverage
pnpm run testcert           # mocha over every *.ts (broader, ad hoc)
pnpm run check              # depcheck for unused/missing deps
pnpm run update             # npm-check-updates -u && pnpm install
```

Run a single test file: `cross-env NODE_ENV=... mocha --timeout 10000 'z_tests/VaultCert.test.ts'` (swap in the target file; see the `test` script in package.json for the full env). Note: `z_tests/` does not exist yet in this repo — it's the expected home for `*.test.ts` files per `Skills/testing.md`, but no tests have been written yet.

Manual verification against real Azure, from `pulumi-test/`: `pulumi up --yes --skip-preview` (`up`), `pulumi destroy --yes --skip-preview` (`destroy`). Requires the root `pnpm run build` to have run first so `.out-bin` is current.

## Architecture

Every resource follows the same three-part shape (see `src/BaseProvider.ts`):

1. **`{X}Inputs` / `{X}Outputs` interfaces** — Outputs = Inputs plus computed/read-only fields (e.g. `version`, `vaultUrl`).
2. **`{X}ResourceProvider implements BaseProvider<Inputs, Outputs>`** — the actual Azure logic: `create` (required), and any of `update`/`delete`/`diff`/`check`/`read`. This is where Azure SDK calls happen.
3. **`{X}Resource extends BaseResource<Inputs, Outputs>`** — the public Pulumi resource. Its constructor wires output-only fields to `undefined` as defaults, wraps sensitive inputs in `pulumi.secret(...)`, sets `additionalSecretOutputs` for sensitive outputs, and registers with Pulumi using resource type id `csp:{ResourceType}s:${name}`.

`BaseOptions<T>` / `BaseOutputs<T>` (in `src/types.ts` via `BaseProvider.ts`) are `DeepInput`/`DeepOutput` recursive mapped types so nested object fields can independently be plain values or `pulumi.Input`/`Output`.

All Key Vault-backed providers (`VaultSecret.ts`, `VaultCert.ts`, `VaultKey.ts`) go through `src/AzBase/KeyVaultBase.ts`, which wraps the three Key Vault SDK clients (secrets/keys/certs) behind one class per vault name, auto-recovers soft-deleted items on write, and defaults to secure settings (e.g. 4096-bit self-signed certs, `enabled: true`). Reads are memoized per-vault by `src/AzBase/KeyVaultCache.ts` (simple in-memory `Record`, keyed by `${vaultName}-${name}`) to cut down on redundant SDK calls within a single Pulumi run. `src/AzBase/Helpers.ts#waitAndRetry` polls for eventual consistency after a write when the client doesn't return the object directly.

`src/index.ts` is the sole public barrel export — new providers must be re-exported there to be part of the package's public API.

For deeper conventions (naming, resource-id format, Azure SDK integration patterns, secrets handling, TypeScript generics, testing patterns), read the topic files in `Skills/` before writing new provider code — they're kept current and are more detailed than this file:

- `Skills/overview.md`, `Skills/provider-pattern.md` — architecture and the standard steps for adding a new provider
- `Skills/naming-conventions.md` — file/class/interface naming, `csp:ResourceType:${name}` id format, import order
- `Skills/azure-integration.md` — auth, ARM/Key Vault client patterns, LRO polling, error handling
- `Skills/secrets-handling.md` — `pulumi.secret()`, `additionalSecretOutputs`, safe logging, cert/key security defaults
- `Skills/type-safety.md` — `DeepInput`/`DeepOutput`, provider generics
- `Skills/testing.md` — intended Mocha setup and mocking approach for providers

## Notes

- `src/AzBase/Internal.ts.ignore` and `src/NetworkRoute.ts.ignore` are excluded from the build/lint on purpose (`.ignore` suffix) — work in progress, not part of the current public API.
- `tsconfig.json`'s `files` array is regenerated by `.tasks/update-tsconfig.ts` as part of `pnpm run build` — don't hand-maintain it.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **drunk-pulumi-azure-providers** (357 symbols, 769 relationships, 5 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/drunk-pulumi-azure-providers/context` | Codebase overview, check index freshness |
| `gitnexus://repo/drunk-pulumi-azure-providers/clusters` | All functional areas |
| `gitnexus://repo/drunk-pulumi-azure-providers/processes` | All execution flows |
| `gitnexus://repo/drunk-pulumi-azure-providers/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
