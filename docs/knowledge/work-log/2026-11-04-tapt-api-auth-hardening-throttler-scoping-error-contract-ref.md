---
date: 2026-11-04
description: 'Phase 0–2 of the auth hardening plan (2026-11-04). The uncommitted profit-report work went in as 6 logical commits, plus a P2002 fix and a ts-rest…'
aliases:
  - 'tapt-api auth hardening: throttler scoping, error contract, refresh-token sessions'
tags:
  - project-note
source_repo: tapt-api
---

> Migrated from the obsidian-mind vault (`inbox/2026-11-04-tapt-api-auth-hardening-throttler-scoping-error-contract-ref.md`) on 2026-11-16 when the `om` MCP server was retired. `[[wikilinks]]` point at vault notes and may not resolve here.

# tapt-api auth hardening: throttler scoping, error contract, refresh-token sessions

Phase 0–2 of the auth hardening plan (2026-11-04). The uncommitted profit-report work went in as 6 logical commits, plus a P2002 fix and a ts-rest type fix. Then: named throttlers made opt-in, a shared error contract with `reason` + field violations, log redaction, uniform-timing login, and refresh-token families with reuse detection, a session list, revoke-one and logout-all.

## What changed

- apps/server/src/common/guards/user-throttler.guard.ts - named throttlers only apply when a route declares them via @Throttle; emailTracker for the per-account login bucket
- apps/server/src/main.ts - TRUST_PROXY -> express trust proxy; requestIdMiddleware before guards
- packages/api/src/errors.ts - ERROR_CODES (stable categories), ERROR_REASONS (specific), FieldViolation, ApiErrorBody shared with clients
- apps/server/src/common/filters/global-exception.filter.ts - RequestValidationError/ZodError -> 400 VALIDATION_ERROR details.violations; no Prisma message/meta leaks; requestId in body
- apps/server/src/common/logging/mask.ts + winston format - deep key redaction + email masking on every log entry
- apps/server/src/modules/auth/use-cases/login.use-case.ts - compareDummy for unknown email; disabled-account only after a correct password
- packages/api/src/validators/email.ts + migration 20261104000000 - emails stored trimmed + lower-cased
- packages/db schema RefreshToken + migration 20261104010000 - familyId, revokedAt/revokeReason, replacedById, device metadata; backfilled
- apps/server/src/modules/auth/repositories/refresh-token.repository.ts rotate() - guarded updateMany claim in $transaction; ROTATED replay = reuse
- apps/server/src/modules/auth/services/token.service.ts - issueSession/rotate/revoke*; sessrev:<sid> Redis block; SESSIONS_REVOKED_EVENT
- auth contract - logoutAll, getSessions, revokeSession; sessionId in token responses; deviceName on login
- auth.module.ts - JWT verifyOptions pin HS256 + iss/aud; BullMQ auth-maintenance repeatable cleanup replaces setInterval


## Decisions

- Error `code` stays the stable category and the specific cause goes in a new `reason` field. Rejected: replacing codes with specific ones, because tapt-mobile httpClient.ts:199 only refreshes on code === AUTHENTICATION_ERROR and would break.
- Change-password with a wrong current password returns 400 with a body.currentPassword violation instead of 401, because a 401 makes clients spend a refresh token and retry.
- No grace window on refresh reuse: raw child tokens aren't stored, so a racing duplicate refresh kills the session. Acceptable because tapt-mobile single-flights refresh.
- Change-password keeps logging out ALL devices including the current one. Rejected for now: keeping the current session, which needs new tokens returned from change-password (a contract change).
- Per-session revocation uses Redis sessrev:<sid> with TTL = access-token lifetime. tokenVersion remains the per-user kill switch.
- Kept @ts-rest/core 3.52.1 with handlers typed via UseCaseArg<U,I>. Rejected: the 3.53 RC with zod 4 support.


## Learned

- @nestjs/throttler v5+ applies every named throttler to every route, so the existing message-burst 3/s bucket had been capping the whole API.
- Postgres partial unique indexes still raise P2002 through Prisma, even though Prisma can't model them; the profit-report repository wrongly assumed otherwise.
- ts-rest RequestValidationError fields are ZodErrors; the old filter flattened them to 'Bad Request Exception' with no field info.
- On this machine localhost:5432 is held by another Postgres (not the tapt-api container); verify migrations with docker exec psql inside tapt-api-postgres.


## Verification

npm run check-types clean; vitest 164 files / 1187 tests pass; all 16 migrations applied in order to a scratch Postgres 16 DB via docker exec psql; email + refresh-token backfills verified on seeded rows; migrated refresh_tokens matches prisma migrate diff --from-empty DDL.


## Open

- Phase 3 (tenancy: User.ownerId, tenant-scoped ShopAccessGuard, owner-only public register, invitations), Phase 4 (password reset + email verification), Phase 5 (Google/Apple), Phase 6 (docs) not done at time of writing.
- tapt-mobile can now read error.reason and SESSION_REVOKED sessionIds, but doesn't yet.
- Pre-existing biome lint errors (noExplicitAny in specs etc.) left untouched.


## Related

- [[Gotchas]]
- [[Patterns]]


_Recorded 2026-11-04T04:31:41.162Z from `tapt-api` via the om MCP server (routing: fallback)._
