---
date: 2026-11-07
description: 'GET /api/v1/shops/my was unreachable: ShopController declared getById (/shops/:id) before getMyShops, so Nest/Express matched /shops/my as id="my"…'
aliases:
  - 'tapt-api: unshadow GET /shops/my and make it role-aware'
tags:
  - project-note
source_repo: tapt-mobile
---

> Migrated from the obsidian-mind vault (`inbox/2026-11-07-tapt-api-unshadow-get-shopsmy-and-make-it-role-aware.md`) on 2026-11-16 when the `om` MCP server was retired. `[[wikilinks]]` point at vault notes and may not resolve here.

# tapt-api: unshadow GET /shops/my and make it role-aware

GET /api/v1/shops/my was unreachable: ShopController declared getById (/shops/:id) before getMyShops, so Nest/Express matched /shops/my as id="my" and ShopAccessGuard returned 403 for every role. It was also OWNER-only, so managers could not list shops. Moved getMyShops above getById in both controller and contract, opened it to OWNER/MANAGER/STAFF, and made GetMyShopsUseCase scope by tenant (OWNER/MANAGER) or own shop (STAFF). Response shape { shops: Shop[] } unchanged for tapt-mobile. Work done in tapt-api, filed from a tapt-mobile session.

## What changed

- apps/server/src/modules/shop/shop.controller.ts - getMyShops moved above getById with an order comment; @Roles(OWNER, MANAGER, STAFF); passes { role, tenantId: user.tenantId ?? null, shopId } instead of requesterId; getById comment fixed (guard checks tenant shops, no OWNER/MANAGER bypass)
- packages/api/src/contracts/shop.contract.ts - getMyShops moved above getById with 'order matters' comment; path and response unchanged
- apps/server/src/modules/shop/use-cases/get-my-shops.use-case.ts - input is now { role, tenantId, shopId }; OWNER/MANAGER -> findByOwner(tenantId), [] when tenantId null; STAFF -> findById(shopId) returned only if it exists and isActive, else []
- apps/server/src/modules/shop/repositories/shop.repository.ts - findByOwner orders by name asc
- apps/server/src/modules/shop/use-cases/__tests__/get-my-shops.use-case.spec.ts - rewritten: owner, manager by tenantId, manager with null tenant, staff active/no shop/soft-deleted/missing shop
- apps/server/src/modules/shop/__tests__/shop.routes.spec.ts - new: reads Nest PATH_METADATA/METHOD_METADATA in prototype declaration order (same order MetadataScanner uses) and fails if any earlier param route shadows a later route, for both controller and contract; includes a positive case reproducing the original bug
- apps/server/src/modules/shop/repositories/__tests__/shop.repository.spec.ts - expects orderBy name asc


## Decisions

- Kept getById's ShopAccess guard untouched; fix is purely route order, matching the recorded rule in brain/Patterns.md ('Route order matters', with delivery supplier-outstanding and license expiring precedents).
- STAFF get their own shop via findById + isActive check rather than a new repository method, so soft-deleted shops stay hidden like in findByOwner.
- Route-order test reads Nest metadata instead of an HTTP e2e: repo has no @nestjs/testing or supertest, and vitest uses esbuild (no design:paramtypes), so booting the controller with DI is not practical without new deps.
- tenantId is trusted from the token: AccessTokenVerifierService already rejects tokens without tid ('Token predates tenant scoping').


## Learned

- Any ts-rest literal route sibling of a :param route must be declared before it in BOTH the contract and the Nest controller; the controller method order is what Express actually sees.
- om identifies the caller by session folder name, so a tapt-mobile session sees tapt-api-scoped memories withheld from recall/search; read the vault directly or run from the tapt-api folder.
- biome check reports 'format' errors on Windows for every CRLF working-copy file (core.autocrlf=input); these are checkout artifacts, not real formatting issues.


## Verification

vitest src/modules/shop: 11 files, 83 tests passed. Full apps/server vitest: 171 files, 1258 tests passed. tsc --noEmit passed for apps/server and packages/api; check:enums passed. biome check on changed files: only pre-existing noExplicitAny warnings and CRLF 'format' errors from the Windows checkout (also on untouched files). Not run against a live server/HTTP request.


## Open

- brain/Gotchas.md says 'ShopAccess ... OWNER/MANAGER bypass always' - stale: canAccessShop now restricts OWNER/MANAGER to tenantShopIds. Should be corrected.
- Other controllers were not audited for the same shadowing bug; shop.routes.spec.ts's findShadowing helper could be generalized to all contracts.
- tapt-mobile still has workarounds (useMyShops disabled for non-owners, STAFF via /shops/:id, MANAGER empty state) that can now be removed.
- Not committed; changes left in the tapt-api working tree for review.


## Related

- [[Patterns]]
- [[Gotchas]]
- ShopAccessGuard only reads path params — body/query shopId must be checked in use-case _(no note yet)_


_Recorded 2026-11-07T05:42:35.186Z from `tapt-mobile` via the om MCP server (routing: fallback)._
