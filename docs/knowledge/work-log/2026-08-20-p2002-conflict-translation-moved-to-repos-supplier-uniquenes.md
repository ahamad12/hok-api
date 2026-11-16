---
date: 2026-08-20
description: 'Executed Option A of the layering sweep in tapt-api: repositories now own P2002->ConflictError translation via a single shared guard, 10 use-cases…'
aliases:
  - 'P2002 conflict translation moved to repos; supplier uniqueness added'
tags:
  - project-note
source_repo: tapt-api
---

> Migrated from the obsidian-mind vault (`inbox/2026-08-20-p2002-conflict-translation-moved-to-repos-supplier-uniquenes.md`) on 2026-11-16 when the `om` MCP server was retired. `[[wikilinks]]` point at vault notes and may not resolve here.

# P2002 conflict translation moved to repos; supplier uniqueness added

Executed Option A of the layering sweep in tapt-api: repositories now own P2002->ConflictError translation via a single shared guard, 10 use-cases were cleaned of Prisma imports/try-catch, Supplier gained @@unique([shopId, name]) with a manual migration, and auth refresh-token persistence moved from TokenService into a new RefreshTokenRepository. Full verification passed.

## What changed

- apps/server/src/common/prisma/unique-violation.ts - new shared isUniqueViolation guard; only place Prisma error types are referenced outside repositories
- user/shop/category/license/scratch-pack/till-entry/supplier repositories - wrapped create/update with isUniqueViolation and throw domain ConflictError (user dispatches on meta.target for email vs username)
- scratch-scan-event.repository.ts - refactored its existing P2002 catch onto the shared guard
- 10 use-cases (register-user, update-user-profile, create/update-shop, create/update-category, create/update-license, receive-scratch-pack, reverse-till-entry) - removed Prisma imports, Prisma.InputJsonValue, and try/catch P2002 blocks
- create-shop.use-case.ts - address input type changed from Prisma.InputJsonValue to Record<string, unknown>
- packages/db/prisma/schema/schema.prisma - Supplier now has @@unique([shopId, name])
- packages/db/prisma/migrations/20260820_supplier_shop_name_unique/migration.sql - manual CREATE UNIQUE INDEX suppliers_shop_id_name_key
- apps/server/src/modules/auth/repositories/refresh-token.repository.ts - new repo; token.service.ts now injects it instead of PrismaService; auth.module.ts wires it
- packages/db/src/index.ts - exported RefreshToken type
- 10 use-case specs updated to assert ConflictError propagates from mocked repo; P2002 translation tests added to 6 repo specs; new refresh-token.repository.spec.ts
- apps/server/src/test/fixtures/prisma-error.fixture.ts - shared buildUniqueViolationError(target) helper
- AGENTS.md - new Layering Conventions section documenting repos-own-P2002 rule; suppliers unique note added to Database Notes


## Decisions

- Option A: repositories own P2002 translation, not use-cases or the filter. Use-cases must never import Prisma; the global exception filter keeps a P2002->409 fallback as last-resort only
- RefreshToken added as type-only export in packages/db/src/index.ts so typecheck passes; runtime dist unaffected because type exports are erased at compile
- User repo dispatches ConflictError message on error.meta.target (email vs username), moved from use-cases
- Delivery module deliberately left alone: no unique constraints and the guarded updateMany race pattern is a different correct concern
- scratch-scan-event keeps repo-level catch as a documented AGENTS.md exception since the partial unique index can't be expressed in schema.prisma



## Verification

npm run check-types in apps/server passes; npm test (vitest run) 83 files / 514 tests pass; npm run build + check-types in packages/db pass; npx biome lint on changed files reports only baseline warnings, zero errors; grep confirms no @tapt-api/db/prisma or P2002 remains in any *use-case.ts; prisma generate regenerated client (v7.8.0)


## Open

- Migration 20260820_supplier_shop_name_unique not applied to any database; prod data with duplicate supplier names per shop must be deduped before prisma migrate dev
- Large uncommitted working tree (in-flight scratch/till-entry->P2002, delivery payment/void guards, auth password-strength, supplier read-path) still needs committing by user
- biome check on local Windows still shows CRLF formatting noise (known AGENTS.md caveat); CI check on LF checkout is authoritative



_Recorded 2026-08-20T12:34:36.497Z from `tapt-api` via the om MCP server (routing: fallback)._
