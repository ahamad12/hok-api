import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

const scratchPackStatusSchema = z.enum(["ACTIVE", "FINISHED", "RETURNED"]);
const scratchPackLocationSchema = z.enum(["DISPLAY", "BACKSTOCK"]);
const shiftPeriodSchema = z.enum(["MORNING", "EVENING"]);
const serialSchema = z.string().regex(/^\d{3}$/, 'must be exactly 3 digits, e.g. "007"');

const scratchGameSchema = z.object({
  id: z.string().uuid(),
  shopId: z.string().uuid(),
  gameNumber: z.string().nullable(),
  name: z.string(),
  priceCents: z.number().int(),
  ticketsPerPack: z.number().int(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const createScratchGameBodySchema = z.object({
  shopId: z.string().uuid(),
  gameNumber: z.string().trim().max(50).optional(),
  name: z.string().trim().min(1).max(200),
  priceCents: z.number().int().positive(),
  ticketsPerPack: z.number().int().positive(),
});

const getScratchGamesQuerySchema = z.object({
  shopId: z.string().uuid(),
  isActive: z.coerce.boolean().optional(),
});

const scratchPackSchema = z.object({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
  shopId: z.string().uuid(),
  serialStart: z.string().length(3),
  status: scratchPackStatusSchema,
  location: scratchPackLocationSchema,
  receivedById: z.string().uuid(),
  receivedAt: z.coerce.date(),
  finishedAt: z.coerce.date().nullable(),
  returnedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const receiveScratchPackBodySchema = z.object({
  shopId: z.string().uuid(),
  gameId: z.string().uuid(),
  serialStart: serialSchema,
  location: scratchPackLocationSchema,
});

const getScratchPacksQuerySchema = z.object({
  shopId: z.string().uuid(),
  gameId: z.string().uuid().optional(),
  status: scratchPackStatusSchema.optional(),
  location: scratchPackLocationSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const moveScratchPackBodySchema = z.object({
  location: scratchPackLocationSchema,
});

const scratchScanEventSchema = z.object({
  id: z.string().uuid(),
  packId: z.string().uuid(),
  gameId: z.string().uuid(),
  shopId: z.string().uuid(),
  scanDate: z.coerce.date(),
  shiftPeriod: shiftPeriodSchema,
  scannedSerial: z.string().length(3),
  ticketsSoldSincePrevious: z.number().int(),
  ticketsRemaining: z.number().int(),
  unitPriceCents: z.number().int(),
  revenueCents: z.number().int(),
  scannedById: z.string().uuid(),
  voidedAt: z.coerce.date().nullable(),
  voidedById: z.string().uuid().nullable(),
  voidReason: z.string().nullable(),
  createdAt: z.coerce.date(),
});

const recordScratchScanBodySchema = z.object({
  scanDate: z.coerce.date(),
  shiftPeriod: shiftPeriodSchema,
  scannedSerial: serialSchema,
});

const scratchSalesSummaryQuerySchema = z.object({
  shopId: z.string().uuid(),
  dateFrom: z.coerce.date(),
  dateTo: z.coerce.date(),
});

const scratchSalesSummarySchema = z.object({
  shopId: z.string().uuid(),
  dateFrom: z.coerce.date(),
  dateTo: z.coerce.date(),
  totalTicketsSold: z.number().int(),
  totalRevenueCents: z.number().int(),
  byGame: z.array(
    z.object({
      gameId: z.string().uuid(),
      ticketsSold: z.number().int(),
      revenueCents: z.number().int(),
    }),
  ),
});

const voidScratchScanBodySchema = z.object({
  voidReason: z.string().trim().min(3).max(500),
});

export const scratchGameContract = c.router(
  {
    create: {
      method: "POST",
      path: "/scratch/games",
      body: createScratchGameBodySchema,
      responses: { 201: scratchGameSchema },
    },
    getAll: {
      method: "GET",
      path: "/scratch/games",
      query: getScratchGamesQuerySchema,
      responses: { 200: z.object({ games: z.array(scratchGameSchema) }) },
    },
    getById: {
      method: "GET",
      path: "/scratch/games/:id",
      pathParams: z.object({ id: z.string().uuid() }),
      responses: { 200: scratchGameSchema },
    },
  },
  { pathPrefix: "/api/v1" },
);

export const scratchPackContract = c.router(
  {
    receive: {
      method: "POST",
      path: "/scratch/packs",
      body: receiveScratchPackBodySchema,
      responses: { 201: scratchPackSchema },
    },
    getAll: {
      method: "GET",
      path: "/scratch/packs",
      query: getScratchPacksQuerySchema,
      responses: { 200: z.object({ packs: z.array(scratchPackSchema), total: z.number().int() }) },
    },
    getById: {
      method: "GET",
      path: "/scratch/packs/:id",
      pathParams: z.object({ id: z.string().uuid() }),
      responses: { 200: scratchPackSchema },
    },
    move: {
      method: "PATCH",
      path: "/scratch/packs/:id/location",
      pathParams: z.object({ id: z.string().uuid() }),
      body: moveScratchPackBodySchema,
      responses: { 200: scratchPackSchema },
    },
    returnPack: {
      method: "POST",
      path: "/scratch/packs/:id/return",
      pathParams: z.object({ id: z.string().uuid() }),
      body: z.object({}),
      responses: { 200: scratchPackSchema },
    },
    scan: {
      method: "POST",
      path: "/scratch/packs/:id/scans",
      pathParams: z.object({ id: z.string().uuid() }),
      body: recordScratchScanBodySchema,
      responses: { 201: scratchScanEventSchema },
    },
  },
  { pathPrefix: "/api/v1" },
);

export const scratchSummaryContract = c.router(
  {
    getSummary: {
      method: "GET",
      path: "/scratch/summary",
      query: scratchSalesSummaryQuerySchema,
      responses: { 200: scratchSalesSummarySchema },
    },
  },
  { pathPrefix: "/api/v1" },
);

export const scratchScanContract = c.router(
  {
    void: {
      method: "POST",
      path: "/scratch/scans/:id/void",
      pathParams: z.object({ id: z.string().uuid() }),
      body: voidScratchScanBodySchema,
      responses: { 200: scratchScanEventSchema },
    },
  },
  { pathPrefix: "/api/v1" },
);
