---
date: 2026-09-03
description: "ProfitReport needs one live report per period but Prisma can't express WHERE voided_at IS NULL."
tags: [memory]
source: mcp-capture
origin: "tapt-api"
session: "2026-09-02T19:19:57.472Z"
scope: project
projects: ["tapt-api"]
aliases: ["ProfitReport one-live-per-period needs partial unique index not Prisma @@unique"]
confidence: verified
---

> Migrated from the obsidian-mind vault (`memories/2026/09/2026-09-03 ProfitReport one-live-per-period needs partial unique index.md`) on 2026-11-16 when the `om` MCP server was retired. `[[wikilinks]]` point at vault notes and may not resolve here.

# ProfitReport one-live-per-period needs partial unique index not Prisma @@unique

ProfitReport needs one live report per period but Prisma can't express WHERE voided_at IS NULL. Use hand-edited migration CREATE UNIQUE INDEX profit_reports_shop_period_live_key ON profit_reports (shop_id, period_start, period_end) WHERE voided_at IS NULL like scratch_scan_events_pack_shift_active_key and ticket_idempotency_hard_guards. Keep schema.prisma comment noting partial index and isUniqueViolation handling; don't add Prisma @@unique which would be soft (Postgres NULL!=NULL).

## How this is known

Verified against migration 20260902000000_profit_report_enterprise and schema.prisma ProfitReport comment 752.
