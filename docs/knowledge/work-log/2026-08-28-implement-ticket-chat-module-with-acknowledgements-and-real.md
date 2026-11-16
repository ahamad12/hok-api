---
date: 2026-08-28
description: 'Built complete ticket module as chat: ISSUE/INSTRUCTION/ANNOUNCEMENT types, hybrid HTTP writes + WS notify-only (persist-then-broadcast)…'
aliases:
  - 'Implement ticket chat module with acknowledgements and real-time events'
tags:
  - project-note
source_repo: tapt-api
---

> Migrated from the obsidian-mind vault (`inbox/2026-08-28-implement-ticket-chat-module-with-acknowledgements-and-real.md`) on 2026-11-16 when the `om` MCP server was retired. `[[wikilinks]]` point at vault notes and may not resolve here.

# Implement ticket chat module with acknowledgements and real-time events

Built complete ticket module as chat: ISSUE/INSTRUCTION/ANNOUNCEMENT types, hybrid HTTP writes + WS notify-only (persist-then-broadcast). System-wide MANAGER (STAFF-only shop scoping), idempotent ticket/message creation via hard partial unique indexes WHERE IS NOT NULL, global Int sequence cursor pagination, guarded updateMany transitions. Wired Gateway listener, UserThrottlerGuard dual-window, and 148 tests.

## What changed

- packages/db/prisma/schema/schema.prisma - added TicketType enum, Ticket.type/requiresAck/assigneeId/creationClientId (String? with partial unique comment), TicketMessage.clientMessageId/sequence Int autoincrement global + @@index([ticketId,sequence]), TicketAcknowledgement model, User relations assignedTickets/ticketAcknowledgements
- packages/db/prisma/migrations/20260826_ticket_type_ack_idempotency_sequence + 20260826_ticket_creation_idempotency_key + 20260827003311_ticket_idempotency_hard_guards - additive + hard partial CREATE UNIQUE INDEX WHERE IS NOT NULL for both idempotency keys (Prisma @@unique can't express WHERE)
- packages/api/src/contracts/ticket.contract.ts - 9 routes c.router(pathPrefix /api/v1): create/getAll/getById/getMessages/createMessage/transition/assign/acknowledge/getAcknowledgements with clientMessageId required, recentMessages/since cursor, pathParams
- packages/api/src/events/event-names.ts - added TICKET_STATUS_CHANGED/ASSIGNED/ACKNOWLEDGED to SOCKET_EVENTS (colon ticket:*)
- packages/api/src/events/schemas.ts - tightened ticketStatusChanged from/to to ticketStatusSchema, added ticketAssigned/ticketAcknowledged payloads, registered 5 ticket schemas in socketEventSchemas
- apps/server/src/common/domain/ticket-transitions.ts - ISSUE vs broadcast matrices + isValidTransition/allowedNextStates
- apps/server/src/modules/ticket/repositories/* - TicketRepository.createWithInitialMessage $transaction + isUniqueViolation→findFirst, TicketMessageRepository.createIdempotent/findRecent/findPage cursor, TicketAcknowledgementRepository upsert
- apps/server/src/modules/ticket/mappers/ticket.mapper.ts - Pick<> + destructure message: body → message: body
- apps/server/src/modules/ticket/use-cases 8 files - RequestUser, STAFF-only shop guard, assertValidUserRoleAssignment + narrow STAFF/shop/active, SOCKET_EVENTS emit, no PrismaService in use-cases
- apps/server/src/modules/ticket/ticket.controller.ts - 9 per-route @TsRestHandler + CurrentUser, only createMessage @Throttle dual-window, TicketModule with forwardRef(Auth)+forwardRef(Shop)+GatewayModule
- apps/server/src/common/guards/user-throttler.guard.ts - UserThrottlerGuard getTracker req.user?.userId ?? req.ip
- apps/server/src/app.module.ts - TicketModule import + ThrottlerModule dual-window message-burst 3/1s + message-sustained 30/60s + APP_GUARD UserThrottlerGuard ordering
- apps/server/src/test/fixtures/request-user.fixture.ts + ticket.fixture.ts + ticket-message.fixture.ts + __tests__ 13 files (126 ticket + 22 domain)


## Decisions

- System-wide MANAGER (Option A) - rejected Option B shop-scoped MANAGER; kept ShopAccessGuard OWNER||MANAGER bypass, only STAFF shop-checked; avoids AssignStaffUseCase bug and cross-shop inconsistency
- Hybrid HTTP+WS notify-only - rejected pure WS writes; writes via REST (JwtAuthGuard + ShopAccessGuard + idempotency), gateway emit-only; matches infra/gateway emitToShop pattern
- Hard DB partial unique WHERE IS NOT NULL over app-only validation - soft @@unique allows NULL bypass; partial index in migration only (AGENTS.md precedent scratch_scan_events_pack_shift_active_key)
- Global sequence Int autoincrement + @@index([ticketId,sequence]) - rejected per-ticket 1..N (needs max+1 tx contention); keeps ScratchScanEvent precedent
- Minimal WS payload ticket:created (5 fields) - rejected enriching with requiresAck/assigneeId; REST remains source of truth, WS is notify to fetch
- Enum tightening from/to to ticketStatusSchema - validatedEmit must fail fast on garbage status, not pass z.string()
- Compose assertValidUserRoleAssignment + narrow STAFF/shop/active - global invariant + ticket-specific rule, not duplicated inline logic


## Learned

- Prisma @@unique on nullable String? allows multiple NULLs - hard idempotency needs partial CREATE UNIQUE INDEX WHERE IS NOT NULL; findUnique requires @@unique, so vault-pure is findFirst with WHERE, Prisma-idiomatic restores @@unique + hand-edited migration (tradeoff drift vs type-safety)
- Ticket controller ctor property vs method same namespace requires *UseCase suffix (createTicketUseCase) not listMessages alias - TsRestHandler binding is contract object reference, not method name string
- Global sequence gaps are expected - cursor pagination with sequence gt + orderBy asc + @@index covers gaps without per-ticket max+1 lock
- WS throttling deferred correctly - UserThrottlerGuard HTTP-only until @SubscribeMessage exists; CI tripwire check:ws-write-guard grep @SubscribeMessage is right guardrail


## Verification

["npx prisma format/validate/generate + db push in sync; 3 migrations created", "npx vitest run apps/server/src/modules/ticket + common/domain/ticket-transitions: 13 files 126 ticket + 22 domain = 148 passed (with DATABASE_URL/CORS_ORIGIN/JWT_SECRET env)", "npx biome check --write 18 files fixed, Found 1 warning baseline; npx tsc --noEmit ticket clean (only pre-existing app.gateway decor errors)", "npm run build tsdown ✔ 5954ms (turbo)", "grep PrismaService ticket/use-cases → 0 hits; grep APP_GUARD app.module.ts → UserThrottlerGuard precedes RolesGuard/ShopAccessGuard with AuthModule JwtAuthGuard first; check:ws-write-guard → 0 hits HTTP-only"]


## Open

- Remaining 5 audit modules per reference/tapt-api-codebase.md: ExpenseCategory+Expense, Forms, DailySummary, ProfitReport - Ticket was can-wait but built now; others still missing no dir
- Transition use-case resolvedAt regression test for RESOLVED->CLOSED->OPEN->RESOLVED fresh timestamp not yet pinned (suggested in review)
- CI tripwire for WS write guard not yet wired to GitHub Actions (only package.json script)



_Recorded 2026-08-28T19:22:47.969Z from `tapt-api` via the om MCP server (routing: fallback)._
