---
date: 2026-11-10
description: 'Staff and supervisors needed to check deliveries in, fix lines and quantities, and attach an invoice photo. The earlier rule was that delivery line…'
aliases:
  - 'Delivery check-in: PENDING/RECEIVED status, edit-while-pending, bill upload'
tags:
  - decision
source_repo: tapt-mobile
---

> Migrated from the obsidian-mind vault (`inbox/delivery-check-in-pendingreceived-status-edit-while-pending.md`) on 2026-11-16 when the `om` MCP server was retired. `[[wikilinks]]` point at vault notes and may not resolve here.

# Delivery check-in: PENDING/RECEIVED status, edit-while-pending, bill upload

Staff and supervisors needed to check deliveries in, fix lines and quantities, and attach an invoice photo. The earlier rule was that delivery line items are immutable after creation. It now reads: lines are editable only while a delivery is PENDING and unpaid. Checking in (RECEIVED) locks them. Payments need RECEIVED and edits need PENDING, so the two can never interleave and the cached totalPaidCents stays valid. Bills upload through a server route into Cloudinary.

## What changed

- packages/db/prisma/schema/schema.prisma - enum DeliveryStatus {PENDING, RECEIVED}; Delivery.status (default PENDING), receivedAt, receivedById (User, SetNull), @@index([shopId,status]); comment on totalAmountCents rewritten for the new rule
- packages/db/prisma/migrations/20261111010000_delivery_status_checkin - adds the column with default RECEIVED so existing rows backfill as checked in (with receivedAt/By = deliveredAt/By), then switches the default to PENDING. Matches prisma migrate diff apart from the backfill
- packages/api/src/contracts/delivery.contract.ts - status/receivedAt/receivedById on deliverySchema; getAll ?status; create.receiveNow; PATCH /deliveries/:id (supplierId, deliveredAt, lineItems as a full replace); POST /deliveries/:id/receive; POST /deliveries/:id/bill (multipart 'file')
- delivery.repository.ts - updateIfPending: guarded updateMany WHERE status PENDING, voidedAt null, totalPaidCents 0, then replaces lines in the same $transaction; receiveIfPending: guarded flip; setBillUrlIfNotVoided; recordPaymentIfWithinBalance guard now also requires status RECEIVED; getTotalsByDeliveredAtDate and getSupplierBalances count RECEIVED only
- use-cases/delivery-line-items.ts - priceLineItems shared by create and update (validation plus lineTotalCents = round(qtyReceived*unitPrice))
- use-cases update-delivery / receive-delivery / upload-delivery-bill - all roles, shop access checked in the use-case; the upload checks type (jpeg/png/webp/heic/pdf) and 10 MB, stores under tapt/deliveries/<shopId>, and deletes the Cloudinary asset if the delivery was voided meanwhile
- record-delivery-payment.use-case.ts - fast-fails with 'Check the delivery in before paying for it'
- delivery.controller.ts - update/receive/uploadBill handlers; uploadBill uses FileInterceptor('file') with a fileSize limit
- tapt-mobile - Delivery types/api/mutations (useUpdateDelivery, useReceiveDelivery, useUploadDeliveryBill, apiUpload multipart helper); deliveries/new doubles as deliveries/edit (?deliveryId=); detail screen has Awaiting check-in badge, Check in footer, Edit items, Bill section (camera/library via expo-image-picker), and payments only after check-in; list has a 'To check in' chip for every role; useDaySources counts RECEIVED deliveries only, plus a pendingDeliveries count


## Decisions

- Edit window = PENDING and unpaid only (user's choice). Rejected: editable until paid or the day is finalized, and keeping lines locked entirely
- Payments require RECEIVED. This makes edits and payments mutually exclusive, so updateIfPending never moves totalAmountCents under money already paid
- PENDING deliveries are excluded from day totals and supplier balances until checked in, because their totals can still change
- Existing rows are backfilled RECEIVED so historical day totals and balances don't change
- Bill upload goes through a server multipart route rather than a signed direct Cloudinary upload (user's choice): keys stay server-side
- Bill can be attached in any status, since invoices often arrive after check-in
- deliveredAt is kept as the day the delivery counts on, even if it's checked in later


## Learned

- @tapt-api/db resolves at runtime from dist/ (package exports default ./dist/src/index.js). After prisma generate, run npm run build in packages/db, or new enums are undefined in vitest
- Delivery line items already have quantityOrdered/quantityReceived/discrepancyNote, so check-in didn't need new line columns
- There is no invoice-number field on Delivery; 'edit invoice number' was not built
- tapt-api has no file-upload route anywhere before this; billUrl on expenses and till entries is still a client-supplied URL
- In this environment, inline bash heredocs containing apostrophes fail to parse; writing files with the Write tool avoids it


## Verification

tapt-api: packages/api and apps/server tsc clean; check:enums OK; vitest full suite 175 files / 1285 tests passing, including new delivery.repository.check-in.spec (guards, line replace, day totals RECEIVED-only) and check-in-delivery.use-cases.spec (edit window, check-in races, payment blocked while pending, upload validation and orphan cleanup); biome shows no errors on touched files; prisma validate OK and migrate diff matches. tapt-mobile: tsc clean, eslint no errors, jest 22/133 passing, npx expo export --platform android bundles. No on-device or live-API run.


## Open

- Migration not applied to any database; run prisma migrate deploy where intended
- Upload route not exercised end-to-end against Cloudinary or a real device (unit-tested with a mocked StorageService only)
- No socket event for delivery received/updated; other devices update on refetch only
- Pending deliveries aren't surfaced on Today 'Needs you' or Shift 'For you' yet (useDaySources exposes pendingDeliveries for it)
- A delivery checked in after its deliveredAt day changes that day's live totals; finalized DailySummary snapshots are not recomputed
- Nothing committed in tapt-api or tapt-mobile; tapt-api already had unrelated uncommitted changes (scratch, shop, auth) that were left alone


## Related

- [[Key Decisions]]
- [[Gotchas]]
- [[Patterns]]


_Recorded 2026-11-10T19:58:54.239Z from `tapt-mobile` via the om MCP server (routing: fallback)._
