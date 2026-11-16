---
date: 2026-11-04
description: "In @nestjs/throttler v5 and later (verified on 6.5.0), ThrottlerGuard.canActivate loops over ALL throttlers registered in ThrottlerModule.forRoot({…"
tags: [memory]
source: mcp-capture
origin: "tapt-api"
session: "2026-11-04T04:14:22.223Z"
scope: platform
projects: []
platforms: ["nestjs"]
aliases: ["@nestjs/throttler v5+ applies every named throttler to every route"]
confidence: verified
---

> Migrated from the obsidian-mind vault (`memories/2026/11/2026-11-04 @nestjs throttler v5+ applies every named throttler to.md`) on 2026-11-16 when the `om` MCP server was retired. `[[wikilinks]]` point at vault notes and may not resolve here.

# @nestjs/throttler v5+ applies every named throttler to every route

In @nestjs/throttler v5 and later (verified on 6.5.0), ThrottlerGuard.canActivate loops over ALL throttlers registered in ThrottlerModule.forRoot({ throttlers: [...] }) for EVERY route. @Throttle({ name: {...} }) only overrides the limit/ttl for that name on that route; it does not scope the throttler to that route. So adding a strict named bucket such as { name: "auth", limit: 20 } or { name: "burst", ttl: 1000, limit: 3 } silently caps the whole API at that rate per tracker.

Fix options: (1) @SkipThrottle({ name: true }) on every other controller (error-prone); (2) per-throttler skipIf; (3) subclass ThrottlerGuard and override handleRequest: for throttler.name !== "default", return true unless reflector.getAllAndOverride("THROTTLER:LIMIT" + name, [handler, class]) is defined (that is the metadata key @Throttle writes). Option 3 makes named throttlers opt-in and is a single place.

Related: getTracker falling back to req.ip is useless behind a load balancer unless Express "trust proxy" is set — every anonymous client shares the proxy IP bucket. Per-route trackers can be set inside @Throttle({ name: { limit, ttl, getTracker } }), e.g. keyed on a hash of the login email for per-account credential-stuffing limits.

## How this is known

Read node_modules/@nestjs/throttler/dist/throttler.guard.js canActivate (v6.5.0) loop over this.throttlers; THROTTLER_LIMIT = 'THROTTLER:LIMIT' in throttler.constants.js; unit test user-throttler.guard.spec.ts in tapt-api passes with the opt-in override.
