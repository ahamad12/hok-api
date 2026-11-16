---
date: 2026-09-03
description: "Delivery in tapt-api is cost (Delivery.totalAmountCents stock in from Supplier) not sales."
tags: [memory]
source: mcp-capture
origin: "tapt-api"
session: "2026-09-02T19:19:43.652Z"
scope: project
projects: ["tapt-api"]
aliases: ["Delivery is cost not revenue — profit deliveryRevenue stays 0; inventory is point-in-time snapshot"]
confidence: verified
---

> Migrated from the obsidian-mind vault (`memories/2026/09/2026-09-03 Delivery is cost not revenue — profit deliveryRevenue stays.md`) on 2026-11-16 when the `om` MCP server was retired. `[[wikilinks]]` point at vault notes and may not resolve here.

# Delivery is cost not revenue — profit deliveryRevenue stays 0; inventory is point-in-time snapshot

Delivery in tapt-api is cost (Delivery.totalAmountCents stock in from Supplier) not sales. Delivery.revenueCents / Invoice model does not exist, so ProfitReport.deliveryRevenue must stay 0 and be documented as honest. Do not derive it from TillEntry SALES or DeliveryLineItem — it would double-count and invent revenue. Inventory value for P&L is a point-in-time snapshot from ScratchPack ACTIVE packs (LATERAL JOIN latest non-voided scan tickets_remaining * unit_price_cents), not date-ranged, so aggregate in parallel to DailySummary and treat as non-additive in gap merge (acc.inventoryValue passed through).

## How this is known

Verified against schema.prisma Delivery 404 totalAmountCents, ScratchPack 249 status ACTIVE, ScratchScanEvent 290 tickets_remaining, and aggregator reduce treating inventoryValue as snapshot.
