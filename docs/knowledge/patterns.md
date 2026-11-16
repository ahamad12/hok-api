> Migrated from the obsidian-mind vault (`brain/Patterns.md#TAPT`) on 2026-11-16 when the `om` MCP server was retired. `[[wikilinks]]` point at vault notes and may not resolve here.

# TAPT (tapt-api) — verified 2026-08-25

`tapt-backend` is deprecated. Canonical backend is `tapt-api`. Verified from source, not stale docs. `tapt-api/AGENTS.md:1-103` is the live rulebook — re-read it before editing.

## Stack & layout

- **NPM workspaces** `apps/*` `packages/*` (`package.json:1-56` `type:module`). Apps: `apps/server` (NestJS 11). Packages: `@tapt-api/db` (Prisma 7.8), `@tapt-api/api` (ts-rest contracts + zod), `@tapt-api/env` (zod env via `@t3-oss/env-core`), `@tapt-api/config`.
- **Toolchain**: NestJS 11 + ts-rest 3.52 + Prisma 7.8 Postgres, `turbo` + `biome` (`biome.json:61L` lineWidth 100 indent 2), dev via `node --import @swc-node/register/esm-register src/index.ts` (not `tsx` — strips `design:paramtypes` and breaks DI, `AGENTS.md:89`), prod via `tsdown` ESM (`apps/server/tsdown.config.ts:10L` externalizes `bcrypt`, `@prisma/*`, `@sentry/profiling-node`), `vitest` tests.
- **Prisma** `packages/db/prisma/schema/schema.prisma:1-661` — `generator client {output "../generated" moduleFormat "esm" runtime "nodejs"}` + `prisma.config.ts` holds `DATABASE_URL`. Enums 10: `UserRole`, `TaskStatus`, `TicketStatus`, `TicketPriority`, `PaymentMode`, `PeriodType`, `ScratchPackStatus`, `ScratchPackLocation`, `LicenseRenewalSource`, `TillEntryCategory`. Models 20+: `User`, `RefreshToken`, `Shop`, `Task`, `ScratchGame`, `ScratchPack`, `ScratchScanEvent`, `License`, `LicenseRenewal`, `Category`, `Supplier`, `Delivery` + `DeliveryLineItem` + `DeliveryPayment`, `Ticket` + `TicketMessage` + `TicketAcknowledgement`, `Form` + `FormSubmission`, `TillEntry`, `DailySummary`, `ExpenseCategory` + `Expense`, `ProfitReport`, `Report`. 11 have modules today (`auth`→`form` inclusive, see Audit) + `Task` uncommitted, remaining 2 (`DailySummary`, `ProfitReport`).
- **Money**: always `Int` cents (`priceCents`, `amountCents`, `lineTotalCents`, `paymentAmount`) never `Float`. `Float` only for `DeliveryLineItem.quantityOrdered/Received`.

## Contracts (source of truth)

- All routes in `packages/api/src/contracts/*.contract.ts` (auth, shop, category, supplier, delivery, scratch, license, till-entry, task, ticket, expense, expense-category, form): `const c = initContract(); export const XContract = c.router({...}, {pathPrefix:"/api/v1"})`. Never `app.setGlobalPrefix` or `enableVersioning` — would double to `/api/v1/api/v1` (`apps/server/src/main.ts:20-24` comment).
- Zod schemas live per-contract: `z.string().uuid()`, `z.enum(...)`, `z.coerce.date()`, `serialSchema=/^\d{3}$/` (`scratch.contract.ts:9`). Password via shared `packages/api/src/validators/password-strength.ts:1-17` (≥8 + upper/lower/digit/special) used by both `auth.contract.ts` `superRefine` and server `password-hasher.service.ts:30`.
- **Rule**: DTOs that overlap DB columns typed via `z.infer<typeof shopAddressSchema>` not `Prisma.ShopAddress` (see `delivery`, `shop` contracts). Keeps mobile import clean (no Prisma).
- **Route order matters**: `GET /deliveries/supplier-outstanding` before `GET /deliveries/:id` (`delivery.contract.ts:103`), `GET /licenses/expiring` before `GET /licenses/:id` (`license.contract.ts:71`), else Express swallows.
- **Events**: `packages/api/src/events/event-names.ts:26L` + `schemas.ts:132L` (`SOCKET_EVENTS: task:assigned|updated, ticket:created|updated|message_created|status_changed|assigned|acknowledged, till:created, delivery:created, scratch:*, license:expiring, report:generated, form:submitted `4-uuid` {formId,shopId,submissionId,staffId}, session:revoked`). `socketEventSchemas` map validated at `gateway.validatedEmit` `infra/gateway/app.gateway.ts:75`.

## Bootstrap & globals

