---
date: 2026-09-03
description: "In tapt-api, ShopAccessGuard at app.module.ts:134 checks request.params[paramKey] for shop scoping (e.g."
tags: [memory]
source: mcp-capture
origin: "tapt-api"
session: "2026-09-02T19:19:37.961Z"
scope: project
projects: ["tapt-api"]
aliases: ["ShopAccessGuard only reads path params — body/query shopId must be checked in use-case"]
confidence: verified
---

> Migrated from the obsidian-mind vault (`memories/2026/09/2026-09-03 ShopAccessGuard only reads path params — body query shopId.md`) on 2026-11-16 when the `om` MCP server was retired. `[[wikilinks]]` point at vault notes and may not resolve here.

# ShopAccessGuard only reads path params — body/query shopId must be checked in use-case

In tapt-api, ShopAccessGuard at app.module.ts:134 checks request.params[paramKey] for shop scoping (e.g. :shopId, :id). Routes that carry shopId via body (POST /profit-reports/generate body.shopId) or query (GET /profit-reports?shopId= or /profit-reports/latest?shopId=) are not covered by the guard. STAFF isSupervisor + shopId===requester.shopId checks must stay in the use-case. Centralize to profit-report-access.util.ts assertProfitReportAccess(requester, shopId) to avoid 5× duplication; keep VOID tight (OWNER/MANAGER + @Roles) separate because its role set differs.

## How this is known

Verified against app.module.ts ShopAccessGuard, profit-report.controller.ts body/query shopId routes, and 5 use-cases refactored to assertProfitReportAccess.
