# tapt-api — TAPT Backend

> Canonical backend for TAPT shop management platform. NestJS + ts-rest + Prisma workspaces.

## Where design decisions live

Design rationale now lives **in this repo**, indexed by graphify (the `om` vault server was retired 2026-11-16 and its TAPT notes were copied here):

- `docs/knowledge/key-decisions.md`: settled choices; don't re-argue them
- `docs/knowledge/patterns.md`: how modules, contracts and infra are built
- `docs/knowledge/gotchas.md`: traps already paid for
- `docs/knowledge/codebase-map.md`: module and audit map
- `docs/knowledge/lessons/`: durable single-fact lessons
- `docs/knowledge/work-log/`: what past sessions changed and why
- `docs/adr/` + `GLOSSARY.md`: new decisions and vocabulary (created lazily by `/domain-modeling`)

**Query the graph first.** When `graphify-out/` exists, start with `graphify query "<question>"`, `graphify explain "<node>"` or `graphify affected "<node>"` (or `/graphify` in Claude Code), then read only the files it points at. After code changes run `graphify update .`. This is code-only, needs no LLM, and refreshes the AST part of the graph.

Consult the record before changing:

- the Prisma schema (`packages/db/prisma/schema/schema.prisma`) — money as `Int` cents, `@@unique([shopId,name])`, partial index `scratch_scan_events_pack_shift_active_key`, denormalized `License.current*` / `Delivery.totalPaidCents`
- token lifecycle (`tokenVersion` + Redis `tokenver:${userId}` + SHA-256 `refresh_tokens.token`) and `isUniqueViolation` / `isNotFound` single predicate (`apps/server/src/common/prisma/errors.ts`)
- the ts-rest contract (`packages/api/src/contracts/*` with `pathPrefix "/api/v1"`) — DTOs via `z.infer`, route order matters (`delivery.contract.ts:103` etc.)
- guarded `updateMany` + `$transaction` concurrency (delivery payments `delivery.repository.ts:222`, scratch scans, dailySummary) and `Json` schema validation (`Task.recurringConfig`, `Form.schema`)
- the infra boundaries (`infra/gateway` Redis adapter, `infra/queue` BullMQ, `infra/storage` Cloudinary) and global guards (`RolesGuard`, `ShopAccessGuard`)

If those docs and the code disagree, the docs hold the *why*. Reconcile before changing behaviour.

**Say what came back, in whatever you write before implementing:** a plan, a design note, an issue comment. Name the recorded decisions the work rests on, anything that argues *against* the approach, and an explicit "nothing recorded on this" when the record is empty.

## Recording what you learn

The test is whether it would help on a **different** task.

- **Durable lesson** (a constraint, a costly gotcha, a rule that generalises): add a file to `docs/knowledge/lessons/` named `YYYY-MM-DD-<slug>.md`, with `confidence: verified|inferred|unverified` in its frontmatter. If it's a trap, add a line to `gotchas.md` too.
- **Decision** with alternatives rejected: write an ADR in `docs/adr/` (`/domain-modeling` does this).
- **What happened here** (changes, what's still open, how it was verified): add a file to `docs/knowledge/work-log/`.
- For a graph Q&A that was useful or wrong, record it with `graphify save-result --question … --answer … --outcome useful|dead_end|corrected`.

## Stack quirks (read before coding)

- Dev runner is `node --import @swc-node/register/esm-register` (not `tsx`) — `tsx` breaks Nest DI (`tapt-api/AGENTS.md:89`)
- Prod build `tsdown` externalizes `bcrypt`, `@prisma/*`, `@sentry/profiling-node` (`apps/server/tsdown.config.ts`) — bundling breaks native loader
- Import Prisma only via `@tapt-api/db/prisma`, never `@prisma/client` — breaks `instanceof` (`AGENTS.md:82`)
- Money always `Int` cents; `Float` only for `DeliveryLineItem.quantity*` and `ProfitReport.profitMargin`

## Agent skills

### Issue tracker

Issues and specs live as local markdown under `.scratch/<feature>/` (no remote tracker). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), recorded as a `Status:` line in each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
