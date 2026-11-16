---
date: 2026-11-04
description: 'tapt-api moved from one implicit business with "system-wide" OWNER/MANAGER to self-serve multi-tenancy. Public sign-up creates an OWNER (a tenant)…'
aliases:
  - 'tapt-api multi-tenancy: owner sign-up, tenant-scoped access, invitations'
tags:
  - decision
source_repo: tapt-api
---

> Migrated from the obsidian-mind vault (`inbox/tapt-api-multi-tenancy-owner-sign-up-tenant-scoped-access-in.md`) on 2026-11-16 when the `om` MCP server was retired. `[[wikilinks]]` point at vault notes and may not resolve here.

# tapt-api multi-tenancy: owner sign-up, tenant-scoped access, invitations

tapt-api moved from one implicit business with "system-wide" OWNER/MANAGER to self-serve multi-tenancy. Public sign-up creates an OWNER (a tenant). MANAGER/STAFF join only by email invitation. Every OWNER/MANAGER shop check is scoped to their own tenant's shops. This reverses the earlier recorded model where MANAGER had system-wide access.


## Decisions

- Tenant = the OWNER user (users.owner_id self-FK for MANAGER/STAFF). Rejected: a separate Organization model; it would add a join to every check for no current benefit.
- Tenant shop ids are resolved per request into RequestUser.tenantShopIds (Redis tenantshops:<tid>, invalidated on shop create), so canAccessShop() stays a pure synchronous function. Rejected: injecting an async ShopAccessService into ~65 use-cases.
- canAccessShop fails closed: an OWNER/MANAGER without resolved tenant shops can reach nothing.
- Cross-tenant access returns 403 (AuthorizationError), not 404. Ids are UUIDv4, so enumeration risk is low, and it keeps existing error semantics.
- Shop-less (global) expense categories span all tenants, so new ones are refused and existing ones are read-only.
- Register still accepts role/shopId but rejects non-OWNER with a 400, because tapt-mobile's inviteStaff() posts to /auth/register and would otherwise silently create owner accounts.
- Access tokens without `tid` (minted before deploy) are rejected as AUTH_TOKEN_INVALID so clients refresh into a scoped token.


## Learned

- The global socket 'admin' room joined every OWNER/MANAGER; it had no emitters yet, but would have broadcast across tenants. It is now tenant-admins:<tid>.
- assign/remove-staff's MANAGER check compared requester.shopId, which is always null for managers, so managers could never manage staff.
- The profit-report PDF service crashed server boot (namespace import of CJS handlebars under ESM); unit tests never caught it.


## Verification

vitest 170 files / 1247 tests green, check-types clean. Booted the server on throwaway Postgres 16 + Redis 7 and ran an e2e script: 26/26 checks plus 4 invitation-accept checks pass.


## Open

- tapt-mobile must switch inviteStaff() to POST /invitations and handle the invite deep link (APP_LINK_BASE_URL/invite?token=).
- Phase 4 (password reset + email verification), Phase 5 (Google/Apple sign-in), Phase 6 (docs/auth.md) not started.
- Migration 20261104020000 leaves MANAGER/STAFF owner_id NULL when more than one OWNER exists; these must be assigned by hand.
- Expense-category name backfill in 20260902000000 still needs review against real data.


## Related

- [[Gotchas]]
- [[Patterns]]
- [[Key Decisions]]


_Recorded 2026-11-04T05:20:41.576Z from `tapt-api` via the om MCP server (routing: fallback)._
