import { WinstonModule, utilities as nestWinstonModuleUtilities } from "nest-winston";
import * as winston from "winston";

const isProduction = process.env.NODE_ENV === "production";

const redactFormat = winston.format((info) => {
  if (info.headers) {
    const sensitive = ["authorization", "cookie", "set-cookie", "x-api-key"];
    const redacted: Record<string, string> = {};
    for (const [key, value] of Object.entries(info.headers as Record<string, string>)) {
      redacted[key] = sensitive.includes(key.toLowerCase()) ? "[REDACTED]" : value;
    }
    info.headers = redacted;
  }
  return info;
});

export const winstonConfig = {
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
      stderrLevels: ["error"],
    }),
  ],
};

export function createChildLogger(
  bindings: Record<string, unknown>,
): winston.Logger {
  const logger = winston.createLogger(winstonConfig);
  return logger.child(bindings);
}

export const configuredWinstonModule = WinstonModule.forRoot(winstonConfig);
