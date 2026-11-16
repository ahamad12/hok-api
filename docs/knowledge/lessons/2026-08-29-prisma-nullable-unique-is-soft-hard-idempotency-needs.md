---
date: 2026-08-29
description: "Postgres treats NULL != NULL, so @@unique([a,B]) where B is String?"
tags: [memory]
source: mcp-capture
origin: "tapt-api"
session: "2026-08-28T19:23:33.374Z"
scope: project
projects: ["tapt-api"]
aliases: ["Prisma nullable @@unique is soft — hard idempotency needs partial WHERE IS NOT NULL migration"]
confidence: verified
---

> Migrated from the obsidian-mind vault (`memories/2026/08/2026-08-29 Prisma nullable @@unique is soft — hard idempotency needs.md`) on 2026-11-16 when the `om` MCP server was retired. `[[wikilinks]]` point at vault notes and may not resolve here.

# Prisma nullable @@unique is soft — hard idempotency needs partial WHERE IS NOT NULL migration

Postgres treats NULL != NULL, so @@unique([a,B]) where B is String? allows unlimited NULL rows — contract requires clientMessageId but DB won't enforce. To make an idempotency key hard, drop @@unique from schema.prisma, add comment, and create a hand-edited migration with CREATE UNIQUE INDEX ... WHERE "col" IS NOT NULL (same as scratch_scan_events_pack_shift_active_key). isUniqueViolation(P2002) still catches P2002 from a partial index, and repository must use findFirst (vault-pure) not findUnique (which needs @@unique in generated WhereUniqueInput). Keeping @@unique + hand-edited WHERE keeps findUnique typed but creates schema/DB drift — choose one ownership and document.

## How this is known

Verified against packages/db/prisma/schema/schema.prisma:484,509 (String? + @@index), migrations 20260827003311 hard partial, and ticket.repository.ts:70 + ticket-message.repository.ts:32 isUniqueViolation handling. PrismaClientKnownRequestError P2002 mapping confirmed via common/prisma/errors.ts:19.
