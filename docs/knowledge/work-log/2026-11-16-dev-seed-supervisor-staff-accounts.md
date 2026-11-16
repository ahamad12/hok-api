---
date: 2026-11-16
description: 'Added an idempotent dev seeder (packages/db/prisma/seed.ts) that creates a supervisor STAFF and a plain STAFF account inside the iamahamad@gmail.com tenant, assigned to Main Street shop, because register is OWNER-only and staff normally arrive by invitation.'
aliases:
  - 'tapt-api: dev seed for supervisor and staff accounts'
tags:
  - project-note
source_repo: tapt-api
---

# tapt-api: dev seed for supervisor and staff accounts

No seed script existed in the repo, and the normal account paths cannot produce
what was needed for manual mobile testing: `POST /auth/register` always creates
an OWNER, and MANAGER/STAFF only exist after accepting an invitation email.
Seed two STAFF accounts (one with `isSupervisor = true`) directly against the
existing `iamahamad@gmail.com` tenant instead.

## What changed

- `packages/db/prisma/seed.ts` — new idempotent seeder. Loads
  `apps/server/.env`, resolves the owner by email and `Main Street shop` by
  `(ownerId, name)`, fails loudly if either is missing, hashes the dev password
  with `bcrypt` at `BCRYPT_SALT_ROUNDS`, then upserts both STAFF accounts by
  email with `ownerId`, `shopId`, `role = STAFF`, the correct `isSupervisor`,
  and `isActive: true`. On update it bumps `tokenVersion` so a password reset
  kills existing sessions. Prints the credential rows at the end.
- `packages/db/package.json` — `db:seed` script (`tsx prisma/seed.ts`) and
  `tsx` devDependency.
- `package.json` (root) + `turbo.json` — `db:seed` task (`cache: false`).
- `tapt-mobile/.env` — `EXPO_PUBLIC_API_HOST` corrected from `192.168.1.8` to
  the machine's current LAN address `192.168.1.5` (local file, not committed).

Seeded accounts (both under `iamahamad@gmail.com`, shop `Main Street shop`):

- `iamahamad+supervisor@gmail.com` — STAFF, supervisor
- `iamahamad+staff@gmail.com` — STAFF

## Decisions

- Direct DB writes rather than HTTP: the invitation acceptance flow needs an
  emailed token, and register is OWNER-only. The seeder still respects
  `user-role-invariants.ts` (supervisor is STAFF + shop-scoped; both have an
  `ownerId`).
- The owner row is never touched: its password and 3 shops stay as they were.
- Reruns are a deliberate dev reset — same password, `tokenVersion` bumped, no
  duplicate rows (upsert by normalized email).
- Committed as a reusable script instead of a one-off SQL command so the same
  accounts can be restored after a DB reset.

## Verification

- `npm run db:seed` twice: same user ids both times, user count unchanged
  (2 seeded rows, 6 users total), `token_version` moved 0 -> 1 on the rerun.
- `POST /api/v1/auth/login` for both accounts: 200 with `role: STAFF`,
  `isSupervisor` true/false as seeded, `shopId` = Main Street shop, and a
  tenant id in the access token. Wrong password: 401.
- `npm run check-types` in `packages/db` passed; `biome check` on the changed
  files passed.

## Open

- The seeded password is shared and lives only in the seeder; change it in-app
  after first login if these accounts outlive manual testing.
- `tapt-mobile/.env` is machine-specific; when DHCP changes the LAN IP it must
  be updated again (or use `10.0.2.2` for an Android emulator).
- Not committed; changes left in the working tree for review.

## Demo data seeder

`packages/db/prisma/seed-demo.ts` (`npm run db:seed:demo`) adds sample categories, suppliers, deliveries, tasks, tickets, scratch games and packs, till entries and expenses to Main Street shop so the mobile app has content for screenshots and the README demo video. It is additive only (nothing is updated or deleted) and does nothing once the marker supplier "Fresh Farms Produce" exists. It needs the staff accounts from `db:seed` first. To remove the demo rows, delete them by hand; there is no undo script.
