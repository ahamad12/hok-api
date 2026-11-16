---
date: 2026-09-02
description: 'Shipped ProfitReport as enterprise P&L close: ExpenseCategory.bucket enum + partial unique void, aggregator cache-first with gap fallback…'
aliases:
  - 'ProfitReport enterprise close — bucket enum, aggregator, access util, inventory snapshot'
tags:
  - project-note
source_repo: tapt-api
---

> Migrated from the obsidian-mind vault (`inbox/2026-09-02-profitreport-enterprise-close-bucket-enum-aggregator-access.md`) on 2026-11-16 when the `om` MCP server was retired. `[[wikilinks]]` point at vault notes and may not resolve here.

# ProfitReport enterprise close — bucket enum, aggregator, access util, inventory snapshot

Shipped ProfitReport as enterprise P&L close: ExpenseCategory.bucket enum + partial unique void, aggregator cache-first with gap fallback, centralized access check, live inventory valuation via ScratchPack, and honest 0s for deliveryRevenue. Left Report→ProfitReport FK, PDF base64 queue, and tests aligned to delivery/daily-summary conventions.

## What changed

- packages/db/prisma/schema/schema.prisma — added enum ExpenseBucket {PURCHASE,LICENSE,SALARY,UTILITY,RENT,OTHER}, ExpenseCategory.bucket @default(OTHER) @index([bucket]), ProfitReport voidedAt/By/Reason + generatedBy Restrict + reports[], Report.profitReportId SetNull, User.voidedProfitReports
- packages/db/prisma/migrations/20260902000000_profit_report_enterprise/migration.sql — CREATE TYPE, ADD bucket DEFAULT OTHER + ILIKE backfill, ADD void columns + FK, CREATE UNIQUE INDEX profit_reports_shop_period_live_key WHERE voided_at IS NULL, DROP/ADD generatedBy Restrict, ADD reports.profit_report_id FK
- apps/server/src/common/domain/profit-report-calculation.ts — pure computeProfitReportTotals (gross=total-purchaseCost, net=total-totalExpense, margin 0 when no revenue)
- packages/api/src/events/event-names.ts — PROFIT_REPORT_VOIDED="report:voided" (keeps "report:generated")
- packages/api/src/events/schemas.ts — profitReportGeneratedPayloadSchema superset (+shopId, profitMargin, generatedById) + profitReportVoidedPayloadSchema + socketEventSchemas entry
- packages/api/src/contracts/profit-report.contract.ts — ProfitReportSchema + Preview (uncoveredDates), periodQuery, router getLatest before getById, void POST, pathPrefix /api/v1
- apps/server/src/modules/expense/repositories/expense.repository.ts — ExpenseBucketTotals, EMPTY_BUCKETS, bucketKey, getBucketTotalsByDate ($queryRaw JOIN bucket), bucketAmountsByCategoryEntries (distinct categoryIds -> Map bucket)
- apps/server/src/modules/daily-summary/repositories/daily-summary.repository.ts — findFinalizedInRange(shopId,gte,lte asc) + daily-summary.module.ts exports[DailySummaryRepository]
- apps/server/src/modules/profit-report/aggregation/profit-report-aggregator.service.ts — toUtcMidnight/toDateKey/eachDate normalized, rangeStart/End, coveredDates Set, flattened allEntries single bucket lookup + fallbackOtherExpense, gap Promise.all per uncovered date, inventoryValue snapshot via packRepo.getInventoryValue parallel, merged as non-additive
- apps/server/src/modules/scratch/repositories/scratch-pack.repository.ts — getInventoryValue(shopId) LATERAL JOIN latest non-voided scan per ACTIVE pack SUM(tickets_remaining * unit_price_cents)
- apps/server/src/modules/profit-report/profit-report-access.util.ts — assertProfitReportAccess unified STAFF|isSupervisor + shopId (ShopAccessGuard only reads params, not body/query)
- apps/server/src/modules/profit-report/use-cases/*.use-case.ts — generate/preview/getAll/getById/getLatest refactored to assertProfitReportAccess; void stays tight OWNER/MANAGER + @Roles
- apps/server/src/modules/profit-report/repositories/profit-report.repository.ts — findById, findByIdOrThrow, create, findAll (includeVoided? + periodStart gte/periodEnd lte cond spread), findLatest, voidIfNotVoided
- apps/server/src/modules/profit-report/mappers/profit-report.mapper.ts — Pick<ProfitReport,23> + toProfitReportResults
- apps/server/src/modules/profit-report/listeners/profit-report-events.listener.ts — AppGateway.emitToShop for GENERATED/VOIDED
- apps/server/src/modules/profit-report/pdf/* — constants pdf-generation, ProfitReportPdfService warm browser + handlebars + template candidates, ProfitReportPdfProcessor toLogoDataUri 5s timeout + 5MB cap + 1 retry, StorageService.upload raw + Report.create
- apps/server/src/modules/profit-report/profit-report.controller.ts — @TsRestHandler + return async ({body|query|params})=> (delivery pattern) + ["void"] bracket, UseCase suffix
- apps/server/src/modules/profit-report/profit-report.module.ts — imports ScratchModule/DailySummary/Delivery/Expense/Gateway/Shop + BullModule pdf-generation, wired in app.module.ts:67
- apps/server/Dockerfile + tsdown.config.ts — apk add chromium + ENV PUPPETEER_* + copy templates
- apps/server/src/test/fixtures/profit-report.fixture.ts + expense-category.fixture.ts bucket OTHER


## Decisions

- ExpenseBucket enum on ExpenseCategory vs separate map table — chose enum: type-safe, indexed JOIN, one-time ILIKE backfill, additive default OTHER; map table would be tenant-configurable without deploy but extra join — rejected for now (decision #4 intentional)
- Partial unique profit_reports_shop_period_live_key WHERE voided_at IS NULL vs Prisma @@unique — Postgres NULL!=NULL so @@unique soft; hard idempotency needs hand-edited migration like scratch_scan_events_pack_shift_active_key and ticket_idempotency_hard_guards (recall 2026-08-29)
- Aggregator single toUtcMidnight/toDateKey source vs per-call slice — prevents covered/gap drift when callers pass time-of-day; flattened allEntries single findMany vs N per-day (N+1) — verified in validation
- Inventory as point-in-time snapshot via packRepo.getInventoryValue parallel to findFinalizedInRange, not per-gap additive — reduce keeps acc.inventoryValue, cur ignored
- Access centralized to profit-report-access.util vs ShopAccessGuard — Guard reads params[paramKey] only, shopId comes via body/query here, so use-case-level check required
- PDF fetch timeout 5s + 5MB cap + 1 retry only on catch (not 4xx) — render without logo rather than fail job; requires Node 18 AbortSignal.timeout
- DeliveryRevenue left 0 — Delivery is cost (totalAmountCents) not sales; no revenue-side field exists, don't fake from Invoice
- Report.profitReportId SetNull keeps voided/regenerated PDFs disambiguated; ProfitReport.generatedBy Restrict preserves audit rows


## Learned

- ExpenseCategory.bucket enum needs migration default OTHER or existing rows block — backfill ILIKE must be reviewed against real category names
- TsRestHandler delivery pattern return async ({body})=> avoids method: never with zod@4 + verbatimModuleSyntax vs legacy tsRestHandler(contract, async) which fails in this toolchain
- TsRestHandler void key must be profitReportContract["void"] not .void (reserved) — same as dailySummaryContract["void"]
- verbatimModuleSyntax requires type-only OnModuleInit/Destroy imports; puppeteer waitUntil networkidle0 valid but tsc with stale @types needs as unknown as "load" cast
- ProfitReportRepository.findAll period spread must conditionally spread ( ...(cond?{field}:{}) ) not {field: cond? {}: undefined} or WHERE contains undefined key and test expects absent key
- ProfitReportAggregator flattened bucket lookup needs empty allEntries -> still call repo (returns EMPTY_BUCKETS) then add fallbackOtherExpense


## Verification

["prisma validate ok, prisma generate ok", "tsc --noEmit 0 profit errors after delivery-pattern controller + waitUntil cast + EMPTY_BUCKETS removal", "vitest run src/modules/profit-report 9 files 78 passed, + profit-report-calculation 9, + daily-summary/expense bucket repos 16 -> 13 files 103 passed; full suite 152 files 1113"]


## Open

- Hardcoded buckets #4 remains decision point — switch to expense_category_bucket_map if tenant-defined lines needed
- includeVoided in repo (includeVoided?) not yet exposed via profitReportContract.getAll query — wire if admin audit needs to list voided
- ScratchPack.getInventoryValue packs with no scans contribute 0 — full-pack value would need join to ScratchGame.priceCents*ticketsPerPack
- puppeteer Browser singleton in ProfitReportPdfService — dist template copy via tsdown copy



_Recorded 2026-09-02T19:19:06.266Z from `tapt-api` via the om MCP server (routing: fallback)._
