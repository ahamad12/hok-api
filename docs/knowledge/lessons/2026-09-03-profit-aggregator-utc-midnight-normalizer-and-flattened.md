---
date: 2026-09-03
description: "All calendar-day comparisons in ProfitReportAggregator must go through a single UTC-midnight normalizer (toUtcMidnight via Date.UTC…"
tags: [memory]
source: mcp-capture
origin: "tapt-api"
session: "2026-09-02T19:20:12.794Z"
scope: project
projects: ["tapt-api"]
aliases: ["Profit aggregator UTC-midnight normalizer and flattened bucket lookup prevent drift and N+1"]
confidence: verified
---

> Migrated from the obsidian-mind vault (`memories/2026/09/2026-09-03 Profit aggregator UTC-midnight normalizer and flattened.md`) on 2026-11-16 when the `om` MCP server was retired. `[[wikilinks]]` point at vault notes and may not resolve here.

# Profit aggregator UTC-midnight normalizer and flattened bucket lookup prevent drift and N+1

All calendar-day comparisons in ProfitReportAggregator must go through a single UTC-midnight normalizer (toUtcMidnight via Date.UTC getUTCFullYear/getUTCMonth/getUTCDate) and toDateKey (toISOString.slice 0,10). Use normalized rangeStart/End for both findFinalizedInRange query and covered/uncovered Sets. Also flatten expense bucket lookup to one expenseCategory.findMany for the whole period (collect allEntries then single bucketAmountsByCategoryEntries) instead of one per summary day — prevents N+1 query storm.

## How this is known

Verified against profit-report-aggregator.service.ts toUtcMidnight/toDateKey/eachDate and flattened allEntries single repo call vs previous per-day loop.
