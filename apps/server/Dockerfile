FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY apps/server/package*.json ./apps/server/
COPY packages/ ./packages/
RUN npm ci
COPY apps/server ./apps/server
WORKDIR /app/apps/server
RUN npx tsdown build

FROM node:24-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/packages/db/prisma/generated ./packages/db/prisma/generated
RUN npm ci --omit=dev --workspace=server
RUN chown -R appuser:appgroup /app
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
CMD ["node", "dist/index.js"]
