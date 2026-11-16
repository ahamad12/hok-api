> Migrated from the obsidian-mind vault (`brain/Gotchas.md#TAPT`) on 2026-11-16 when the `om` MCP server was retired. `[[wikilinks]]` point at vault notes and may not resolve here.

## TAPT (tapt-api) — gotchas verified 2026-08-25

`tapt-backend` is deprecated — ignore it. All paths below are `tapt-api`.

### Auth / tokenVersion

- **`tokenVersion` desync = silent logout**: `User.tokenVersion @map("token_version")` (`packages/db/prisma/schema/schema.prisma:85`) increments on role/shop/supervisor change via `TokenVersionService` + Redis `tokenver:${userId}` TTL 3600. `AccessTokenVerifierService:67L` checks `payload.tokenVersion` vs DB. If you add a new permission-changing mutator, bump tokenVersion + invalidate Redis or stale JWTs stay live.
- **Refresh token is SHA-256 hash only** (`apps/server/src/modules/auth/services/token.service.ts:12-14` `createHash("sha256").digest("hex")`). Raw is returned once, never stored/logged. Copying `tapt-backend`'s `uuidv4` raw storage will break verification — `findByToken` hashes before lookup.
- **Bearer parsing**: both HTTP (`jwt-auth.guard.ts:37L`) and WS (`gateway.adapter.ts:56L` `stripBearerPrefix`) split on space, strict `Bearer `. Lower-case `bearer` rejected. Mobile/PWA must send `Authorization: Bearer <jwt>` or `auth: {token: "Bearer ..."}`.
- **Public routes**: `@Public()` sets `IS_PUBLIC_KEY`. Forgetting it makes `JwtAuthGuard` throw `AuthenticationError("Missing bearer token")` even for health.

### RBAC

- **`OWNER`/`MANAGER` cannot have `shopId`**, `STAFF+isSupervisor` requires `shopId` — enforced in `common/domain/user-role-invariants.ts:43L` via `assertValidUserRoleAssignment` (throws `BusinessRuleError`). `User.validate` equivalent there, not entity method. Call it in every shop-assign use-case.
- **`ShopAccess` param name matters**: `shop-access.guard.ts:51L` reads `request.params[paramKey]` where `paramKey` defaults `"shopId"`. If route is `GET /shops/:id`, use `@ShopAccess("id")` else it checks `undefined` and rejects STAFF. OWNER/MANAGER no longer bypass: `canAccessShop` (`common/domain/shop-access.ts`) admits STAFF only for their own `shopId` and OWNER/MANAGER only for `tenantShopIds` (updated 2026-11-16).

### Prisma / validation

- **`isUniqueViolation` only for expected conflicts**: wrap `create|update` only — `refresh-token.repository.ts:66L` intentionally does NOT handle P2002 (256-bit hash collision is `500` not `Conflict`). Use-case must never catch P2002 — repo already translates.
- **Import Prisma via `@tapt-api/db/prisma` only** — `from "@prisma/client"` breaks `instanceof PrismaClientKnownRequestError` across workspaces even with `tsdown` external (`AGENTS.md:82`, `tsdown.config.ts:10L`).
- **Partial unique index invisible**: `scratch_scan_events_pack_shift_active_key` is migration-only `20260806120000` (`AGENTS.md:76`). Don't add `@@unique` for it — Prisma can't express `WHERE voidedAt IS NULL`. Repo catches its P2002 as "scan already recorded for this shift" (`scratch-scan-event.repository.ts:198L`).
- **Contract DTOs, not Prisma types**: `shopAddressSchema` inferred via `z.infer` — repo param is `Prisma.ShopUncheckedCreateInput` built from that, not raw `Record<string,unknown>` cast (`AGENTS.md:84`).

### Concurrency / denormalization

- **Denormalized caches must be updated transactionally**: `License.currentRenewalId|currentIssueDate|currentExpiryDate` (`schema.prisma:287-290`) and `Delivery.totalPaidCents` (`L390`) are refreshed in `$transaction` on every `renew|void|payment`. Direct `prisma.license.update` without renewal write desyncs cache.
- **`delivery.recordPayment`** uses guarded `updateMany` `WHERE totalPaidCents <= totalAmount-amount` → `0` means concurrent overpay → `BusinessRuleError` (`delivery.repository.ts:222L`). Never `find→if→update`.
- **Scratch void latest-only**: `voidScanAndRevertPackIfFinished` raw SQL `WHERE NOT EXISTS (later voidedAt IS NULL)` enforces only most-recent scan can be voided. Bypassing repo with plain `update` breaks pack status revert.

### Tooling

- **Dev runner**: `node --import @swc-node/register/esm-register src/index.ts` (`apps/server/package.json:57L`). `tsx` or `ts-node` strips `design:paramtypes` → Nest DI fails to boot (`AGENTS.md:89`).
- **CRLF on Windows**: `core.autocrlf=true` makes `biome check` show spurious format errors locally that don't fail CI (`AGENTS.md:92`).
- **Biome only fails on errors**: committed baseline has warnings — `npx biome check .` warnings are not CI failures.

### Money / data

- Cents `Int` only — `Shop.address Json`, `Form.schema Json`, `Task.recurringConfig Json` are untyped, validate via contract zod before write.

### Form — added 2026-08-30

- **`Form.schema` 12-field `discriminatedUnion` + `formFieldsSchema` unique `Set(names)`** — field-name uniqueness is `BusinessRuleError` (422) not `ConflictError` (409) — `Form` has no `@@unique` on `schema Json` (`schema.prisma:538`), so `isUniqueViolation(P2002)` never fires for it. Contract `.refine` already does `400` for HTTP, use-case double-guards for direct invocation. `file/image/signature` fields are `https://` URL strings (Cloudinary upload client-side, `form-answer-validation.ts:102`), not base64.
- **`FormValidationError` distinct from `ValidationError`** — `FormValidationError` (in `common/errors/form-validation.error.ts:2`) maps to `422` with `{field,message}[]` via `global-exception.filter.ts:60`, `ValidationError` (Zod shape) maps to `400`. `validateAnswersAgainstSchema` is pure `common/domain/form-answer-validation.ts:13` (no Prisma) — `isEmpty` is `undefined|null|""` but `checkbox false` is NOT empty (`required+false` must pass).
- **`FormSubmissionRepository.create` cast boundary** — `Record<string,unknown> → Prisma.InputJsonValue` cast lives in `form-submission.repository.ts:15` (`as unknown as Prisma.InputJsonValue`), **not** in `submit-form.use-case.ts` (`AGENTS.md:80` repository-only Prisma). `Form.schema` `FormField[]` same pattern.
- **Guard order is load-bearing** — `app.module.ts:108` `JwtAuthGuard` must be first `APP_GUARD` before `UserThrottlerGuard`/`RolesGuard`/`ShopAccessGuard`. Previously `JwtAuthGuard` in `AuthModule` ran after `AppModule`'s guards for `POST /shops`/`POST /forms` causing `403 No authenticated user found` despite valid `Bearer` token — `GET /forms` (no `@Roles`) succeeded, `POST` with `@Roles` failed. Fixed by moving `JwtAuthGuard` to `AppModule` first. `UserThrottlerGuard:4` also needs `request.user` for `req.user?.userId` per-user throttling.

### Money / data — updated 2026-08-30

- Cents `Int` only — `Shop.address Json`, `Form.schema Json` (12-type discriminatedUnion), `Task.recurringConfig Json` are untyped, validate via contract zod before write. `FormSubmission.answers` `Record<string,unknown>` cast to `InputJsonValue` in repository only.
