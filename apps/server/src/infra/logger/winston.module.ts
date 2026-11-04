import type { WinstonModuleOptions } from "nest-winston";
import { utilities as nestWinstonModuleUtilities } from "nest-winston";
import * as winston from "winston";
import { redactLogEntry } from "../../common/logging/mask";

const isProduction = process.env.NODE_ENV === "production";

// Redacts credentials (passwords, tokens, auth headers, cookies) at any
// depth and masks email addresses in every string field — see mask.ts.
const redactFormat = winston.format((info) => redactLogEntry(info));

export const winstonConfig: WinstonModuleOptions = {
  level: process.env.LOG_LEVEL || "info",
  format: isProduction
    ? winston.format.combine(redactFormat(), winston.format.timestamp(), winston.format.json())
    : winston.format.combine(
        redactFormat(),
        winston.format.timestamp(),
        winston.format.ms(),
        nestWinstonModuleUtilities.format.nestLike("TAPT", {
          colors: true,
          prettyPrint: true,
          processId: true,
          appName: true,
        }),
      ),
  transports: [
    new winston.transports.Console({
      stderrLevels: ["error", "warn"],
    }),
  ],
};