- **Sentry first**: `apps/server/src/instrument.ts:17L` must be `import "./instrument"` before anything in `main.ts:1-2` (`import "reflect-metadata"` required for Nest paramtypes). Reads `process.env.SENTRY_DSN` directly.
- **`main.ts:74L`**: `NestFactory.create(AppModule,{logger:WinstonModule.createLogger(winstonConfig)})`, `app.enableShutdownHooks()`, Swagger at `api/docs` non-prod only (`DocumentBuilder` + `addBearerAuth`), `helmet` with CSP compatible with Swagger, `cors: {origin: env.CORS_ORIGIN}`, `app.useWebSocketAdapter(new RedisIoAdapter(app))`.
- **`app.module.ts:124L`**: imports `EventEmitterModule.forRoot(), DbModule, SentryModule, QueueModule, StorageModule, FeatureFlagModule, EmailModule, HealthModule, AuthModule, GatewayModule, ShopModule, TillEntryModule, ScratchModule, LicenseModule, CategoryModule→SupplierModule→DeliveryModule, TaskModule, TicketModule, FormModule, ExpenseCategoryModule, ExpenseModule` (order = dependency chain, comment `L49-50`). Globals via `APP_*`: `LoggingInterceptor`, `TransformInterceptor`, `GlobalExceptionFilter`, `JwtAuthGuard` **first** (must populate `request.user` before `UserThrottlerGuard`/`RolesGuard`/`ShopAccessGuard` — fixed `2026-08-30` `app.module.ts:108` guard order bug), `UserThrottlerGuard` (`UserThrottlerGuard:4` `req.user?.userId ?? req.ip`, dual-window `message-burst`), `RolesGuard`, `ShopAccessGuard`, `WinstonModule`. `forwardRef(Auth↔Shop)` for cycle.

## Common layer — follow exactly

- **Errors** `common/errors/domain.error.ts:118L`: `enum ErrorCode {VALIDATION_ERROR,AUTHENTICATION_ERROR,AUTHORIZATION_ERROR,FORBIDDEN,NOT_FOUND,CONFLICT,BUSINESS_RULE_VIOLATION,RATE_LIMIT_EXCEEDED,INTERNAL_SERVER_ERROR}` + `ERROR_CODE_HTTP_STATUS` map + `abstract DomainError` (`code`, `httpStatus`, `details`) + subclasses `NotFoundError(resource,id?)`, `ConflictError`, `BusinessRuleError`, `ValidationError(field?)`. `common/prisma/errors.ts:25L` single predicate `isUniqueViolation(P2002)` / `isNotFound(P2025)` via `isPrismaErrorWithCode`. **Import Prisma only from `@tapt-api/db/prisma`**, never `@prisma/client` — breaks `instanceof` across workspace instances (`AGENTS.md:82`).
- **Filter** `common/filters/global-exception.filter.ts:271L`: `@Catch()` resolves Domestic→`{success:false,error:{code,message,details},timestamp,path}`, `ZodError→400`, Prisma `P2002→409`, `P2025→404`, `HttpException`, else `500`. Logs `warn` for <500 else `error` + `sentry.captureException` for ≥500, includes `requestId,method,url`.
- **Guards**: `jwt-auth.guard.ts:37L` checks `IS_PUBLIC_KEY`, `Bearer` split, `tokenVerifier.verify`; `roles.guard.ts:51L` needs `ROLES_KEY` + `SUPERVISOR_ONLY_KEY` (OWNER/MANAGER bypass); `shop-access.guard.ts` delegates to `canAccessShop` (`common/domain/shop-access.ts`): STAFF -> own `shopId`, OWNER/MANAGER -> `tenantShopIds`, else `Forbidden` (no supervisor bypass since tenant scoping). Decorators: `public.decorator.ts:4L` `@Public()`, `roles.decorator.ts:8L` `@Roles(...)`/`@RequireSupervisorOrAbove()`, `shop-access.decorator.ts:4L` `@ShopAccess("shopId"?)`, `current-user.decorator.ts:20L` `@CurrentUser("prop"?)`.
- **Interceptors**: `logging.interceptor.ts:64L` generates `requestId = req.headers["x-request-id"] || crypto.randomUUID()`, `performance.now()`, redacts `authorization|cookie|x-api-key`, logs 4xx warn else info. `transform.interceptor.ts:62L` wraps to `{success:true,data}` unless already `{success}` or `StreamableFile`.
- **Auth helpers**: `common/auth/access-token-verifier.service.ts:67L` verifies `jwtService.verifyAsync` + `jwt-payload.schema.ts:14L` + Redis `tokenver:${userId}` 3600s cache else DB `userRepository.findById` and tokenVersion check. `domain/user-role-invariants.ts:43L` validates `role/shopId/isSupervisor` combo, throws `BusinessRuleError`. `redis/redis.client.ts:22L` (`maxRetriesPerRequest:3`, `@Global()`).

## Infra — extend like this

