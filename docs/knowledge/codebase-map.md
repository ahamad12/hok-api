---
date: 2026-08-25
description: "TAPT tapt-api architecture map — NestJS workspaces, contracts, modules, module list"
tags:
  - brain
  - reference
---

> Migrated from the obsidian-mind vault (`reference/tapt-api-codebase.md`) on 2026-11-16 when the `om` MCP server was retired. `[[wikilinks]]` point at vault notes and may not resolve here.

# TAPT (tapt-api) — Codebase

NestJS + ts-rest + Prisma (workspaces). Canonical backend is `tapt-api`. `tapt-backend` deprecated.

See [[Patterns#TAPT (tapt-api)]] for full patterns, [[Gotchas#TAPT (tapt-api)]] for traps, [[Key Decisions#TAPT (tapt-api)]] for settled choices.

## Modules — as of 2026-11-16

All planned modules are built under `apps/server/src/modules/*`: auth, invitation, shop (+ team), category, supplier, delivery (+ check-in), license, scratch, till-entry, task, expense-category, expense, ticket, form, daily-summary, profit-report. The 2026-08-30 audit table and 'remaining modules' build order that used to live here are obsolete (DailySummary and ProfitReport shipped) and were removed. Use `git log` and the graph (`graphify query`) for per-module history.

## Module pattern

```
packages/api/src/contracts/<domain>.contract.ts  # zod, pathPrefix "/api/v1"
apps/server/src/modules/<domain>/
  <domain>.module.ts
  <domain>.controller.ts  # @Roles/@ShopAccess, TsRestHandler
  repositories/<domain>.repository.ts  # Prisma.*CreateInput, isUniqueViolation/isNotFound
  use-cases/<verb>-<domain>.use-case.ts  # STAFF ShopAccess, guarded updateMany $transaction
  mappers/<domain>.mapper.ts
```

`AGENTS.md:80-93` — single predicate `common/prisma/errors.ts:25L`, `z.infer` DTOs, `swc-node` dev, `tsdown` externalizes `bcrypt + @prisma/*`.
