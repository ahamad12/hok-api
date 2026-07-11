import type { WinstonModuleOptions } from "nest-winston";
import { utilities as nestWinstonModuleUtilities } from "nest-winston";
import * as winston from "winston";

const isProduction = process.env.NODE_ENV === "production";

const redactFormat = winston.format((info) => {
  if (info.headers) {
    const sensitive = ["authorization", "cookie", "set-cookie", "x-api-key"];
    const headers = info.headers as Record<string, string>;
    const redacted: Record<string, string> = { ...headers };

    for (const key of Object.keys(redacted)) {
      if (sensitive.includes(key.toLowerCase())) {
        redacted[key] = "[REDACTED]";
      }
    }
    info.headers = redacted;
  }
  return info;
});

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