- **Realtime** `infra/gateway/*`: `RedisIoAdapter` needs 2 clients (pub+sub, `redis-io.adapter.ts:64L`). `AppGateway` CORS + `handleConnection` authenticates `gateway.adapter.ts:56L` (`auth.token` or `authorization`), joins `rooms.ts` `user:${id}`, `shop:${shopId}`, `ADMIN_ROOM`. `validatedEmit(room,event,data,shopId)` does `socketEventSchemas[event].safeParse(data)` then `server.to(room).emit({event,shopId,occurredAt,data})`. Listeners `@OnEvent("delivery.created")` → `emitToShop`.
- **Queue** `infra/queue/*`: `@Global()` BullMQ `prefix:tapt:${NODE_ENV}`, `attempts:3 backoff exponential 1000 removeOnComplete 86400`, queues `email` (concurrency 5), `notification` (10), `license`. `email.processor.ts:54L` `send|sendBatch|sendTemplate` via SendGrid; `license-reminder.producer` + `processor` uses `licenseRepository.findCandidatesForReminder`. Health `queue-health.indicator.ts:39L` checks `emailQueue.client`.
- **Storage** `infra/storage/cloudinary.provider.ts:21L` + `storage.service.ts:40L` — `upload(file|Buffer)`, `delete(publicId)`, `getUrl(publicId,{fetch_format:auto})`. Global.
- **Email** `infra/email/*` — SendGrid `@Global()`, `email.service.ts:137L` throws `InternalServerErrorException` with `response.body` on fail.
- **Logger** `infra/logger/winston.module.ts:43L` — redact `authorization|cookie|set-cookie|x-api-key`, prod `json` else `nestLike("TAPT", colors)`, `stderrLevels ["error","warn"]`.
- **Sentry** `infra/sentry/*` + `instrument.ts` — `captureException|Message|setUser|withSpan`, `close(2000)` on shutdown.
- **Feature flags** `infra/feature-flags/growthbook.service.ts:49L` — `GrowthBook` init 2000ms, `isEnabled|getValue` scoped with attributes.

## Module pattern — copy verbatim for new domains

```
apps/server/src/modules/<domain>/
  <domain>.module.ts
  <domain>.controller.ts
  repositories/<domain>.repository.ts
  use-cases/<verb>-<domain>.use-case.ts
  mappers/<domain>.mapper.ts
```

- **Repository** `@Injectable() class XRepository {constructor(private prisma:PrismaService)}` — takes `Prisma.XCreateInput`, wraps `create|update` in `try {create} catch {if(isUniqueViolation(e)) throw new ConflictError("...distinct msg per constraint")}`. `user.repository.ts:88L` even inspects `meta.target` for email vs username. Idempotent deletes catch only `isNotFound`. Never import Prisma in use-cases.
- **Use-case** `@Injectable() class XUseCase {execute(input):Promise<Out>}` — authorize: STAFF must `shopId===requesterShopId` else `AuthorizationError`; check shop active; `assertValidUserRoleAssignment`; compute `lineTotalCents=Math.round(qty*unitPrice)`, `balanceDueCents`, `paymentStatus` (mapper); call repo in `$transaction`; `eventEmitter.emit("delivery.created",{...})`.
- **Controller** `@Controller() @TsRestHandler(contract)` returns `{status:201|200, body}`; inject `@CurrentUser() user:RequestUser`; guard per-route with `@Public()` or `@Roles` / `@ShopAccess`. No Prisma catches there.
- **Atomic guards**: never `find→update`. Use guarded `updateMany` — `delivery.repository.ts:222L` `recordPaymentIfWithinBalance` does `updateMany({where:{id, voidedAt:null, totalPaidCents:{lte: totalAmount-amount}}, data:{increment}})` else `BusinessRuleError`; scratch `createScanAndFinishPackIfDepleted:198L` catches P2002 for partial index `scratch_scan_events_pack_shift_active_key`; `voidScanAndRevertPackIfFinished` raw SQL `WHERE NOT EXISTS (later scan)`.
- **Cache helpers**: `License.current*` (`currentRenewalId`, `currentIssueDate`, `currentExpiryDate`) and `Delivery.totalPaidCents` are denormalized — refreshed transactionally on every write (see schema comments `L283`, `L390`).

## Response shapes

- **HTTP**: `GlobalExceptionFilter` produces `{success:false,error:{code,message,details?},timestamp,path}` for errors; `TransformInterceptor` wraps success to `{success:true,data}`. Health `GET /health` returns `health.check([prisma,queue])` via `@terminus`.
- **Money/validation**: cents `Int` everywhere; `TillEntry.amount` positive on original, negative reversal `reversesEntryId @unique`; `DeliveryLineItem.quantityReceived` can be < ordered (discrepancy); `Supplier` `@unique([shopId,name])` with `categoryId → Restrict`.

## Best practices (borrowed, applied to TAPT)

- **Contract-first**: new endpoint → add zod schema in `packages/api/src/contracts/`, infer `z.infer` server side, reuse same contract in mobile — no duplicate DTO.
- **Single Prisma predicate**: all repos import `isUniqueViolation/isNotFound` from one file — never inline `code==="P2002"`.
- **No service-locator**: Nest DI everywhere, no manual `Container.getInstance()` silo (tapt-backend anti-pattern retired).
- **Guard over inline `if(role)` checks**: use `@Roles`/`@ShopAccess` + `RolesGuard`/`ShopAccessGuard`, not `if(req.user.role!=='OWNER')` in controller.
- **Events not direct calls**: cross-domain side-effects via `EventEmitter2` (`@OnEvent`) then gateway/queue, not service imports.
- **Idempotency & concurrency first**: guarded `updateMany` + transactions + partial unique indexes in migrations, not optimistic retry loops.
